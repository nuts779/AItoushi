# Bug Reports - 投資

---

## BUG-001: macOS で「マクロ分析を更新」ボタンが exit=127 で失敗する

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-001 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts` |

### 再現手順
1. macOS（Homebrew Python・`python3` のみ存在し `python` は無い環境）で `npm run dev` を実行する
2. ステップ1「マクロ分析」タブを開く
3. 「🔄 マクロ分析を更新」ボタンを押す

### 期待動作
`fetch_macro.py` が実行され、記事取得 → Claude 分析 → `src/data.ts` 更新まで進む。

### 実際の動作
進捗パネルが「✗ エラーが発生しました / fetch_macro.py が失敗 (exit=127)」で停止する。

### 原因
`vite-plugin-macro.ts` が `spawn('python', ...)` と Windows 前提のコマンド名を直接指定していた。
macOS 12.3 以降は OS 標準の Python 2 が削除され、Homebrew も `python3` のみを提供するため、
`python` が解決できずシェルが 127（command not found）を返していた。
`shell: true` で起動しているため Node の `error` イベントではなく `close` イベントの
終了コードとして現れ、画面には「Python がインストール済みか確認してください」という
実態と異なる案内が表示され、原因が分かりにくい状態だった。

### 対応（2026-09-01）
- `PYTHON_BIN = process.env.PYTHON ?? 'python3'` を導入し、**既定を `python3`** に変更。
- 環境変数 `PYTHON` で上書き可能にした（Windows: `PYTHON=python npm run dev`）。
- exit=127 の場合に「コマンドが見つかりません。環境変数 PYTHON で指定してください」という
  原因と対処を進捗パネルに表示するようにした。
- 進捗ログ・エラーメッセージにも実際に使用したコマンド名を出すようにした。

### 検証
- `npx vite build` 成功（35 modules）。
- ボタンからのエンドツーエンド実行は未検証（実行すると `claude -p` が走り API 利用料が発生するため、
  ユーザー操作時に確認する）。

---

## BUG-002: `claude -p` にプロンプトが届かず、課金だけ発生して空振りする

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-002 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts` |

### 再現手順
1. macOS / Linux（シェルが bash / zsh）で `npm run dev` を実行する
2. ステップ1「マクロ分析」タブの「🔄 マクロ分析を更新」ボタンを押す
3. ① の記事取得は成功するが、② の Claude 分析が中身のない応答で終わる

### 期待動作
`CLAUDE_PROMPT` の全文が `claude -p` に渡り、スキーマどおりの JSON が返って `src/data.ts` が更新される。

### 実際の動作
Claude が「指示本文が届いていません。『以下を厳守してください。』の後が空です」と返答し、
`data.ts` は更新されないまま終了する。**プロンプトが届いていないにもかかわらず API 利用料は発生する**（実測: Opus 5 で出力303トークンのみの空振り応答）。

### 原因
```ts
spawn('claude', ['-p', CLAUDE_PROMPT, ...], { shell: true })
```
`shell: true` は引数をエスケープせずシェルのコマンド文字列に連結する（Node の DEP0190 警告が示すとおり）。
`CLAUDE_PROMPT` には改行・引用符・`**`・そして **バッククォート**（出力スキーマの ```json コードフェンス）が
含まれるため、bash / zsh ではバッククォートがコマンド置換として解釈され、プロンプトが破壊される。
結果として `-p` には先頭の断片しか渡らなかった。
Windows の cmd.exe はバッククォートを特別扱いしないため、開発元の環境では顕在化していなかった。

### 対応（2026-09-01）
- プロンプトを **argv ではなく stdin 経由**で渡すよう変更（`stdio[0]` を `'pipe'` にし、
  `claude.stdin.write(CLAUDE_PROMPT)` → `end()`）。stdin はシェルを経由しないため、
  改行・バッククォートを含む内容がどの OS でもそのまま届く。
- argv に残るのは `-p` `--permission-mode` `acceptEdits` の安全なトークンのみ。
- `claude.stdin` の error を握りつぶし、子プロセスが先に終了した場合に EPIPE で落ちないようにした。

### 検証
- `curl -N -X POST http://localhost:5173/api/fetch-macro` でエンドツーエンド実行し、
  step① → step② → step③ → done まで完走。
- `src/data.ts` が実際に更新されたことを確認（weather: 曇り→晴れ、
  latestArticleDate: 2026-04-12→2026-08-31、targetSectors が最新マクロの5業種に入れ替わり）。
