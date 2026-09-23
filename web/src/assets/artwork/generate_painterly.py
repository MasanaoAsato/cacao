import ctypes
import ctypes.util
import math
import random
import sys
from pathlib import Path

BASE = Path("web/src/assets/artwork")
TOUCHES = {
 "ink-wash": {"paper": (244,238,219), "dark": (39,47,45), "colors": [(80,113,106),(104,133,119),(174,126,89),(189,159,111)]},
 "gouache": {"paper": (243,230,201), "dark": (35,54,59), "colors": [(35,101,112),(207,100,70),(223,178,83),(107,133,82)]},
 "chalk": {"paper": (39,48,52), "dark": (235,225,198), "colors": [(118,185,181),(221,133,102),(233,206,128),(221,225,213)]},
}
SUBJECTS = {
 "hero": ["mountain","sea","street","machiya-grid","urban-window-railway","roof-arch"],
 "medium": ["train","airplane","car","bag","tableware","leaf","flower","shell"],
 "frame": ["photo-frame"], "heading": ["heading-band"], "tab": ["sticky-note"],
 "label": ["ticket-label"], "rule": ["measurement-rule"], "panel": ["grid-panel"],
 "straight-arrow": ["straight-arrow"], "turn-arrow": ["turn-arrow"], "route": ["route"],
 "season-pattern": ["season-pattern"],
}

