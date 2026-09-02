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

### プロバイダーの切り替え

`.env` の `IMAGE_GENERATOR_DRIVER` を変更してアプリケーションを再起動すると、以後に受け付ける画像生成要求のプロバイダーを切り替えられます。旅程本文を生成する `LLM_DRIVER` とは別の設定です。

| 値 | 画像の生成元 | 必須設定 |
| --- | --- | --- |
| `stub` | 固定PNG。ローカル開発・E2E確認用 | なし |
| `comfyui` | ローカルのComfyUI | `COMFYUI_BASE_URL`、workflow・manifestのパス |
| `openrouter` | OpenRouterの画像生成API | `OPENROUTER_API_KEY`、`OPENROUTER_IMAGE_MODEL` |

`IMAGE_GENERATOR_DRIVER` は起動時に一度だけ読み込まれるため、同じプロセスのままでは切り替わりません。値を変更したら、workerを含むアプリケーションを再起動してください。

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

### OpenRouter手動E2E

OpenRouterで画像を生成するには、画像生成に対応したモデルIDを指定します。

```dotenv
IMAGE_GENERATOR_DRIVER=openrouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_IMAGE_MODEL=provider/image-model
IMAGE_GENERATION_TIMEOUT=180s
```

`OPENROUTER_API_KEY` は旅程本文のOpenRouter設定と共有できますが、画像には `OPENROUTER_IMAGE_MODEL` を使います。本文用の `OPENROUTER_MODEL` は画像モデルの代わりにはなりません。モデルIDにURLや先頭が `~` の値は指定できず、画像モデルの自動検出やHTTP APIからの上書きも行いません。

設定後の画像生成リクエスト、状態確認、PNG取得の手順は [Stub E2E](#stub-e2e) と同じです。カバーには縦長、挿絵には横長の画像を要求し、返却された画像は保存前にPNG形式・バイト数・寸法を検証します。

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
