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

## 起動手順

1. Docker コンテナを起動する

```bash
docker compose up -d
```

2. マイグレーションを実行する

```bash
migrate --path src/migrations --database 'postgresql://admin:Wt9wCKTIqjgv17ED@localhost:5432/cacao?sslmode=disable' -verbose up
```

3. アプリケーションを起動する

```bash
go run src/main.go
```

### DB 接続環境変数

`src/infrastructure/database/postgres.go` の `ConfigFromEnv()` は以下の環境変数を読み込みます。未設定時は `compose.yml` のローカル開発値が既定値として使われます。

| 環境変数 | 既定値 | 用途 |
|----------|--------|------|
| `POSTGRES_HOST` | `localhost` | DB ホスト |
| `POSTGRES_PORT` | `5432` | DB ポート |
| `POSTGRES_USER` | `admin` | DB ユーザー |
| `POSTGRES_PASSWORD` | `Wt9wCKTIqjgv17ED` | DB パスワード |
| `POSTGRES_DB` | `cacao` | DB 名 |
| `POSTGRES_SSLMODE` | `disable` | SSL モード（本番は `require` 等） |
| `POSTGRES_MAX_OPEN_CONNS` | `25` | 接続プール上限 |
| `POSTGRES_MAX_IDLE_CONNS` | `5` | アイドル接続数 |

例: 本番で接続情報を変更する場合

```bash
POSTGRES_HOST=db.example.com \
POSTGRES_PORT=5432 \
POSTGRES_USER=cacao \
POSTGRES_PASSWORD=secret \
POSTGRES_DB=cacao \
POSTGRES_SSLMODE=require \
go run src/main.go
```
