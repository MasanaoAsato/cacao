# Artwork production source of truth

Design contract: `.design/frontend/25.2-booklet-artwork-library.html`.

## Production status

The target is 12 techniques with 24 works each (288 total). All 12 touch sets now contain 24 draft works: 216 SVGs and 72 WebPs. The pre-existing 13 motif files do not count. Every unreviewed entry uses `reviewId: null` and remains a draft.

Technical uses measured contours and construction lines; woodcut uses bold ink masses and carved cuts; pencil uses exploratory pressure and hatching; engraving uses fine cross-hatching; cut-paper separates offset color planes; brush uses tapered, pressure-shaped strokes; risograph uses offset two-color plates and halftone; screenprint uses broad spot-color planes; pixel snaps contours and cells to a four-pixel grid. Ink-wash uses layered translucent polygons, offset pigment blooms, and granulation; gouache uses opaque polygons with dark underpainting and varied-width brush marks; chalk uses broad continuous cores, broken dry strokes, and scattered powder marks. Raster subjects are rendered deterministically by generate_painterly.py from technique-specific polygon, line, and texture primitives, then encoded as WebP with libwebp; the generator does not trace SVG sources. Every seasonal source is one 1000 × 1000 image with four 500 × 500 views; views do not count as separate works.

## Technique direction

| Touch | Drawing method and production rules | Format |
| --- | --- | --- |
| `woodcut` | Broad ink masses, interrupted contours and carved white cuts; avoid uniform hairlines. | SVG mask |
| `pencil` | Exploratory overlapping contours, pressure changes and sparse graphite hatching; do not simulate this with random path jitter. | SVG mask |
| `engraving` | Fine parallel and cross-hatched lines build volume through density. | SVG mask |
| `cut-paper` | Irregular cut edges, separate overlapping shapes and visible paper layers. | SVG none |
| `brush` | Decisive varied-width brush silhouettes and dry-brush edges. | SVG mask |
| `ink-wash` | Pigment blooms, soft value gradients and wet-on-dry edges; create raster artwork directly. | WebP |
| `gouache` | Opaque layered paint, brush marks and matte color transitions; create raster artwork directly. | WebP |
| `risograph` | Registration shifts, halftone fields and limited overlapping ink colors. | SVG none |
| `screenprint` | Flat separated ink planes, coarse grain and intentional stencil bridges. | SVG none |
| `pixel` | Grid-aligned clusters and stepped contours; preserve crisp nearest-neighbor scaling. | SVG none |
| `technical` | Precise subject-specific construction, center lines, scales and measured detail. | SVG mask |
| `chalk` | Dusty broken strokes, smudged edges and dark-board negative space; create raster artwork directly. | WebP |

## Subject and role inventory per touch

Each touch has six hero subjects: `mountain`, `sea`, `street`, `machiya-grid`, `urban-window-railway`, and `roof-arch`. It has eight medium subjects: `train`, `airplane`, `car`, `bag`, `tableware`, `leaf`, `flower`, and `shell`. Its six page elements are `photo-frame` (`frame`), `heading-band` (`heading`), `sticky-note` (`tab`), `ticket-label` (`label`), `measurement-rule` (`rule`), and `grid-panel` (`panel`). Its four continuous elements are `straight-arrow`, `turn-arrow`, `route`, and `season-pattern`.

The target ratios are hero 3:2, medium 1:1, frame and panel 4:3, heading 8:1, tab 3:1, label 2:1, rule 32:1, arrows 3:1, route 1:2 and seasonal source 1:1. Seasonal source images contain spring flowers, summer waves, autumn leaves and winter snow as four manifest views. The chalk panel additionally needs a distinct powdery film view.

## Review and provenance

No visual review has been completed. reviewId is the identifier of a completed visual review, not an asset or revision ID; all 288 manifest entries therefore remain drafts with reviewId: null. The catalog contains 216 SVGs and 72 WebPs, 24 works in each of 12 touch manifests. Raster dimensions are passed directly to libwebp and recorded in the manifests. The minimum 300 dpi widths are met: hero 1536 px at 128 mm (1512 px required), medium 640 px at 42 mm (497 required), seasonal views 500 px at 40 mm (473 required), and chalk panel film view 1600 px at 128 mm (1512 required). Every raster is opaque and hasAlpha is false. A5 print appearance and minPrintWidthMm are not visually reviewed; those minima remain estimates pending review.

Do not count recolors, small variations, aliases or additional views as separate works. Keep each subject and technique distinct through its forms, line or paint behavior, texture, and page role. SVG assets must contain no embedded text or external references. Raster assets must be authored as WebP at 300 dpi or more for their declared maximum print width; record alpha and validate each view independently.
