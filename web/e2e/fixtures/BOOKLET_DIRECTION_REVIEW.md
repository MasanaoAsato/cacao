# 52方向の単独冊子・視覚審査前プレビュー

リポジトリルートで `mise run web:dev` を起動し、次を開く。

<http://localhost:5173/e2e/fixtures/booklet-direction-review.html?direction=vintage-journal>

上部の選択欄・前後リンクで52方向を移動できる。全方向に同じ3日×4予定・同じ2枚の旅程画像・seed 6を使う。初期表示の`vintage-journal`はSVG素材を使う。上部に冊子で使うSVG素材IDが表示され、素材枠のない方向ではSVGを使わずに構図・文字・配色を確認する。準備が完了したページは「PDFに印刷」でA5印刷できる。エラーが出た方向はそのまま記録し、別の方向への差し替えで審査を進めない。

> **現在は52方向の視覚審査に使えない。** これは現行baselineを強制選択して描く診断用プレビューで、全方向が固有のデザインとして完成したことを示さない。たとえば `travel-magazine` と `retro-tourism` は同じmodule・構図・style bundleを使い、両者のタッチ差が単独baselineでは描画に反映されない。現状、単独baselineにSVG素材bindingを持たない方向では、manifestの素材を渡しても紙面にSVGは出ない。25.1/25.2/25.4の製品実装を設計に合わせて補い、再生成するまで採否判定に使わないこと。

**draftプレビュー専用。** 14方向に必要な未審査素材も一時的に読み込む。製品のactive一覧・reviewIdを変更せず、強制した単独冊子を設計25.5の208作例やランダム抽選可能な方向として数えない。

全52方向のカラーPNG・グレースケールPNG・PDF・使用素材IDを一度に保存する場合は、`AGENTS.md` の固定Playwright Dockerイメージを使用する。リポジトリルートから実行し、`<作業固有名>` は未使用の名前に置き換える。

```bash
docker run --rm --ipc=host \
  --mount "type=bind,source=$PWD/web,target=/work" \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  /bin/bash -lc 'BOOKLET_REVIEW_EXPORT=1 PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_OUTPUT_DIR=/work/test-results/<作業固有名>/report corepack pnpm exec playwright test e2e/booklet-direction-review.spec.ts --reporter=html --retries=0 --update-snapshots=none --output=/work/test-results/<作業固有名>/results --trace=retain-on-failure'
```

終了後、`web/test-results/<作業固有名>/report/index.html` で方向ごとに画像とPDFを確認できる。成果物はgit管理外。次回は別名を使い、前回の結果を上書きしない。採否は実寸で他の方向と比較して判断し、承認後の記録は `web/src/theme/reviews/` に追加する。
