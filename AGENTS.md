# このプロジェクトの概要
このプロジェクトは、Go言語とvite + react + tsで書かれたWebアプリケーションです。
'./web'がフロントエンド、残りがバックエンドです。
ユーザーがフロントエンドについて話している場合は、'./web'についてを意味します。
ユーザーは出発地点・日程・予算を入力すると、それに応じたユニークな旅程をLLMが生成します。
ランダムな旅程を生成するため、同じ条件でも毎回異なる旅程が生成される闇鍋のような楽しみがあります。

# 制約
思考は任意の言語でよいが、最終的な回答は必ず日本語で行ってください
ユーザーはGolangの初心者のため、わかりやすい説明をしてください。

相対パス'.design'に設計書があるので、必ずユーザーから指定された番号のドキュメントを参照すること

全体の思考として、目的の設定から意図しない挙動、バグについては、それを巻き取るように修正する **のではなく**
意図しないバグ、挙動を修正するように思考しなければならない。

実装に合わせて、設計やテストを変えるのではなく、設計に合わせてプロダクトを作成する。

Playwright を使う場合は、下記「Playwright / E2E（Docker）」の手順に従うこと。

# 技術スタック
- 言語: Go,TS
- フレームワーク(ライブラリ): Gin (Webフレームワーク),vite,react,anStack Query
- dbツール: golang-migrate,gorm
- リポジトリ管理: GitHub
- ツール: mise


# デザインパターン
このプロジェクトでは、オニオンアーキテクチャとDDD（ドメイン駆動設計）を採用します。

# ディレクトリ構成
以下のような構成を基本とする。
```
src/
├── application/      # アプリケーション層（1ユースケース = 1パッケージ）
│   └── readmodel/    # ユースケースが返す読み取り専用 DTO と entity→DTO 変換（共有）
├── domain/           # ドメイン層
│   ├── entity/       # エンティティ
│   ├── event/        # ドメインイベント
│   ├── repository/   # リポジトリインターフェース
│   ├── service/      # ドメインサービス（生成ポート、画風選択、失敗コード分類）
│   └── value_object/ # 値オブジェクト
├── infrastructure/   # インフラ層
│   ├── config/       # 環境変数の設定ローダー（既定値・許容範囲・ドライバ名はここだけが持つ）
│   ├── database/     # GORM クライアント
│   ├── event/        # イベント Publisher 実装
│   ├── imagecontent/ # 生成画像のバイト列検証（生成器とストレージが共用）
│   ├── imagegen/     # ImageGenerator 実装（stub / openrouter、comfyui/ と imageprompt/ を含む）
│   ├── imagestore/   # ImageStorage 実装（fsstore/）
│   ├── journeygen/   # JourneyGenerator 実装（stub / openai / openrouter、journeyprompt/ を含む）
│   ├── openrouterclient/ # OpenRouter SDK の生成とエラー解釈（旅程・画像で共用）
│   ├── repository/   # リポジトリ実装（postgres/、テスト用の memory/）
│   └── worker/       # 画像生成ワーカー
├── internal/testkit/ # テスト専用: エンティティビルダーと fakes/（リポジトリのフェイク）
├── observability/    # 層をまたぐ横断パッケージ: PII を含まない構造化ログとエラー分類
├── presentation/     # インターフェース層
│   ├── controller/   # コントローラー
│   └── presenter/    # プレゼンター
├── main.go           # エントリーポイント（起動・シグナル処理・停止）
└── wire.go           # Composition Root（設定読込・実装選択・依存注入）
└── web/                   ← 新規
    ├── package.json
    ├── vite.config.ts     ← /api プロキシ設定
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── api/           ← API クライアントと型定義
        ├── booklet/       ← BookletModel と ページ分割の純粋関数
        ├── theme/         ← シード → デザイントークン
        ├── components/    ← 共通 UI コンポーネント
        ├── pages/         ← 画面
        ├── features/      ← 機能(必要になった場合)
        └── print.css      ← @page 定義・しおり用スタイル
``` 

# テスト
unit テストは実装します。
最低限、以下の3種類のテストを実装します。
境界値が難しい場合は、境界値のテストを省略することを許します。
- 正常系
- 異常系
- 境界値系

テストは、コロケーションパターンを採用し、テスト対象のコードと同じディレクトリに配置します。

## Playwright / E2E（Docker）

### 前提と確認範囲

