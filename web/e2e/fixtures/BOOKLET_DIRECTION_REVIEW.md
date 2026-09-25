# 52方向の単独冊子・デザイン審査

設計の正本は[25.6 審査表示と本番抽選への採用](../../../.design/frontend/25.6-booklet-direction-review.html)。以下は審査表示、比較資料の出力、承認記録の操作手順。

リポジトリルートで `mise run web:dev` を起動し、次を開く。

<http://localhost:5173/e2e/fixtures/booklet-direction-review.html?direction=vintage-journal>

選択欄と前後リンクで52方向を移動できる。各方向は同じ3日×4予定、同じ旅程画像、同じseed 6で描画するため、表紙と日別ページの構図・文字・素材を比較できる。画面で使用素材のIDとSVG／WebPの点数を確認できる。幾何学表現は `screenprint` 素材を使用し、`none` の方向は装飾素材を使わない。`season` 方向では「季節」欄から春・夏・秋・冬の柄を切り替えられる。準備が完了した冊子は「PDFに印刷」でA5出力できる。

この入口は製品と同じcompiler・module・描画CSSを使い、**審査表示だけ**全draft素材を仮カタログへ読み込む。48方向が表紙または日別に素材を使い、`minimal`、`photo-book`、`local-color`、`practical` の4方向は素材なしで描画する。候補の見た目を人が比較するためのものであり、表示できたことを承認済みとは扱わない。素材の `reviewId`、製品のactive一覧、25.5の208作例はこの入口では更新しない。

全52方向のカラーPNG・グレースケールPNG・PDF・使用素材IDを保存する場合は、`AGENTS.md` の固定Playwright Dockerイメージを使用する。期待画像と同じlinux/x64で見るため `--platform linux/amd64` を指定し、`<作業固有名>` は未使用の名前に置き換える。

```bash
docker run --rm --platform linux/amd64 --ipc=host \
  --mount "type=bind,source=$PWD/web,target=/work" \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  /bin/bash -lc 'BOOKLET_REVIEW_EXPORT=1 PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_OUTPUT_DIR=/work/test-results/<作業固有名>/report corepack pnpm exec playwright test e2e/booklet-direction-review.spec.ts --grep "単独冊子をA5" --reporter=html --retries=0 --update-snapshots=none --output=/work/test-results/<作業固有名>/results --trace=retain-on-failure'
```

終了後、`web/test-results/<作業固有名>/report/index.html` で方向ごとの画像とPDFを確認できる。全方向の表紙と最初の日別本文を横並びにする場合は、リポジトリルートで `python3 web/e2e/fixtures/build_direction_review_overview.py web/test-results/<作業固有名>` を実行し、生成された `overview.html` を開く。出力DOMの `data-scene-kind` から本文を選ぶので、章扉が間にある方向でも本文が載る。方向名で絞り込み、カラー／白黒を切り替えられる。成果物はgit管理外。次回は別名を使い、前回の結果を上書きしない。

## 現在の暫定採用

ユーザーの52方向確認と暫定使用の承認を根拠に、52方向・288素材を `active` に登録している。`provisional` の根拠・理由を残し、SVG/WebPの品質完成とは扱わない。本番は `VITE_BOOKLET_MAX_DIRECTIONS=1`（既定値）で1冊につき1方向を抽選する。地域向けの2方向は登録都市・国が一致する旅程で候補に入る。

素材を差し替える場合は、対象の原画とmanifestの `revision`・`reviewId`、`artwork.json` の対応記録を更新する。組版を変えない素材差し替えでは208作例の再生成は不要。`pnpm build` がファイル・寸法・依存素材・承認記録の整合性を検査する。新しい素材の無条件な自動承認は行わない。

`pnpm artwork:release-check` は最終品質と208作例を確認するための検査で、現在の暫定記録は合格対象にしない。`samples.json` は空のまま保持する。本番入口のE2Eは `VITE_BOOKLET_MAX_DIRECTIONS=1` を指定する。

## 最終採用の操作

1. 素材を実寸のカラーと白黒で確認し、採用する素材について `src/assets/artwork/*/manifest.ts` の `reviewId` と `src/theme/reviews/artwork.json` の同じID・revision・reviewId・審査者を記録する。まず状態を `reviewed` にする。
2. `e2e/fixtures/booklet-publication-plan.json` に公開予定の `directionIds` と `artworkIds` を明示する。`booklet-publication-review.html?seed=v2-00000006` と `booklet-diversity.spec.ts` はこの集合を `plannedPublicationCatalog(plan)` へ渡す。素材は `reviewed`／`active` の記録と一致するものだけを使い、本番と同じカタログ版・構成上限で製品compilerを動かす。単独方向の診断プレビューは正式作例に数えない。
3. 25.5の比較作例を `samples.json` に保存し、採用した作例の `sampleId` を `directions.json` の方向記録へ結び、`reviewed` にする。方向の紙面を変更したら定義の `revision` を上げて再審査する。
4. 公開する素材と方向の状態を `active` に変更する。通常の `pnpm build` は記録・版・採用作例・依存素材・再現性と公開予定集合を照合し、不整合なら失敗する。同時に `scripts/generatePublishedArtworkUrls.mjs` がactive素材だけのURL importを生成し、draftファイルを製品ビルドへ入れない。全52方向を正式公開する場合は `pnpm artwork:release-check` も通す。記録のない対象、`draft`、`reviewed` は本番抽選から除外される。

正式比較を行うE2Eサーバーと配信用ビルドでは、`VITE_BOOKLET_MAX_DIRECTIONS` を同じ値にする。25.5の複合方向を正式公開する場合は5以上が必要で、Playwrightの既定値は5、通常の開発・ビルドの既定値は1。暫定方向の承認記録は上限1専用で、複合方向を有効にする前に正式な比較記録へ置き換える。上限が違うと `catalogRevision` も変わり、保存した作例は公開整合検査を通らない。
