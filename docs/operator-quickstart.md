# operator quickstart — app-manga

**この文書に書いてあるのは、実際に踏んだ手順と、その時に出た出力だけである。**
踏めなかったものは §7 に「やっていない」として分けてある。引用してある数値は
すべてこの手順を **push したブランチの新しい clone に対して** 走らせた時の
出力で、書いた作業ツリーの出力ではない。

前提: `git` / `node` / `npm` / `nbb`。ネットワークは §1・§3・§6 で要る。

---

## 1. 取得する

```bash
git clone git@github.com:cloud-itonami/app-manga.git
cd app-manga
git ls-files | wc -l          # → 22
```

## 2. 抽出物が壊れていないことを確かめる（ネットワーク不要）

この repo は `etzhayyim/root` からの抽出物なので、**最初に custody を見る。**

```bash
kbb --backend sci docs/verify-custody.cljk
```

```
SCANNED	15 保管ファイル / 7 追加物 / 3 検査
  ok   出所 tree（再構成 vs 記録）
         got  eeba3e7c966a9642c91c4cad0d149ca24aa9fdc0
  ok   保管ファイル数
         got  15
  ok   保管バイト数
         got  53273
PASS — 保管対象 15 ファイルは出所と同一
```

`--origin` を足すと出所 GitHub の実 tree とも突き合わせる（`gh` の認証が要る）。
こちらも 4/4 で ok になり、`etzhayyim/root@57d57fc4:60-apps/etzhayyim-project-manga`
の tree が同じ `eeba3e7c…` であることまで確認できる。

**この repo の custody は今日の時点で無傷である。** （兄弟の app-hakken は
ここが割れていた。割れていれば exit 1 で、どのファイルが動いたかまで出る。）

## 3. テストを走らせる —— 宣言された手順は通らない

**まず宣言どおりに試すこと。** 失敗の形を見ておかないと、次の回避策が
何を回避しているのか分からなくなる。

```bash
cd kotoba && npm install
```

```
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
npm error git dep preparation failed
```

`@etzhayyim/sdk` は `dist/` を publish すると宣言しているのに repo には `src/`
しか無く、ビルドを `prepare: tsc` に任せている。今の npm はそれを走らせない。
**この repo の package.json をどう直しても解決しない** —— `@etzhayyim/sdk-mock`
自身が sdk を `dependencies` に宣言しているので、mock だけ入れる経路も塞がって
いる（mock のソースは sdk を一度も import していない。宣言が余分なだけ）。

### 回避して 16 テストを走らせる

sdk は `import type` でしか使われていないので、**実行時には要らない**。
足場を repo の外に作って持ち込む:

```bash
# 1) vitest だけの足場を repo の外に作る
mkdir -p /tmp/manga-toolchain && cd /tmp/manga-toolchain
cat > package.json <<'EOF'
{ "name": "manga-scratch-toolchain", "private": true, "type": "module",
  "devDependencies": { "vitest": "^4.1.0", "typescript": "^5.3.3" } }
EOF
npm install                        # → added 45 packages

# 2) sdk-mock を手で置き、余分な dependencies 宣言だけ落とす
cd /tmp && git clone -q https://github.com/etzhayyim/com-etzhayyim-sdk-mock.git sdkmock
cd sdkmock && git checkout -q c857ff9be5310bf433bfe1e8d3c0f677e213d667

# 3) 足場を kotoba/ に持ち込む
cd <このリポジトリ>/kotoba
cp -R /tmp/manga-toolchain/node_modules .
mkdir -p node_modules/@etzhayyim/sdk-mock
cp -R /tmp/sdkmock/src /tmp/sdkmock/package.json node_modules/@etzhayyim/sdk-mock/
node -e "const p=require('./node_modules/@etzhayyim/sdk-mock/package.json'); \
         delete p.dependencies; \
         require('fs').writeFileSync('./node_modules/@etzhayyim/sdk-mock/package.json', JSON.stringify(p,null,2))"

# 4) 走らせる
./node_modules/.bin/vitest run
```

```
 RUN  v4.1.10

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  183ms
```

**`@etzhayyim/sdk` はどこにも存在しない状態で 16/16 が緑になる。** それが
「sdk は型のためだけに要る」の実証で、§5 の型検査と合わせて読むこと。

