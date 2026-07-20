# cacao

Go で DDD + オニオンアーキテクチャを学ぶための最小構成です。

## 進め方

1. ドメイン層に集約・値オブジェクト・ルールを置く
2. テスト先行で振る舞いを固定する
3. ユースケース層でアプリケーションルールを組む
4. インフラ層で DB や HTTP などを実装する
5. 依存関係を外側に向けて整理する

## 現在の構成

- internal/domain/model: 集約やドメインルール
- internal/domain/value_object: 値オブジェクトを置く予定
- internal/usecase: ユースケース層
- internal/adapter: 入出力アダプター層
- internal/infrastructure: DB や外部サービス実装

# 導入
goplus を使って依存関係を管理しています。

```bash
go install github.com/goplus/gop@latest

## 実行

```bash
go test ./...
```

# migration
`brew install golang-migrate`

## スキーマの作成
`migrate create -ext sql -dir <作成するディレクトリ> -seq <名前>`

## マイグレーションの実行（進める）
`migrate --path src/migrations --database 'postgresql://admin:Wt9wCKTIqjgv17ED@localhost:5432/cacao?sslmode=disable' -verbose up`

## マイグレーションの実行（進める 1）
`migrate --path src/migrations --database 'postgresql://admin:Wt9wCKTIqjgv17ED@localhost:5432/cacao?sslmode=disable' -verbose up 1`

## マイグレーションの実行（戻す）
`migrate --path src/migrations --database 'postgresql://admin:Wt9wCKTIqjgv17ED@localhost:5432/cacao?sslmode=disable' -verbose down`
