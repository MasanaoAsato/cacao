# cacao

Go で DDD + オニオンアーキテクチャを学ぶための最小構成です。

## 起動

1. PostgreSQLを起動します。

```bash
docker compose up -d db
```

2. スキーマを作成します。

```bash
migrate --path src/migrations --database 'postgresql://admin:Wt9wCKTIqjgv17ED@localhost:5432/cacao?sslmode=disable' -verbose up
```

3. 必要に応じて設定を作成し、アプリケーションを起動します。

```bash
cp .env.example .env
go run ./src
```

`IMAGE_GENERATOR_DRIVER` の既定値は `stub` です。GPUやComfyUIがない環境でも、固定PNGを使って画像生成フローを確認できます。

終了時は `SIGINT` または `SIGTERM` を受け取り、新しいworker処理を止めてからHTTP server、実行中のworker、PostgreSQL接続を順に閉じます。

## 画像生成の設定

実行時の環境変数は [.env.example](/home/ubuntu/workspace/cacao/.env.example) にまとめています。設定は起動時に検証され、不正なdriver・期間・worker値ではHTTPリクエストを受け付ける前に終了します。

### Stub E2E

`stub` のまま起動した場合は、次の順にAPIを呼ぶと画像生成を確認できます。

```bash
curl -X POST http://localhost:8080/api/v1/journey-requests \
  -H 'Content-Type: application/json' \
  -d '{"departure_city":"東京","departure_country":"日本","destination_city":"沖縄","destination_country":"日本","start_date":"2026-08-01T00:00:00Z","end_date":"2026-08-03T00:00:00Z","amount":100000,"currency":"JPY"}'

curl -X POST http://localhost:8080/api/v1/journey-requests/{request_id}/images \
  -H 'Content-Type: application/json' \
  -d '{"slots":[{"purpose":"cover","ordinal":1}]}'

curl http://localhost:8080/api/v1/journey-requests/{request_id}/images
curl http://localhost:8080/api/v1/journey-images/{image_id}/content -o cover.png
```

一覧が `pending` または `processing` の間は `202` が返ります。`ready` になった画像のcontent URLからPNGを取得できます。同じslotへの要求は冪等です。

### ComfyUI手動E2E

提供された API Format JSON を使う場合は、ComfyUIをローカルで起動し、必要なモデルとnodeを配置したうえで次の設定にします。

```dotenv
IMAGE_GENERATOR_DRIVER=comfyui
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_WORKFLOW_PATH=/absolute/path/to/config/comfyui/journey_image_api.json
COMFYUI_MANIFEST_PATH=/absolute/path/to/config/comfyui/journey_image_manifest.json
```

workflowとmanifestは起動時に読み込まれ、node ID・input名・出力nodeまで検証されます。ComfyUIのURL、モデル、workflow JSON、保存ファイル名をHTTPリクエストから指定することはできません。

## DB設定
`POSTGRESQL_URL` を設定した場合は接続URIを優先します。空の場合は、以下の `POSTGRES_*` 個別設定（未設定なら `compose.yml` 相当の既定値）を使います。

未設定時は `compose.yml` のローカル開発値が既定値として使われます。

| 環境変数 | 既定値 | 用途 |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | DBホスト |
| `POSTGRES_PORT` | `5432` | DBポート |
| `POSTGRES_USER` | `admin` | DBユーザー |
| `POSTGRES_PASSWORD` | `Wt9wCKTIqjgv17ED` | DBパスワード |
| `POSTGRES_DB` | `cacao` | DB名 |
| `POSTGRES_SSLMODE` | `disable` | SSLモード |
| `POSTGRES_MAX_OPEN_CONNS` | `25` | 接続プール上限 |
| `POSTGRES_MAX_IDLE_CONNS` | `5` | アイドル接続数 |

## 開発用コマンド

```bash
go test ./...
go test -race ./...
golangci-lint fmt --diff
golangci-lint run
```
