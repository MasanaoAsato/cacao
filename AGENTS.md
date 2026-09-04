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

Docker に PlayWrightがあるので、必要ならそれを使うこと

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

@RTK.md
