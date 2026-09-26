# 機能仕様書 — 「銘柄を選び直す」ボタン（フルスクリーニング実行）

作成: 2026-09-17

## 1. 機能概要

スクリーニング画面から**フルスクリーニングを実行**し、銘柄15社を選び直す。
従来この経路だけCLI（`python3 scripts/fetch_stocks.py ...`）でしか実行できず、
**銘柄を入れ替えるという最も重要な更新がUIから触れない**状態だった。

### なぜ他の更新と扱いが違うか

| 経路 | 所要 | EDINET消費 | 銘柄の入れ替え | UI |
|---|---|---|---|---|
| 株価を更新 | 約12秒 | 0回 | ✕ | ボタン（即実行） |
| マクロ分析を更新 | 数十秒 | 0回（Claude課金あり） | ✕ | ボタン（即実行） |
| **フルスクリーニング** | **約10〜13分** | **最大80回**（無料枠100回/日） | **○** | **ボタン＋確認ダイアログ** |

誤操作の代償が大きい（1日分のAPI枠を失う・現在の15社が消える）ため、即実行はしない。

## 2. 入出力

### 入力
| 項目 | 取得元 | 検証 |
|---|---|---|
| `industries` | `data.ts > targetSectors[].code`（マクロ分析が推す業種） | `^\d{4}(,\d{4})*$` |
| `preset` | `data.ts > pipelineMeta.preset` | `^[a-z_]{1,32}$` |
| `top` | 固定 `15` | 1〜50の整数 |
| `force` | 同日2回目のときクライアントが付与 | `1` のみ |

### 出力
`scripts/screening_result.json` / `scripts/screening_meta.json` → `src/data.ts`（`update_data.py` が反映）

## 3. 処理フロー

```
[ボタン] 銘柄を選び直す
   ↓ クリックしても実行しない
[確認ダイアログ] 所要時間・EDINET消費・銘柄入れ替え・対象業種・前回実行日を提示
   ↓ チェックボックスに同意しないと「実行する」は押せない
POST /api/run-screening
   ↓ ① 無効化フラグの確認（403）
   ↓ ② 入力検証（400）
   ↓ ③ 二重起動の拒否（409）
   ↓ ④ 同日2回目は force 無しなら拒否（429）
   ↓ ⑤ data.ts / screening_result.json / screening_meta.json を scripts/backup/<ISO日時>/ へ退避
   ↓    （退避に失敗したら実行しない）
fetch_stocks.py（SSEでログを逐次配信）
   ↓ 成功時のみ
update_data.py → data.ts 更新 → Vite HMR で画面リロード
```

## 4. 誤操作対策（多重防御）

| # | 対策 | 実装箇所 |
|---|---|---|
| 1 | クリックで即実行せず確認ダイアログを挟む | `ScreeningRunButton.tsx` |
| 2 | ダイアログのチェックボックスに同意するまで実行ボタンが無効 | 同上 |
| 3 | 二重起動の禁止（サーバ側 `screeningInFlight` ロック。複数タブでも1本） | `vite-plugin-macro.ts` |
| 4 | 同日2回目は `force=1` が無いと 429。ダイアログでも赤字で警告 | 同上 |
| 5 | 実行前バックアップ。失敗したら実行自体を中止 | `backupBeforeScreening()` |
| 6 | `POST` 限定（`GET` を許すとプリフェッチやURL直打ちで発火する） | 同上 |
| 7 | 業種コード等を厳格検証し、`shell: false` で `spawn`（コマンド注入の防止） | 同上 |
| 8 | 「中止」ボタンでプロセスを停止。`fetch_stocks.py` は最後にまとめて書くため途中停止でもデータは壊れない | 双方 |

## 5. 無効化と削除

### 一時的に止める（コード変更なし）
`.env.local` に次の1行を書いてブラウザを再読込する。

```
DISABLE_SCREENING_RUN=1
```

ボタンが消え、`POST /api/run-screening` も 403 を返す。
毎リクエストで読み直すため dev server の再起動は不要。
スイッチはこの1箇所だけ（クライアント側に別のフラグは置いていない。
片方だけ生きる事故を避けるため、有効/無効は `GET /api/screening-status` で問い合わせる）。

### 完全に削除する
次の3点を消せば元の状態に戻る。他のファイルには依存がない。

1. `src/ScreeningRunButton.tsx` — ファイルごと削除
2. `src/ScreeningView.tsx` — `import ScreeningRunButton ...` の行と `<ScreeningRunButton />` の行
3. `vite-plugin-macro.ts` — 次の2ブロック
   - `BEGIN/END: フルスクリーニング実行の補助`（`screeningInFlight` / `isScreeningRunDisabled()` / `readLastScreeningDate()` / `backupBeforeScreening()`）
   - `BEGIN/END: フルスクリーニング実行エンドポイント`（`/api/screening-status` と `/api/run-screening`）

併せて `import { ... mkdirSync, copyFileSync, existsSync }` と `.gitignore` の `scripts/backup/` も不要になる。

`GET /api/env`（Python の実行コマンド名を返す）は **このブロックの外**（`configureServer` の先頭）に置いてある。
マクロ画面のコマンド表示が依存しているため、上記の削除では消さないこと（BUG-019）。

## 6. 使用ライブラリとその理由

新規ライブラリは追加していない。既存の `/api/refresh-prices` と同じ構成
（Vite dev middleware + `node:child_process.spawn` + SSE）を踏襲した。
SSEは13分間ログを流し続ける用途に合い、WebSocketを持ち込むほどの要件がない。

## 7. 既知の課題・制限事項

| ID | 内容 |
|---|---|
| S-01 | **dev server 専用**。Vite の dev middleware で実装しているため `npm run build` した静的ファイルでは動かない（他の2ボタンも同じ） |
| S-02 | EDINETの残リクエスト数を実際に問い合わせる手段がないため、「最大80回」という上限の提示にとどまる。キャッシュが効けば実際の消費は大幅に減る（実測: 同一40社の再実行で2回） |
| S-03 | 実行中にブラウザを閉じると「中止」と同じ扱いでプロセスが停止する。バックグラウンド継続は未対応 |
| S-04 | `scripts/backup/` は自動削除しない。増えたら手で消す |
| S-05 | 対象業種は常に現在の `targetSectors`。業種を選んで実行するUIはない（プリセット変更も同様・`dashboard.md` L-06） |