`node_modules/` は tracked ではないので、この足場は custody を動かさない
（§2 をもう一度走らせれば PASS のまま）。

## 4. README の数値を数え直す（ネットワーク不要）

```bash
kbb --backend sci docs/verify-docs-claims.cljk
```

```
SCANNED	22 tracked / 5 src / 1 test / 14 検査
  … 14 件すべて ok …
PASS — README.md の数値 14 件は実測と一致
```

数値を書き換えたら必ずこれを走らせること。**この検査は壊れることを確認して
から landed にしてある** —— 何をどう壊すと何が赤くなるかは
`docs/verify-docs-claims.cljk` を直接読むより、実際に 1 バイト足して走らせる
方が早い（例: `kotoba/src/types.ts` に 1 バイト追記 → src バイト数だけ FAIL）。

## 5. 型検査 —— この repo のコードは 0 件、10 件は全部 sdk 由来

sdk が無い状態で `kotoba/src` を型検査すると 10 件出る:

```bash
cd kotoba
./node_modules/.bin/tsc --noEmit --strict --module esnext \
  --moduleResolution bundler --target es2022 --skipLibCheck src/index.ts
# → exit 2、error 10 件（TS2307 が 4 / TS7006 が 6）
```

**この 6 件の implicit-any を「別の欠陥」と読まないこと。** `e` の型
（`Etzhayyim`）が解決できないので `e.read()` の戻りが `any` になり、その
`records` を回す callback の引数が implicit any になっているだけである。
sdk のソースを解決させると **`kotoba/src` の誤りは 0 件になる**:

```bash
git clone https://github.com/etzhayyim/com-etzhayyim-sdk.git /tmp/sdk
cd /tmp/sdk && git checkout 12314a0cc5ac2feb49dd9789d5c002398acb6988
# paths で @etzhayyim/sdk → /tmp/sdk/src/index.ts に向けて tsc を回す
```

その時に残る 76 件は **全部 sdk 自身のソース**（`encrypted.ts` 28 /
`index.ts` 21 / …）で、sdk の依存（`viem`・`@atproto/api` 等）が入って
いないことに由来する。app-manga のファイルは 1 件も出ない。

**`kotoba/` に tsconfig.json は無い。** したがって上のコマンドは「この repo が
宣言している型検査」ではなく、こちらで指定した設定である。`kotoba/package.json`
の scripts は `test` の 1 本だけ。

## 6. DNS を引く（人間がやる）

```bash
dig manga.etzhayyim.com +short      # → 空（status: NXDOMAIN）
dig pds.etzhayyim.com +short        # → 172.67.179.128 / 104.21.51.111
```

`manga.etzhayyim.com` は `wrangler.jsonc` の唯一の route であり、`ACTOR_DID`
`did:web:manga.etzhayyim.com` の基でもある。**引けない。**

**これは verifier に入れていない。** ネットワークの事実をオフラインで測ると
「圏外だった」が「無かった」と同じ値になり、検査が静かに緑になるため
（ADR-2608136000 の 5 問のうち 2 番目）。人間がここで引くこと。

## 7. やっていないこと

- **deploy していない。** `xrpc-adapter` は `npm install` の時点で
  `EUNSUPPORTEDPROTOCOL "workspace:*"` で止まる（workspace root がこの repo に
  無い）。依存が入らないので `wrangler deploy` まで到達しない。§6 のとおり
  route の DNS も引けないので、通しても着地先が無い。**踏めない手順は
  書かない。**
- **BPMN を実行していない。** Zeebe の task type が Worker の NSID と
  食い違っている（README の「見つけた食い違い」1）。どちらが正かは所有者の
  判断なので、実行して片方に寄せる前に決める必要がある。
- **切れたリンクを直していない。** 4 本とも抽出前のモノレポを指している。
  直すには「上流を参照し続けるのか、この repo で完結させるのか」を先に
  決める必要がある —— これは文書整形ではなく境界の決定である。
- **sdk の問題を upstream に出していない。** 選択肢は app-live が
  `docs/adr/2608180536` に記録済み（(a) dist 同梱で publish / (b) sdk-mock の
  dependencies から sdk を外す）。同じ原因なので、そちらが解決すれば
  この repo の §3 の回避策は不要になる。
