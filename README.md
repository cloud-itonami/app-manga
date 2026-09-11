# app-manga

**漫画の出版ワークフロー（作品 → 話 → 公開 → 既読）を AT Protocol の PDS に
記録するための参照実装。** 12 のコマンドが 3 つの面 —— TypeScript 関数
（`kotoba/`）、Cloudflare Worker の XRPC エンドポイント（`xrpc-adapter/`）、
BPMN プロセス定義（`bpmn/`）—— に同じ形で並んでいる。

この repo は **`etzhayyim/root` の `60-apps/etzhayyim-project-manga` から
抽出したもの**で、抽出時の 15 ファイルはバイト単位で保管されている
（`migration.edn` が出所を pin し、`docs/verify-custody.cljk` が検査する）。

**動かす手順は [`docs/operator-quickstart.md`](docs/operator-quickstart.md)。
そこに書いてあるのは実際に踏んだ手順だけで、踏めなかったものは踏めないと
書いてある。** この README の数値は `kbb --backend sci docs/verify-docs-claims.cljk` が
毎回数え直す（14 件）。

## 今日ここに在るもの（実測）

| | |
|---|---|
| tracked | 22 ファイル / うち保管対象 15（53,273 B、出所 tree `eeba3e7c` と一致） |
| `kotoba/src` | 5 ファイル・21,166 B —— 12 コマンドの実装 |
| `kotoba/test` | 1 ファイル・6,555 B —— **16 テスト、全部通る** |
| `xrpc-adapter/src` | 5,164 B —— 12 route の CF Worker |
| `bpmn/manga.bpmn` | 12,306 B —— 12 プロセス（serviceTask 12 / gateway 0） |

12 コマンドの内訳は Title 5（create / get / list / search / addTag）・
Chapter 5（create / get / list / publish / updateStatus）・Ingest 1
（submitFromNarou）・Reader 1（recordReadingProgress）。
`kotoba/README.md` の「12 of 12 (100%)」は **本当**で、3 面とも 12 で揃っている。

## 動く。ただし宣言された手順では動かない

**テストは通る。** 16/16 が緑で、しかも `@etzhayyim/sdk` を **1 バイトも
置かずに**通る —— `kotoba/src` の 4 ファイルは sdk を `import type` でしか
使っておらず、値として import している箇所は 0 だから。実行時に要るのは
`@etzhayyim/sdk-mock` だけ。

**にもかかわらず、宣言された install はどちらも失敗する。** 実測:

| 手順 | 結果 |
|---|---|
| `cd kotoba && npm install` | `EALLOWSCRIPTS` / `git dep preparation failed` |
| `cd xrpc-adapter && npm install` | `EUNSUPPORTEDPROTOCOL "workspace:*"` |

理由は別々で、どちらも**この repo の中では直せない**:

1. **`@etzhayyim/sdk` は `dist/` を publish すると宣言しているのに、repo には
   `src/` しか無い。** ビルドは `prepare: tsc` に任されており、今の npm は
   project-scoped install でそのライフサイクルを走らせない。しかも
   `@etzhayyim/sdk-mock` が —— **一度も import していないのに** ——
   sdk を自分の `dependencies` に宣言しているので、mock だけ入れることも
   できない。**修正は upstream 側**（app-live の
   `docs/adr/2608180536` が選択肢を 2 つ記録している）。
2. **`xrpc-adapter/package.json` は `"@etzhayyim/manga-kotoba": "workspace:*"`
   を宣言しているが、この repo に workspace root が無い。** 抽出でモノレポの
   root package.json が付いてこなかった。`workspaces` を宣言した
   package.json はこの repo に 0 件（検査項目に入れてある）。

回避して 16 テストを実際に走らせる手順は quickstart §3 に書いた。

## 見つけた食い違い —— 直していない

**どれも「仕様として読める」ものなので、勝手に直さず記録した。**
直すかどうかは所有者の判断で、直すときは何が正かを先に決める必要がある。

1. **NSID が 2 通りある。** BPMN の 12 プロセスは
   `com.etzhayyim.apps.manga.*`（`apps.` 有り）を task type にしているが、
   Worker と kotoba は `com.etzhayyim.manga.*`（`apps.` 無し）を使う。
   コード側に `etzhayyim.apps` は **0 件**。同じ 12 コマンドが、
   **噛み合わない 2 つの名前空間**で宣言されている。
2. **`manga.etzhayyim.com` は NXDOMAIN。** これは `wrangler.jsonc` の
   唯一の route（`manga.etzhayyim.com/xrpc/*`）であり、`ACTOR_DID`
   `did:web:manga.etzhayyim.com` の基でもある。`etzhayyim.com` /
   `pds.etzhayyim.com` / `kotoba.etzhayyim.com` は引ける。
   （DNS は verifier では見ない。理由は `docs/verify-docs-claims.cljk`
   の冒頭に書いた。quickstart §6 に人間が引く手順を置いた。）
3. **`kotoba/README.md` の相対リンク 4 本が全部切れている。** 抽出前の
   モノレポの位置を指している。うち ADR へのリンクは **2 重に外れて**
   いて、パスが違ううえ拡張子も違う —— 上流の実体は
   `2605203000-kotoba-write-target-options.**edn**` である
   （ワークスペースが `.md` を `.edn` に移した。ADR-2607171600）。
4. **`xrpc-adapter/README.md` の Setup は
   `cd 60-apps/etzhayyim-project-manga/xrpc-adapter` と言う。** 抽出前の
   パスで、この repo には存在しない。
5. **`kotoba/` に tsconfig.json が無い。** `xrpc-adapter/` には在る。
   したがって kotoba 側に「宣言された型検査」は無く、`package.json` の
   scripts は `test` だけ。

**この repo 自身の TypeScript は健全である。** sdk のソースを解決させて
型検査すると、`kotoba/src` の誤りは **0 件**になる。sdk 抜きで出る 10 件
（TS2307 4 + TS7006 6）は**全部その 4 つの欠損 module から派生したもの**で、
implicit-any は独立した欠陥ではない —— 手順は quickstart §5。

## 検査

```bash
kbb --backend sci docs/verify-custody.cljk             # 抽出物が出所とバイト一致か（--origin で GitHub とも）
kbb --backend sci docs/verify-docs-claims.cljk         # この README の数値 14 件を数え直す
```

どちらも exit 0=PASS / 1=FAIL / **3=判定できなかった**。3 を 0 と混ぜないのは、
「測れなかった」が「問題なし」に化けるのを防ぐため（ADR-2608136000）。

## 構成

```
kotoba/          12 コマンドの TypeScript 実装 + vitest（16 テスト）
xrpc-adapter/    同じ 12 個を XRPC endpoint として出す CF Worker
bpmn/            同じ 12 個の BPMN プロセス定義（NSID は上記のとおり別系統）
docs/            quickstart と 2 つの検査
migration.edn    出所の pin（etzhayyim/root@57d57fc4）
README.edn       機械可読なメタデータ（:kind :app、境界宣言）
```
