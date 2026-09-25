"""Build a side-by-side review index from one complete Playwright HTML report.

Usage: python3 web/e2e/fixtures/build_direction_review_overview.py web/test-results/<run>
The report must contain the 52 single-direction export tests. No image is edited.
"""

import argparse
import base64
import html
import io
import json
import re
import zipfile
from pathlib import Path


WEB = Path(__file__).resolve().parents[2]
EXPORT_TITLE = re.compile(r"^(.+) の単独冊子をA5で書き出す$")


def direction_catalog() -> list[tuple[str, str, str]]:
    source = (WEB / "src/theme/directions/types.ts").read_text()
    ids_block = source.split("export const DIRECTION_IDS = [", 1)[1].split("] as const", 1)[0]
    ids = re.findall(r'"([^"]+)"', ids_block)
    definitions = {}
    for path in (WEB / "src/theme/directions/definitions").glob("*.ts"):
        definition = path.read_text()
        fields = [
            re.search(rf'{key}:\s*"([^"]+)"', definition)
            for key in ("id", "label", "description")
        ]
        if all(fields):
            direction_id, label, description = (field.group(1) for field in fields)
            definitions[direction_id] = (label, description)
    if len(ids) != 52 or any(direction_id not in definitions for direction_id in ids):
        raise ValueError("52方向の定義を読み取れません")
    return [(direction_id, *definitions[direction_id]) for direction_id in ids]


def report_attachments(report_dir: Path) -> dict[str, dict[str, str]]:
    report_html = (report_dir / "index.html").read_text()
    embedded = re.search(
        r'<template id="playwrightReportBase64">data:application/zip;base64,([A-Za-z0-9+/=]+)</template>',
        report_html,
    )
    if not embedded:
        raise ValueError("PlaywrightのHTMLレポートが見つかりません")
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(embedded.group(1)))) as archive:
        report = json.loads(archive.read("report.json"))
    found = {}
    for file in report["files"]:
        for test in file["tests"]:
            match = EXPORT_TITLE.fullmatch(test["title"])
            if not match:
                continue
            if not test["ok"]:
                raise ValueError(f"書き出しテストが失敗しています: {match.group(1)}")
            attachments = {
                item["name"]: item["path"]
                for result in test["results"]
                for item in result["attachments"]
                if "path" in item
            }
            for name in (
                "color.png", "grayscale.png", "cover-color.png",
                "cover-grayscale.png", "day-color.png", "day-grayscale.png",
                "booklet.pdf",
            ):
                if name not in attachments or not (report_dir / attachments[name]).is_file():
                    raise ValueError(f"{match.group(1)} の {name} がありません")
            found[match.group(1)] = attachments
    return found


HEAD = """<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>52方向のデザイン審査一覧</title>
<style>
body{margin:0;background:#e9e8e3;color:#172b38;font:16px/1.5 system-ui,sans-serif}
header{position:sticky;top:0;z-index:3;padding:18px 24px;background:#fffdf8;border-bottom:2px solid #172b38;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:1.4rem;margin:0}header p{margin:0;flex-basis:100%;font-size:.9rem}
input{padding:8px 12px;font:inherit;min-width:240px}button{padding:8px 12px;font:inherit}
.grid{padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(468px,1fr));gap:22px}
.card{padding:16px;background:#fffdf8;border:1px solid #b7b8b1;box-shadow:0 8px 24px #172b3817}
.card h2{margin:0 0 3px;font-size:1.1rem}.card h2 span{font-size:.8rem;color:#53636c}
.card p{margin:0 0 12px;font-size:.87rem;min-height:2.5em}.pages{display:flex;gap:10px}
.page{position:relative;width:220px;height:312px;overflow:hidden;background:white;box-shadow:0 1px 7px #172b3830}
.page img{display:block;width:100%;height:100%;object-fit:contain}
body[data-tone="gray"] .color{display:none}body[data-tone="color"] .gray{display:none}
.card a{display:inline-block;margin-top:10px;margin-right:12px;color:#1b5369}
@media(max-width:520px){.grid{grid-template-columns:1fr;padding:10px}.card{padding:10px}.pages{gap:4px}.page{width:45vw;height:calc(45vw * 210 / 148)}}
</style></head><body data-tone="color"><header><h1>52方向のデザイン審査一覧</h1>
<input id="filter" type="search" placeholder="方向名・IDで絞り込み" aria-label="方向名・IDで絞り込み">
<button id="tone" type="button">白黒で見る</button>
<p>同じ旅程の表紙と1日目。draft素材を仮使用した審査候補です。
<a href="report/index.html">全52方向のPDF・画像レポート</a>。単独冊子の表示には開発サーバーを起動してください。</p></header><main class="grid">
"""

FOOT = """</main><script>
const q=document.querySelector("#filter");
q.addEventListener("input",()=>{const term=q.value.toLocaleLowerCase();for(const card of document.querySelectorAll(".card"))card.hidden=!card.dataset.search.toLocaleLowerCase().includes(term)});
document.querySelector("#tone").addEventListener("click",e=>{const gray=document.body.dataset.tone!=="gray";document.body.dataset.tone=gray?"gray":"color";e.currentTarget.textContent=gray?"カラーで見る":"白黒で見る"});
</script></body></html>
"""


def card(number: int, direction_id: str, label: str, description: str, assets: dict[str, str]) -> str:
    escaped_id = html.escape(direction_id, quote=True)
    escaped_label = html.escape(label, quote=True)
    escaped_description = html.escape(description, quote=True)
    pdf = html.escape("report/" + assets["booklet.pdf"], quote=True)
    pages = "".join(
        f'<div class="page {kind}"><img class="color" src="{html.escape("report/" + assets[f"{kind}-color.png"], quote=True)}" alt="{escaped_label}の{kind}">'
        f'<img class="gray" src="{html.escape("report/" + assets[f"{kind}-grayscale.png"], quote=True)}" alt=""></div>'
        for kind in ("cover", "day")
    )
    return (
        f'<section class="card" data-search="{escaped_label} {escaped_id}">'
        f'<h2>{number:02d}. {escaped_label} <span>{escaped_id}</span></h2>'
        f'<p>{escaped_description}</p><div class="pages">{pages}</div>'
        f'<a href="http://localhost:5173/e2e/fixtures/booklet-direction-review.html?direction={escaped_id}">単独冊子を開く</a>'
        f'<a href="{pdf}">PDFを見る</a></section>\n'
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    run_dir = args.run_dir.resolve()
    overview = run_dir / "overview.html"
    if overview.exists():
        raise FileExistsError(f"既存の審査一覧を上書きしません: {overview}")
    catalog = direction_catalog()
    attachments = report_attachments(run_dir / "report")
    expected = {direction_id for direction_id, _, _ in catalog}
    if set(attachments) != expected:
        raise ValueError(f"52方向の書き出しが揃っていません: {sorted(expected - set(attachments))}")
    cards = "".join(
        card(number, direction_id, label, description, attachments[direction_id])
        for number, (direction_id, label, description) in enumerate(catalog, start=1)
    )
    overview.write_text(HEAD + cards + FOOT)
    print(overview)


if __name__ == "__main__":
    main()