- `npx vite build` 成功。
- 実使用トークン（Opus 5）: cache_create 36,132 / cache_read 70,462 / output 6,458。
  修正前の空振り（output 303）と比べ、実際に分析が行われたことが数値でも確認できる。

---

## BUG-003: update_data.py が pipelineMeta.runDate を更新せず、鮮度バナーが古い日付のままになる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-003 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/update_data.py` |

### 再現手順
1. `python3 scripts/fetch_stocks.py --industries ... ` でスクリーニングを実行する
2. `python3 scripts/update_data.py` で `src/data.ts` に反映する
3. ダッシュボードのヘッダー右上の鮮度バナーを見る

### 期待動作
本日取得したデータなので「✅ 鮮度: データ最新 ／ 本日更新」と表示される。

### 実際の動作
`screeningStocks` は最新に置き換わるのに、`pipelineMeta.runDate` が古い日付（`2026-04-21`）のまま残り、
バナーが「🔴 要更新 ／ 133日前に更新」＋「refresh推奨」を表示し続ける。
**データは最新なのに古いと警告する**という、本プロジェクトの「鮮度保証」方針と逆方向の誤情報になる。

### 原因
`update_data.py` は `screeningStocks` 配列のみを正規表現で置換しており、`pipelineMeta` を対象にしていなかった。

### 副次的に判明した不具合
同スクリプトの成功判定が `if new_content == content:` になっており、
**同じ結果を再反映したとき（内容が変わらないだけ）を「置換対象が見つかりません」と誤判定して `sys.exit(1)` していた**。
これにより後続処理が実行されず、冪等な再実行ができなかった。

### 対応（2026-09-01）
- `pipelineMeta.runDate` を実行日に更新する処理を追加。置換できなかった場合は警告を出す。
- 成功判定を `re.subn` の置換件数（`hit == 0`）に変更し、「マッチしなかった」と「内容が同一だった」を区別するようにした。
  内容が同一の場合は「（screeningStocks の内容は前回と同一でした）」と表示して処理を継続する。

### 検証
- 再実行して `pipelineMeta.runDate を 2026-09-01 に更新しました` を確認。
- `src/data.ts` の `runDate` が `2026-09-01` になり、経過0日＝バナー判定 `fresh`（✅データ最新）になることを確認。
- `npx vite build` 成功。dev server も HTTP 200 で稼働。

### 未対応（別件）
`edinetDetails` は依然として更新されない。詳細は `docs/specs/dashboard.md` の既知の課題 L-07 を参照。

---

## BUG-004: 通期予想純利益の億円換算が10分の1になる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-004 |
| 起票日 | 2026-09-02 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/PortfolioView.tsx` |

### 再現手順
1. ポートフォリオ画面の「取得財務データ一覧」を開く
2. 「通期予想純利益」列を見る

### 期待動作
三菱化工機（6331）の通期予想純利益 6,850百万円 → **68.5億** と表示される。

### 実際の動作
**6.8億** と、実際の10分の1で表示される。

### 原因
`EdinetRow` が `(d.forecastNetIncome / 1000).toFixed(1)` としていた。
EDINET DB の決算短信（earnings）の金額は**百万円**単位のため、億円にするには 100 で割るのが正しい。
（検証: `eps 123.97 × average_shares 18,539,448 = 2,298` が `net_income: 2298` と一致することから百万円と確定）

### 対応（2026-09-02）
除数を `/ 1000` → `/ 100` に修正。

### 備考
L-07 対応で `edinetDetails` に実データが入るまで、この列は旧サンプルデータでしか表示されておらず顕在化していなかった。

---

## BUG-005: スクリーニング画面のサマリーカードが固定値で、実行結果と食い違う

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-005 |
| 起票日 | 2026-09-03 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/ScreeningView.tsx`, `scripts/fetch_stocks.py`, `scripts/update_data.py` |

### 再現手順
1. `fetch_stocks.py` を任意の業種で実行し、`update_data.py` で反映する
2. ステップ2「スクリーニング」画面上部のサマリーカードを見る

### 期待動作
その実行の実測値（母集団・1段階目通過・深掘り件数）が表示される。

### 実際の動作
`母集団 3,745社 / JPXマスター全銘柄`、`1段階目 40社` が常に表示される。
2026-09-01 の実行では母集団872社・1段階目263社・深掘り40社だったため、**母集団が4倍以上に誇張**されていた。
母集団は `--industries` で指定した業種のみが対象であり、「JPXマスター全銘柄」という説明自体も誤り。