class Paint:
 def __init__(self,w,h,t,seed):
  self.w,self.h,self.t=w,h,t
  self.r=random.Random(seed)
  self.cfg=TOUCHES[t]
  self.buf=bytearray(bytes((*self.cfg["paper"],255))*(w*h))
 def pixel(self,x,y,c,a=255):
  x=int(x);y=int(y)
  if 0<=x<self.w and 0<=y<self.h and a>0:
   i=(y*self.w+x)*4
   if a>=255:self.buf[i:i+4]=bytes((*c,255))
   else:
    q=255-a
    self.buf[i]=(c[0]*a+self.buf[i]*q)//255
    self.buf[i+1]=(c[1]*a+self.buf[i+1]*q)//255
    self.buf[i+2]=(c[2]*a+self.buf[i+2]*q)//255
 def dot(self,x,y,r,c,a=255):
  r=max(1,int(r))
  for yy in range(max(0,int(y-r)),min(self.h,int(y+r+1))):
   dx=int(math.sqrt(max(0,r*r-(yy-y)**2)))
   for xx in range(max(0,int(x-dx)),min(self.w,int(x+dx+1))):self.pixel(xx,yy,c,a)
 def polygon(self,pts,c,a=255):
  if len(pts)<3:return
  lo=max(0,int(min(y for x,y in pts)));hi=min(self.h-1,int(max(y for x,y in pts)))
  for y in range(lo,hi+1):
   xs=[]
   for i,(x1,y1) in enumerate(pts):
    x2,y2=pts[(i+1)%len(pts)]
    if (y1<=y<y2) or (y2<=y<y1):xs.append(x1+(y-y1)*(x2-x1)/(y2-y1))
   xs.sort()
   for i in range(0,len(xs)-1,2):
    for x in range(max(0,int(xs[i])),min(self.w,int(xs[i+1])+1)):self.pixel(x,y,c,a)
 def line(self,a,b,c,width=4,alpha=255,broken=False):
  x0,y0=a;x1,y1=b;n=max(1,int(max(abs(x1-x0),abs(y1-y0))/max(1,width/2)))
  for k in range(n+1):
   if broken and self.r.random()<.06:continue
   f=k/n;self.dot(x0+(x1-x0)*f,y0+(y1-y0)*f,width/2,c,alpha)
 def ellipse(self,x,y,rx,ry,c,a=255):
  for yy in range(max(0,int(y-ry)),min(self.h,int(y+ry+1))):
   q=1-((yy-y)/max(1,ry))**2
   if q>=0:
    half=rx*math.sqrt(q)
    for xx in range(max(0,int(x-half)),min(self.w,int(x+half+1))):self.pixel(xx,yy,c,a)
 def coords(self,pts):return [(int(x*self.w),int(y*self.h)) for x,y in pts]
 def fill(self,pts,c):
  p=self.coords(pts)
  if self.t=="ink-wash":
   # Several low-opacity offsets make a broad, uneven pigment bloom around the edge.
   for dx,dy in ((-14,-4),(-9,-12),(0,-15),(11,-9),(15,2),(8,12),(-4,14),(-13,7)):
    self.polygon([(x+dx,y+dy) for x,y in p],c,11)
   self.polygon(p,c,78)
   xmin=max(0,min(x for x,y in p));xmax=min(self.w-1,max(x for x,y in p))
   ymin=max(0,min(y for x,y in p));ymax=min(self.h-1,max(y for x,y in p))
   for _ in range(max(80,self.w*self.h//50000)):
    x=self.r.randint(xmin,xmax);y=self.r.randint(ymin,ymax);inside=False
    for i,(ax,ay) in enumerate(p):
     bx,by=p[(i+1)%len(p)]
     if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay+1e-9)+ax:inside=not inside
    if inside and self.r.random()<.75:
     self.ellipse(x,y,self.r.randint(12,45),self.r.randint(7,28),c,self.r.randint(18,48))
   for a,b in zip(p,p[1:]+p[:1]):
    n=max(1,int(math.dist(a,b)/65))
    for i in range(n):
     f=(i+self.r.random())/n
     self.ellipse(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,self.r.randint(3,9),self.r.randint(2,7),self.cfg["dark"],self.r.randint(18,43))
  elif self.t=="gouache":
   self.polygon([(x-7,y+7) for x,y in p],self.cfg["dark"],180)
   self.polygon(p,c,255)
   xmin=max(0,min(x for x,y in p));xmax=min(self.w-1,max(x for x,y in p))
   ymin=max(0,min(y for x,y in p));ymax=min(self.h-1,max(y for x,y in p))
   # Opaque paint retains overlapping brush marks and broken dry edges.
   for _ in range(24):
    x=self.r.randint(xmin,xmax);y=self.r.randint(ymin,ymax)
    color=self.r.choice((c,self.cfg["paper"],self.cfg["dark"]))
    length=self.r.randint(max(8,self.w//35),max(9,self.w//12))
    self.line((x,y),(x+length,y+self.r.randint(-length//8,length//8)),color,self.r.randint(max(10,self.w//120),max(14,self.w//70)),self.r.randint(55,130),True)
  else:
   self.polygon(p,c,175)
   for _ in range(max(60,self.w*self.h//25000)):
    x=self.r.uniform(min(x for x,y in p),max(x for x,y in p));y=self.r.uniform(min(y for x,y in p),max(y for x,y in p))
    self.dot(x,y,self.r.choice((1,2,3)),self.cfg["paper"],self.r.randint(20,80))
 def gesture(self,points,c,scale=.008,alpha=230):
  p=self.coords(points);width=max(3,int(min(self.w,self.h)*scale))
  for a,b in zip(p,p[1:]):
   if self.t=="chalk":
    # Soft continuous core, broken dry-brush ridges, then loose powder at the edges.
    self.line(a,b,c,width,alpha//2,False)
    self.line(a,b,c,max(2,int(width*.82)),alpha,True)
    for _ in range(max(10,int(math.dist(a,b)*.10))):
     f=self.r.random();x=a[0]+(b[0]-a[0])*f;y=a[1]+(b[1]-a[1])*f
     self.dot(x+self.r.gauss(0,width*.48),y+self.r.gauss(0,width*.42),self.r.choice((1,2,3,4)),c,self.r.randint(18,90))
    self.line((a[0],a[1]+width*.12),(b[0],b[1]+width*.12),self.cfg["paper"],max(1,width//5),22,True)
   elif self.t=="ink-wash":
    for off,al in ((-3,35),(0,115),(3,30)):self.line((a[0],a[1]+off),(b[0],b[1]+off),c,width,al)
   else:
    self.line(a,b,c,width,255)
    self.line((a[0],a[1]-1),(b[0],b[1]-1),self.cfg["paper"],max(1,width//4),65,True)
 def scene(self,s,role):
  c=self.cfg["colors"];w=self.w;h=self.h
  if role=="hero":
   self.hero(s);return
  if s in ("photo-frame","grid-panel"):
   self.fill([(.08,.1),(.92,.1),(.92,.9),(.08,.9)],c[0])
   self.fill([(.15,.2),(.85,.2),(.85,.8),(.15,.8)],self.cfg["paper"])
   if s=="photo-frame":self.fill([(.15,.59),(.34,.42),(.47,.55),(.59,.34),(.85,.59),(.85,.8),(.15,.8)],c[2])
   else:
    for i in range(6):self.gesture([(.12,.25+i*.1),(.88,.25+i*.1)],c[2],.004)
  elif s=="heading-band":self.fill([(.03,.12),(.96,.08),(.94,.87),(.04,.91)],c[0])
  elif s=="sticky-note":self.fill([(.12,.09),(.9,.12),(.86,.84),(.16,.9),(.11,.78)],c[2])
  elif s=="ticket-label":self.fill([(.08,.18),(.9,.18),(.9,.82),(.08,.82)],c[1])
  elif s=="measurement-rule":
   self.gesture([(.05,.52),(.95,.52)],c[0],.08)
   for i in range(24):
    x=.08+i*.036;self.gesture([(x,.25),(x,.42 if i%4 else .76)],c[1],.06)
  elif s in ("straight-arrow","turn-arrow","route"):
   pts=[(.12,.5),(.88,.5)] if s=="straight-arrow" else ([ (.12,.76),(.12,.28),(.85,.28)] if s=="turn-arrow" else [(.5,.08),(.5,.92)])
   self.gesture(pts,c[2],.025)
   for x,y in pts[::2]:self.ellipse(x*w,y*h,max(6,w*.015),max(6,h*.015),c[1])
  elif s=="season-pattern":
   for row in range(4):
    for col in range(4):
     x=.12+col*.25;y=.12+row*.25
     if row==0:self.ellipse(x*w,y*h,w*.04,h*.06,c[col%4])
     elif row==1:self.gesture([(x-.06,y),(x,y-.05),(x+.06,y)],c[col%4],.01)
     elif row==2:self.fill([(x-.04,y+.05),(x,y-.06),(x+.05,y+.05),(x,y+.02)],c[col%4])
     else:self.gesture([(x-.04,y-.04),(x+.04,y+.04)],c[col%4],.01)
  else:
   self.fill([(.2,.2),(.8,.2),(.8,.8),(.2,.8)],c[0])
  if role=="medium":
   if s in ("flower","shell","leaf"):
    for i in range(7):
     a=2*math.pi*i/7;self.ellipse(w*(.5+.17*math.cos(a)),h*(.48+.17*math.sin(a)),w*.07,h*.09,c[i%4])
    self.ellipse(.5*w,.48*h,w*.06,h*.06,c[2])
   else:
    self.fill([(.16,.56),(.25,.34),(.72,.34),(.86,.55),(.84,.72),(.15,.72)],c[0])
    self.gesture([(.28,.55),(.72,.55)],c[3],.012)
 def hero(self,s):
  c=self.cfg["colors"];w=self.w;h=self.h
  P=lambda q:self.fill(q,c[0])
  if s=="mountain":
   if self.t=="ink-wash":
    P([(-.08,.76),(.07,.62),(.19,.3),(.3,.46),(.45,.12),(.59,.52),(.78,.26),(.92,.58),(1.08,.47),(1.08,.95),(-.08,.95)])
    self.fill([(-.04,.83),(.16,.69),(.33,.75),(.49,.56),(.63,.75),(.8,.61),(1.05,.76),(1.05,.98),(-.04,.98)],c[1])
   elif self.t=="gouache":
    P([(-.05,.83),(.02,.58),(.21,.65),(.34,.35),(.48,.55),(.66,.17),(.78,.53),(.93,.36),(1.06,.62),(1.06,.97),(-.05,.97)])
    self.fill([(.02,.83),(.19,.75),(.34,.79),(.5,.64),(.66,.77),(.83,.63),(1.02,.75),(1.02,.98),(.02,.98)],c[2])
    self.fill([(.52,.52),(.66,.17),(.79,.54),(.73,.47),(.68,.38),(.63,.48),(.58,.39)],c[3])
   else:
    self.gesture([(-.03,.76),(.12,.51),(.24,.58),(.36,.3),(.47,.53)],c[0],.05)
    self.gesture([(.43,.64),(.61,.2),(.76,.67),(.9,.43),(1.04,.69)],c[2],.055)
    self.gesture([(.04,.83),(.27,.72),(.46,.8),(.63,.69),(.84,.82),(1,.75)],c[1],.06)
  elif s=="sea":
   self.fill([(-.02,.35),(1.03,.35),(1.03,1),(-.02,1)],c[0]);self.ellipse(.76*h,.25*h,.075*w,.11*h,c[2],110)
   for i in range(10):
    y=.43+i*.052;self.gesture([(.03,y),(.3,y-.01),(.58,y+.01),(.97,y)],c[i%4],.012 if self.t=="chalk" else .005,210 if self.t!="ink-wash" else 95)
  elif s=="street":
   if self.t=="chalk":
    self.gesture([(.03,.09),(.24,.28),(.18,.76)],c[2],.06);self.gesture([(.96,.08),(.75,.25),(.82,.79)],c[0],.06)
    self.gesture([(.49,.45),(.27,.69),(.04,1)],c[1],.065);self.gesture([(.51,.45),(.73,.69),(.98,1)],c[1],.065)
   else:
    self.fill([(-.05,.09),(.31,.19),(.27,.8),(-.05,.88)],c[2]);self.fill([(.76,.13),(1.05,.06),(1.04,.89),(.74,.81)],c[0]);self.fill([(.43,.39),(.59,.39),(1.05,1),(-.05,1)],c[1])
    for x in (.05,.16,.8,.89):self.fill([(x,.29),(x+.07,.3),(x+.07,.43),(x,.42)],c[3])
  elif s=="machiya-grid":
   self.fill([(.07,.41),(.52,.12),(.96,.43),(.86,.51),(.52,.31),(.14,.52)],c[0]);self.fill([(.17,.47),(.84,.47),(.81,.89),(.19,.89)],c[2])
   for x in (.27,.38,.64,.75):self.gesture([(x,.49),(x-.01,.86)],c[3],.014)
   for y in (.59,.7,.79):self.gesture([(.21,y),(.78,y)],c[3],.01)
  elif s=="urban-window-railway":
   self.fill([(.05,.06),(.95,.1),(.9,.63),(.08,.67)],c[0])
   for x in (.17,.42,.68):self.fill([(x,.17),(x+.15,.18),(x+.16,.51),(x,.51)],c[2])
   for y in (.82,.92):self.gesture([(.03,y),(.98,y)],c[1],.014)
  else:
   for x,top,span in ((.03,.31,.4),(.48,.2,.45)):
    self.fill([(x,.83),(x,top+.15),(x+.04,top+.04),(x+span*.5,top),(x+span-.05,top+.06),(x+span,top+.2),(x+span,.83)],c[0])
    self.fill([(x+.09,.83),(x+.09,top+.2),(x+.14,top+.12),(x+span*.5,top+.1),(x+span-.13,top+.23),(x+span-.1,.83)],self.cfg["paper"])
 def encode(self,path):
  lib=ctypes.CDLL(ctypes.util.find_library("webp"))
  lib.WebPEncodeRGBA.argtypes=[ctypes.POINTER(ctypes.c_uint8),ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_float,ctypes.POINTER(ctypes.POINTER(ctypes.c_uint8))]
  lib.WebPEncodeRGBA.restype=ctypes.c_size_t;lib.WebPFree.argtypes=[ctypes.c_void_p]
  src=(ctypes.c_uint8*len(self.buf)).from_buffer(self.buf);out=ctypes.POINTER(ctypes.c_uint8)()
  size=lib.WebPEncodeRGBA(src,self.w,self.h,self.w*4,91.0,ctypes.byref(out))
  if not size:raise RuntimeError("WebP encoding failed")
  data=ctypes.string_at(out,size);lib.WebPFree(out)
  if data[:4]!=b"RIFF" or data[8:12]!=b"WEBP":raise RuntimeError("invalid WebP output")
  Path(path).write_bytes(data)
def dims(t,role):
 if role=="hero":return 1536,1024,128
 if role=="medium":return 640,640,42
 if role in ("frame","panel"):return (2000,1500,128) if t=="chalk" and role=="panel" else (1536,1152,128)
 if role=="heading":return 1536,192,128
 if role=="tab":return 1536,512,128
 if role=="label":return 1536,768,128
 if role=="rule":return 1536,48,128
 if role in ("straight-arrow","turn-arrow"):return 900,300,30
 if role=="route":return 600,1200,30
 return 1000,1000,40
def main():
 selected_role=sys.argv[1] if len(sys.argv)>1 else None
 for t in TOUCHES:
  entries=[]
  for role,items in SUBJECTS.items():
   if selected_role and role!=selected_role:continue
   for subject in items:
    w,h,mx=dims(t,role);seed=sum(ord(ch) for ch in f"{t}:{subject}:{role}")*97+len(subject)*131
    art=Paint(w,h,t,seed);art.scene(subject,role)
    stem=f"{subject}-{role}";out=BASE/t;out.mkdir(parents=True,exist_ok=True);art.encode(out/f"{stem}.webp")
    views=""
    if role=="season-pattern":views=', views: [{ id: "spring", x: 0, y: 0, width: 500, height: 500 }, { id: "summer", x: 500, y: 0, width: 500, height: 500 }, { id: "autumn", x: 0, y: 500, width: 500, height: 500 }, { id: "winter", x: 500, y: 500, width: 500, height: 500 }]'
    if t=="chalk" and role=="panel":views=', views: [{ id: "film", x: 200, y: 150, width: 1600, height: 1200 }]'
    minw={"hero":26,"medium":16,"frame":22,"heading":32,"tab":22,"label":16,"rule":28,"panel":22,"straight-arrow":16,"turn-arrow":16,"route":14,"season-pattern":36}[role]
    method={
     "ink-wash":"Deterministic Python composition of translucent washes, softened edges and pigment marks; encoded to WebP with libwebp.",
     "gouache":"Deterministic Python composition of opaque color planes, underpainting and brush-mark primitives; encoded to WebP with libwebp.",
     "chalk":"Deterministic Python composition of broad broken strokes and powder marks on a dark ground; encoded to WebP with libwebp."
    }[t]
    entries.append(f'''  {{ id: "{t}-{stem}-r1", revision: 1, sourcePath: "../../assets/artwork/{t}/{stem}.webp", format: "webp", width: {w}, height: {h}, aspect: {w/h:.6f}, touchId: "{t}", subjectId: "{subject}", role: "{role}", recolor: "none", safeInset: {{ top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 }}, minPrintWidthMm: {minw}, maxPrintWidthMm: {mx}, originalityGroupId: "{t}-{subject}", provenance: {{ creator: "Cacao artwork studio", method: "{method}", licenseEvidence: "Original internal raster artwork authored for this repository; no external source material." }}, reviewId: null, hasAlpha: false{views} }}''')
  if selected_role is None and len(entries)!=24:raise RuntimeError((t,len(entries)))
  if selected_role is None:
   (BASE/t/"manifest.ts").write_text('import type { ArtworkDefinition } from "../../../theme/artwork/types";\n\n/** '+t+' original raster works; draft pending review. */\nexport const ARTWORK_MANIFEST: readonly ArtworkDefinition[] = [\n'+",\n".join(entries)+"\n];\n")
  print(t,"24 WebP")
if __name__=="__main__":main()
