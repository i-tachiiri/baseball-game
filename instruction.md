以下をそのまま **Claude Code に渡す指示**として使ってください（デプロイ担当向け）。
※ Durable Object の Pages へのバインド方法は「Wrangler設定」か「Cloudflare Dashboard」のどちらでも可能です。([Cloudflare Docs][1])

---

````markdown
# Claude Code 指示：Cloudflare Pages + Durable Objects をデプロイして2端末で遊べる状態にする

## ゴール

- このリポジトリ（Codexが生成した実装）を Cloudflare Pages にデプロイする
- Pages Functions + Durable Object (RoomDO) が動く
- 2端末で 4桁ルームに入り、対戦～再戦ができる

## 前提

- プロジェクトは Cloudflare Pages + Pages Functions 構成
- Durable Object は RoomDO（ルーム状態の唯一の正）
- DB(D1/KV/R2)は不要
- 通信はポーリング

---

## 1. 事前準備（ローカル実行環境）

1. Node.js / npm が使えることを確認
2. Wrangler を使えるようにする
   - `npm i -D wrangler`（リポジトリに入れる）または `npm i -g wrangler`

3. Cloudflare にログイン
   - `npx wrangler login`

---

## 2. Cloudflare Pages プロジェクト作成

A) Dashboardで作る（簡単）

- Cloudflare Dashboard → Workers & Pages → Pages → Create project
- Git連携 or Direct Upload どちらでもよい（Git連携推奨）

B) CLIで作る（可能なら）

- `npx wrangler pages project create <PROJECT_NAME>`

※ どちらかでPagesプロジェクトを作成する。

---

## 3. Wrangler 設定（Durable Object バインディング & migrations）

このプロジェクトに `wrangler.toml` または `wrangler.jsonc` を用意し、Durable Object bindings を設定する。
Pages Functions でも Wrangler設定でDurable Objectを定義できる。:contentReference[oaicite:1]{index=1}

### 3.1 wrangler.toml（例）

- project名や出力ディレクトリは実装に合わせて調整する。
- Functionsは `functions/` 配下を使う前提（Pages標準）

例：

```toml
name = "<PROJECT_NAME>"
compatibility_date = "2026-02-15"

pages_build_output_dir = "<BUILD_OUTPUT_DIR>" # 例: "dist" / "build" / "public"

[durable_objects]
bindings = [
  { name = "ROOM_DO", class_name = "RoomDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["RoomDO"]
```
````

Durable Objects は migrations が必要。migrations の概念と設定は公式参照。([Cloudflare Docs][2])

※ 注意：

- PagesでDOを使う場合、Dashboard側でBinding追加でも可能。([Cloudflare Docs][1])
- ただし migrations はWrangler側で管理するのが楽（このプロジェクトは v1 の create だけでOK）

---

## 4. Pages 側への Durable Object バインド（確実に通す手順）

どちらか片方でOK（両方やらない）。

### 4.A Wranglerでバインドする（推奨）

- 3 の wrangler.toml を使ってデプロイする（後述）

### 4.B Dashboardでバインドする

- Workers & Pages → 対象Pagesプロジェクト → Settings → Bindings → Add → Durable Object
- Variable name: `ROOM_DO`
- Durable Object class: `RoomDO`
  公式手順の通り。([Cloudflare Docs][1])

---

## 5. ビルド & デプロイ

### 5.1 ビルド手順確認

- `package.json` を確認し、ビルドコマンドと出力先（dist等）を特定する
- 出力先を `pages_build_output_dir` に合わせる

例：

- `npm ci`
- `npm run build`

### 5.2 デプロイ（CLI）

- `npx wrangler pages deploy <BUILD_OUTPUT_DIR> --project-name <PROJECT_NAME>`

Git連携の場合は、Cloudflare側のビルド設定で

- Build command: `npm ci && npm run build`
- Build output: `<BUILD_OUTPUT_DIR>`
  をセットして push でデプロイしてもよい。

---

## 6. 動作確認チェックリスト

1. デプロイURLにアクセスしてトップ画面が出る
2. ルーム作成 → 4桁が表示される
3. 別端末で同ルーム参加 → ロビーが開始状態になる
4. 3球の入力が進む（10秒未入力フォールバック含む）
5. HRで即終了、3球でHRなしは投手勝ち
6. 再戦：双方「もう1回！」押下でstate初期化
7. 切断：片方が閉じると「いなくなった」表示で停止、再アクセスで復帰

---

## 7. よくある詰まりポイント（優先順）

- `ROOM_DO` の binding 名が実装側（env.ROOM_DO）と一致しているか
- DO class name `RoomDO` が正しく export されているか
- migrations が無い/間違っていてデプロイで落ちる（v1/new_classesを用意）
- `pages_build_output_dir` が実際の出力とズレている
- Pages Functions のパスが想定通りか（/api/... のルーティング）

---

## 8. 追加（任意）

- Preview環境とProduction環境を分けたい場合は wrangler environments を使う（ただしDO bindingsは環境ごとに必要）。([Cloudflare Docs][3])

```

---

必要なら、Codex成果物の `package.json` / 出力ディレクトリ構成に合わせて、上の `<BUILD_OUTPUT_DIR>` とコマンドを確定した版に整形できます（ファイルツリー/該当ファイルを貼ってください）。
::contentReference[oaicite:6]{index=6}
```

[1]: https://developers.cloudflare.com/pages/functions/bindings/?utm_source=chatgpt.com "Bindings · Cloudflare Pages docs"
[2]: https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/?utm_source=chatgpt.com "Durable Objects migrations"
[3]: https://developers.cloudflare.com/durable-objects/reference/environments/?utm_source=chatgpt.com "Environments - Durable Objects"