### 原因
`ScreeningView.tsx` のサマリーカードが文字列リテラルのハードコードだった。
またパイプライン側も件数を出力していなかったため、画面が参照できる実測値が存在しなかった。

### 対応（2026-09-03）
- `fetch_stocks.py`: 実行メタ（`universeCount` / `stage1Count` / `deepCount` / `outputCount` / `preset` / `industries` / `runDate`）を
  `scripts/screening_meta.json` に出力するようにした。
- `update_data.py`: `patch_pipeline_meta()` を追加し、上記を `data.ts` の `pipelineMeta` に反映するようにした。
  メタファイルが無い場合はスキップし、既存の実測値を消さない。
- `ScreeningView.tsx`: サマリーカードとプリセット表示を `pipelineMeta` 参照に変更。
  値が無い古い `data.ts` でも壊れないよう `count()` で `—` にフォールバックする。

### 副次的に修正した点
`update_data.py` が `pipelineMeta.runDate` に**反映日**（`date.today()`）を書き込んでいた。
数日前に取得したデータに今日の日付を貼ると鮮度バナーが緑になり、
「古い値を黙って残さない」という本プロジェクトの方針と逆の誤情報になる。
`screening_meta.json` の `runDate`（スクリーニング実行日）を優先するよう変更した。

### 検証
- 2026-09-01 実行分のメタを実測値で補完し、`pipelineMeta` に
  `universeCount: 872 / stage1Count: 263 / deepCount: 40 / preset: 'stable_defensive'` が入ることを確認。
- `runDate` が反映日（2026-09-03）ではなく実行日（2026-09-01）になることを確認。
- `npx vite build` 成功。dev server HTTP 200。

---