- **ホストにブラウザーを追加せず、既存の Docker イメージを使う。** 2026-09-05 に `local/playwright:1.62.0` で A5 PDF 出力テストの成功を確認した。コンテナ内 Node は `v24.18.0`、マウントした依存関係の `@playwright/test` は `1.62.1` だった。タグだけでパッケージのバージョンを判断しない。
- 設定の正本は `web/playwright.config.ts`、テストは `web/e2e/`、API モックは `web/e2e/fixtures/booklet.ts`。`package.json` の `test:e2e` と `mise run web:test:e2e` は単に Playwright を実行するため、ホストで実行しても Docker には切り替わらない。
- 現在の `booklet-pdf.spec.ts` は API・画像をモックするブラウザーテスト。Go API・DB・LLM・Gotenberg の起動やデータ投入は不要。PDF は Chromium の `page.pdf()` で検証しており、実 API や Gotenberg の結合テストとは別物。
- `compose.yml` に Playwright サービスはない。`docker compose up playwright` は使わない。
- 既存の作業差分を確認し、他の作業のテスト・画像・起動済みコンテナを変更しない。ユーザーが設計番号を指定した場合は、その設計書を先に参照する。

### 標準実行手順

以下はリポジトリルートから実行する。シェルコマンドは環境の lean-ctx / RTK 指示に従って実行し、正確なログが必要なときは `lean-ctx raw` を使う。

1. `docker image inspect local/playwright:1.62.0` で既存イメージを確認する。Docker ソケットへのアクセスが拒否されたら、同じ操作に必要な権限を申請する。権限エラーをイメージ・ブラウザー不足と解釈しない。
2. `web/node_modules` があることを確認する。依存関係が未導入、または lockfile と不整合の場合のみ `mise run web:install` を使う。毎回インストールし直さない。
3. まず対象テストだけを一時コンテナで実行する。初回の動作確認には次の PDF テストを使える。

```bash
docker run --rm --pull=never --ipc=host \
  --mount "type=bind,source=$PWD/web,target=/work" \
  --workdir /work \
  local/playwright:1.62.0 \
  /bin/bash -lc 'corepack pnpm exec playwright test e2e/booklet-pdf.spec.ts --grep "代表テーマをA5" --reporter=line --retries=0 --update-snapshots=none --output=/tmp/cacao-e2e-results'
```

- 対象の絞り込みは `--grep` のテスト名を変更する。全件実行は `--grep "代表テーマをA5"` を外す。`--update-snapshots=none` により、欠けた期待画像も勝手に生成しない。
- Playwright の `webServer` が**同じコンテナ内**で Vite を `127.0.0.1:4173` に起動・終了する。通常は手動の Vite 起動、ポート公開、`--network=host`、`host.docker.internal` は不要。ホストに残っている 4173 番のサーバーも、この構成では再利用しない。
- 既定ブラウザーは Chromium。設定に名前付き `projects` はないので `--project=chromium` を追加しない。`workers: 1` は設定済み。
- 上のコマンドは生成物をコンテナ内の一時ディレクトリへ出し、終了時に削除する。失敗時の画像・trace を残す必要がある場合だけ、`--output=/work/test-results/<作業固有名>` と `--trace=retain-on-failure` を使う。ホストの `web/test-results/<作業固有名>/` に保存される（コンテナの実行ユーザーによっては root 所有になる）。既存の結果ディレクトリを上書き・削除しない。
- スクリーンショット調査も、既存 spec・fixture を使った対象テストを優先する。モックが必要なページを単に開くだけでは、同じ検証条件にならない。

### 失敗時の切り分けと停止条件

- **イメージがない**：ローカルのイメージ一覧を一度確認し、利用可能なタグを特定する。見つからなければ不足を報告する。勝手に pull・Dockerfile 作成・別ブラウザーへの移行を始めない。
- **ブラウザー実行ファイルがない／バージョン不整合**：同じコンテナで `node -p 'require("@playwright/test/package.json").version'` とエラーに示されたブラウザーパスを確認する。`npx playwright install`、`apt install`、ホストへのライブラリ展開、`LD_LIBRARY_PATH` の試行を連鎖させない。既存イメージで解決できなければ不足している組み合わせを報告する。
- **Vite 起動失敗**：最初の `webServer` エラー、`/work` へのマウント、依存関係、`corepack pnpm` の実行可否を確認する。別ポートのサーバーを増やして回避しない。
- **assertion／画像比較の失敗**：Docker 環境の失敗と区別し、対象テストの期待値・実際の描画・指定設計を調べる。通すためだけの `--update-snapshots`、期待値の緩和、テストの無効化は禁止。期待画像の更新が作業範囲に含まれる場合のみ、差分を確認して対象を限定して更新する。
- 同じ原因の失敗を無変更で繰り返さない。原因を示すログを一度取得し、根拠のある修正後に対象だけ再実行する。ログ全文・全件テスト・環境探索を繰り返さず、解消できない環境不足はその内容と未検証範囲を報告する。
- 通常は `--rm` で一時コンテナを片付ける。起動済みコンテナの無差別な停止・削除、`docker system prune` は行わない。

@RTK.md
