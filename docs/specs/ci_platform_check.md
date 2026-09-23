# クロスプラットフォーム自動チェック（platform-check）

## 1. 機能概要

Windows と macOS の両方で動くことを、GitHub Actions 上で機械的に確認する仕組み。

`CLAUDE.md` の最重要ルールに「Windows / macOS 両対応」を掲げているが、
開発者はそれぞれ**片方の OS しか手元に持っていない**。
そのため「自分の環境では動いた」で完了とすると、BUG-018 のように
もう片方が丸ごと動かない状態を見逃す。

GitHub が数分だけ貸し出す Windows / macOS のマシンで同一のチェックを走らせ、
**両方が緑になること**を完了条件にする。

| 項目 | 内容 |
|---|---|
| ワークフロー | `.github/workflows/platform-check.yml` |
| 実行対象 | `windows-latest` / `macos-latest`（`fail-fast: false` で両方の結果を見る） |
| 起動条件 | `windows-check` ブランチへの push / Pull Request / 画面からの手動実行 |
| 費用 | 公開リポジトリのため**無料・時間無制限** |
| 外部依存 | **なし**。EDINET の APIキーは使わず、ネットワークにも出ない |

## 2. 入出力の定義

### 入力
リポジトリの内容のみ。シークレットも環境変数も不要。
Python が見つからない状況は、環境変数 `PYTHON` に**実在しないコマンド名**を渡して作る。

### 出力
各チェックの `✓` / `✗` の一覧と、ジョブの成功・失敗。
1件でも失敗すれば終了コード 1 でジョブが赤くなる。

## 3. 処理フロー

```
checkout
  ↓ setup-node 22 / setup-python 3.12
npm ci / pip install -r requirements.txt
  ↓
① npx tsc --noEmit              型チェック
② npx vite build                ビルド（CRLF・パス差の検出も兼ねる）
③ python -m compileall scripts  全 Python スクリプトの構文
④ python scripts/tests/tz_check.py           タイムゾーン（tzdata あり）
⑤ pip uninstall tzdata → 再実行              タイムゾーン（Windows のみ）
⑥ node scripts/tests/platform_check.mjs      OS依存箇所の実機チェック
```

## 4. 各チェックの内容

### `scripts/tests/tz_check.py`

Windows には OS のタイムゾーンDBが無く `ZoneInfo('Asia/Tokyo')` が失敗する。
これを黙って `None` にすると呼び出し側が `date.today()` に落ち、
**BUG-012（前営業日の終値に当日の日付が付く）が警告なしに復活する**。

| # | 確認内容 |
|---|---|
| 1 | `Asia/Tokyo` が解決できる（tzdata の有無どちらでも） |
| 2 | 東証のオフセットが `+09:00` |
| 3 | 場中 15:00 JST の約定が当日の日付になる |
| 4 | UTC と日付が異なる時刻（08:30 JST = 前日 23:30 UTC）でも **JST 基準**の日付になる |
| 5 | `ZoneInfo` を強制的に失敗させても**同じ日付**になる（固定オフセットでの代替） |
| 6 | 代替時に `None` を返さない（`date.today()` へ黙って落ちない） |
| 7 | 夏時間のある取引所（America/New_York）は代替せず `None` を返す |
| 8 | `scripts/**/*.py` の全てが標準出力を UTF-8 に設定している（BUG-020）。Windows の既定は cp1252 で、日本語を1行 print した時点で落ちるため |

固定タイムスタンプで判定するため、実行日やネットワークに左右されない。

項目8は BUG-020 を受けて追加した。初回の CI 実行でこのスクリプト自身が
`UnicodeEncodeError` で落ちたため、同じ忘れ方を今後 CI が止める。

### `scripts/tests/platform_check.mjs`

| # | 確認内容 | 狙い |
|---|---|---|
| 1 | `/api/env` がその OS の Python コマンド名を返す | BUG-019。Windows は `python`、macOS は `python3` |
| 2 | `isWindows` が `process.platform` と一致 | |
| 3 | `/api/env` が環境変数そのものを返していない | `.env.local` の APIキー漏洩防止 |
| 4-7 | 不正な入力を 400 で拒否（`;rm -rf /` 等4種） | コマンド注入の防止 |
| 8 | GET でのスクリーニング実行を 405 で拒否 | 誤操作の防止 |
| 9 | `PYTHON` 環境変数での上書きが反映される | |
| 10 | 株価更新で Python 未検出が案内文付きで報告される | `shell: true` 経路。**Windows の終了コードは 9009 ではなく 1 だった**（BUG-021）。終了コードに頼らず `where`/`which` で実地確認する方式に変更 |
| 11 | スクリーニングで同じく報告される | Windows は `shell: true`、他は `shell: false` → **ENOENT 経路** |
| 12 | 実行前バックアップのフォルダが作られる | |
| 13 | フォルダ名にコロンが含まれない | **Windows ではコロンを含む名前を作れない** |
| 14 | フォルダ名が `YYYY-MM-DDTHH-MM-SS` 形式 | |
| 15 | **Python が実在するときは「見つかりません」と言わない** | BUG-021 の誤検知防止。常に案内を出す実装にしてもテストが通ってしまうのを防ぐ。`screening_result.json` がある環境ではスキップされる（yfinance を呼んでしまうため） |

## 5. 使用ライブラリとその理由

新規ライブラリなし。Node 標準の `fetch` / `child_process` と Python 標準ライブラリのみ。

- **`npx` を使わず `node node_modules/vite/bin/vite.js` で dev server を起動する**。
  Windows の `npx` は `npx.cmd` であり、Node 18.20.2 以降は `shell: false` の
  `spawn` から `.cmd` を起動できない（BUG-018 #4）。テスト自身が同じ罠を踏まないようにした。
- **`--host 127.0.0.1` を明示する**。既定の `localhost` は環境によって `::1`(IPv6) に
  解決され、`fetch` の `127.0.0.1` と噛み合わない（macOS で実際に発生した）。
- **Playwright は使わない**。ブラウザを入れると実行時間とメンテナンスコストが増える。
  UI 側の表示はサーバの値に追従するだけなので、`/api/env` の検証で足りる。

## 6. 既知の課題・制限事項

| ID | 内容 |
|---|---|
| C-01 | **Microsoft Store のアプリ実行エイリアス**は再現できない。`python3` と打つとストアが開く挙動はデスクトップ版 Windows 固有で、Actions のランナーには無い。Windows メンバーの実機確認が必要 |
| C-02 | **conda / venv ラッパーの `.bat` 経由の Python 起動**は再現できない。ランナーの Python は setup-python が入れる素の Python |
| C-03 | フルスクリーニングの正常系（約13分・EDINET 最大80回）は実行しない。APIキーを CI に置かない方針のため、**失敗時の分岐のみ**を検証している |
| C-04 | `taskkill` による中止は、Python が実在する前提の経路なので CI では踏めていない |
| C-05 | バックアップのフォルダ名を組み立てる式が `vite-plugin-macro.ts` 側とテスト側で二重に存在する（純粋関数として切り出していないため）。実装を変えたらテストの正規表現も直す必要がある |
| C-06 | チェック実行のたびに `scripts/backup/` にフォルダが1つ増える（CI では使い捨てなので問題にならないが、ローカル実行時は手で消す） |

## 7. 使い方

### GitHub の画面から手動実行する
リポジトリの **Actions** タブ →「platform-check」→ **Run workflow**。

### 手元で同じものを走らせる
```bash
python scripts/tests/tz_check.py
node scripts/tests/platform_check.mjs
```
自分の OS の分しか確認できないが、push する前の素振りとして使える。