## BUG-006: 財務未取得（unavailable）が握りつぶされ、取得済みとして表示される

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-006 |
| 起票日 | 2026-09-04 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/update_data.py`, `src/types.ts`, `src/dataSource.ts`(新規), `src/ScreeningView.tsx`, `src/DeepDiveView.tsx`, `src/PortfolioView.tsx` |

### 再現手順
1. EDINET DB のレート制限到達などで一部銘柄の財務取得に失敗する状態でスクリーニングを実行する
2. `update_data.py` で反映し、鮮度バナーとスクリーニング画面を見る

### 期待動作
`data_sources.md` の設計方針どおり、取得できなかった銘柄は `dataSource='unavailable'` として記録され、
鮮度バナーに「財務未取得N件」が赤字で表示される。

### 実際の動作
- `update_data.py` が `dataSource` を `edinet_db` か **`irbank` に丸めていた**ため、
  `unavailable` が `data.ts` に到達せず、鮮度バナーの「財務未取得N件」は**常に0**だった。
- 廃止済みの IRBANK から取得できたかのように表示されるため、実態とも食い違っていた。
- `types.ts` の `dataSource` は `'edinet_db' | 'irbank'` の2値しか許容しておらず、
  `FreshnessBanner.tsx` の `=== 'unavailable'` は型上成立しない比較だった
  （`strict:false` かつビルド時に `tsc` を通さないため素通りしていた）。

### 副次的に判明した不具合
`update_data.py` の `parse_iso_date('')` が**今日の日付**を返すため、財務を取得できていない銘柄の
`irbankDate` に実行日が入っていた。深掘り画面は「財務データ基準日 2026-09-04（0日前）」と表示するため、
データが無いのに最新であるかのように見えていた。BUG-003 と同じ「鮮度について嘘をつく」系統の不具合。

### 対応（2026-09-04）
- `update_data.py`: `normalize_data_source()` を追加し、`unavailable` を他の値へ丸めないようにした
  （`irbank_fallback` のみ `irbank` に正規化、値が無い場合は安全側の `unavailable`）。
- `update_data.py`: 日付が無い銘柄の `irbankDate` に今日を入れず、空文字にした。
- `types.ts`: `Stock.dataSource` / `EdinetDetail.dataSource` に `'unavailable'` を追加。
- `src/dataSource.ts`（新規）: 取得元のラベル・バッジ配色を1か所に集約。3画面で重複していた分岐を統一し、
  未設定値は安全側（未取得）に倒す。
- 画面: スクリーニング＝「財務未取得」を赤字表示、深掘り＝取得元バッジと「基準日なし／取得できていません」、
  ポートフォリオ＝「財務未取得N社」バッジを追加。
- `pipelineMeta` に `edinetCount` / `unavailableCount` を実測値で反映するようにした
  （`patch_pipeline_meta()` は値が None のキーを書き換えない。null で実測値を潰さないため）。

### 検証
- 実データに `unavailable` が出ない（APIキーが有効で40社すべて取得成功）ため、合成データで生成経路を検証した。
  - `normalize_data_source()`: `unavailable` / `None` / `''` が `unavailable` として保持されることを確認。
  - `generate_stock_ts()`: `dataSource: 'unavailable'` かつ `irbankDate: ''` が出力されることを確認。
  - 取得済み銘柄では `irbankDate: '2026-08-15'` が保持されることを確認（退行なし）。
- 実データで `update_data.py` を再実行し、15社の反映と `pipelineMeta` の実測値を確認。
- `npx vite build` 成功。

---

## BUG-007: 3日前の株価を「データ最新」と表示する

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-007 |
| 起票日 | 2026-09-04 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `src/FreshnessBanner.tsx`, `src/DeepDiveView.tsx`, `scripts/refresh_prices.py`(新規), `scripts/update_data.py`, `vite-plugin-macro.ts`, `src/PriceRefreshButton.tsx`(新規) |

### 再現手順
1. スクリーニングを実行し、数日置いてからダッシュボードを開く

### 期待動作
株価が数日前のものであれば、鮮度バナーがその旨を警告する。

### 実際の動作
2026-09-01 取得の株価に対し 2026-09-04 時点で「✅ データ最新」と表示された。
このとき実際の株価は最大 **-3.6%**（ハードオフ 2,705→2,607円）乖離しており、
同じ株価から算出される PER・PBR も同様に古い値だった。
深掘り画面の「株価・指標（yfinance） 2026-09-01**（当日）**」も、
「（当日）」が文字列でハードコードされており日が経つほど誤表示になっていた。

### 原因
1. **株価と財務が `pipelineMeta.runDate` ひとつを共有していた。**
   株価は毎営業日変わり、財務は四半期に一度しか変わらない。閾値（`staleWarnDays: 7`）を
   どちらに合わせても、もう一方の鮮度が必ず嘘になる構造だった。
2. **株価だけを更新する手段が無かった。** 全体再実行は872社走査で約13分・EDINET 80リクエストを要し、
   株価鮮度のために回すには重すぎた。
3. カレンダー日数で判定していたため、営業日を考慮できていなかった。

### 対応（2026-09-04）
- **日付の分離**: `pipelineMeta` に `priceDate` / `priceFailedCount` を追加。
  `runDate` は財務（スクリーニング実行日）を表す。
- **鮮度バナーを2系統に分割**: 「株価」は**営業日ベースで2営業日以内=最新 / 4営業日以内=注意 / それ以降=要更新**、
  「財務」は従来どおりカレンダー日数（7日 / 30日）で判定する。
- **`scripts/refresh_prices.py`（新規）**: 現在ダッシュボードに載っている銘柄の株価・PER・PBR・配当・52週高安のみを
  取り直す。財務データ（equityRatio / trapFlag / scoreBreakdown / edinetDetail）には一切触れない。
  15銘柄で約12秒、EDINETリクエスト消費は0回。取得失敗銘柄は件数を記録し、古い値を新しく見せない。
- **画面から実行可能に**: `/api/refresh-prices` エンドポイントと `PriceRefreshButton` を追加。
  Claude を呼ばないため**課金は発生しない**。
- 深掘り画面の「（当日）」固定表記を `priceDate` 参照に変更。

### 副次的に修正した点
各スクリプトが `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, ...)` で stdout を上書きしており、
別スクリプトから import すると前のラッパーが破棄されて元の buffer ごと閉じられ、
`ValueError: I/O operation on closed file.` で落ちていた。
`sys.stdout.reconfigure(encoding='utf-8')` に統一（`fetch_stocks` / `update_data` / `edinet_fetcher` / `fetch_macro`）。

### 営業日判定の制限事項
祝日は考慮していない。祝日を営業日として数えるぶん経過日数は多めに出るが、
「実際より古く見える」方向の誤差であり、鮮度判定としては安全側に倒れる。

### 検証
- 営業日判定: 金曜取得→月曜確認=1営業日（✅最新／週明けの誤警告なし）、
  金曜→水曜=3営業日（⚠️）、9/1取得→9/4確認=3営業日（⚠️。修正前は「✅最新」だった）。
- `refresh_prices.py` 実行: 15銘柄更新・失敗0件・約12秒。ミクロン精密 +5.0% など実際の変動を反映。
- `/api/refresh-prices` をエンドツーエンドで実行し done まで完走。
- `npx vite build` 成功。
