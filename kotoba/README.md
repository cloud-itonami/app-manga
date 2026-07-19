# manga kotoba

Phase E Option B reference implementation of manga on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), manga migrates from vendor's `createKyselyDb` pattern (RW direct write) to **Option B** — PDS XRPC writes via `@etzhayyim/sdk e.write()`.

Coverage: **12 of 12 (100%)** manga canonical XRPC commands ported.

| Tier | Commands | Coverage |
|---|---|---|
| Title | createTitle, getTitle, listTitles, searchTitles, addTag | 5/5 |
| Chapter | createChapter, getChapter, listChapters, publishChapter, updateChapterStatus | 5/5 |
| Reader | recordReadingProgress | 1/1 |
| Ingest | submitFromNarou | 1/1 |

All 12 canonical manga lexicons now have kotoba reference impl. Wire-up
to a Worker / LangServer pod XRPC handler is the next operator task per
ADR-2605203000.

## Authority-chain DIDs (per manga CLAUDE.md)

```
did:web:manga.etzhayyim.com                    — controller
did:web:manga.etzhayyim.com:title:{titleId}    — Title tier
did:web:manga.etzhayyim.com:chapter:{chId}     — Chapter tier
did:web:manga.etzhayyim.com:reading:{progId}   — Reading progress
```

## Collection mapping

| Collection | Tier | Rkey pattern |
|---|---|---|
| com.etzhayyim.manga.title | Title | title-{titleId-slug} |
| com.etzhayyim.manga.chapter | Chapter | chapter-{chapterId-slug} |
| com.etzhayyim.manga.reading | Reader | reading-{progressId-slug} |

## Storage

Chapter assets are content-addressed on external CDN (asset_manifest_uri pointer). Metadata stored in PDS collections per Option B pattern.

## Chapter status state machine

```
draft → in_review → approved → published → archived
      ↘ archived   ↙         ↙           ↙
       (any state)
```

Valid transitions enforced in `updateChapterStatus` and `publishChapter`.

## Pattern translation (Option B)

| Vendor (`manga.etzhayyim.com`) | etzhayyim (this PR) |
|---|---|
| `const db = createKyselyDb();` | `import type { Etzhayyim } from "@etzhayyim/sdk"` |
| `db.insertInto("vertex_manga_title").values({...}).execute()` | `e.write({ collection: "com.etzhayyim.manga.title", record, rkey })` |
| `db.selectFrom("vertex_manga_chapter").where("title_id","=",id).execute()` | `e.read({ collection, rkey: \`chapter-${chapterSlug(id)}\` })` |

## Usage

```ts
import { Etzhayyim } from "@etzhayyim/sdk";
import {
  createTitle,
  getTitle,
  createChapter,
  publishChapter,
  addTag,
} from "@etzhayyim/manga-kotoba";

const e = new Etzhayyim({
  did: "did:web:manga.etzhayyim.com",
  pdsUrl: "https://pds.etzhayyim.com",
  l2RpcUrl: "https://mainnet.base.org",
});

// Create title
const titleRes = await createTitle(e, {
  title: "Adventure Quest",
  genre: "fantasy",
  description: "Epic fantasy manga series",
});
// → { status: "registered", id: "adventure-quest", title_uri: "at://..." }

// Create chapter
const chapterRes = await createChapter(e, {
  title_id: "adventure-quest",
  chapter_num: 1,
  episode_title: "The Beginning",
  asset_manifest_uri: "ipfs://Qm...",
  page_count: 20,
});
// → { status: "registered", id: "adventure-quest-ch1", chapter_uri: "at://..." }

// Publish chapter
const pubRes = await publishChapter(e, {
  chapter_id: "adventure-quest-ch1",
});
// → { status: "published", chapter_id: "adventure-quest-ch1" }

// Add tag
const tagRes = await addTag(e, {
  title_id: "adventure-quest",
  tag: "completed",
});
// → { status: "registered", title_id: "adventure-quest", tag: "completed" }
```

## Why Option B for manga

Per ADR-2605203000 Phase E decision matrix:
- **Catalog**: title + chapter metadata + CDN asset pointers (open standards)
- **Write cadence**: low-to-moderate — author publishes chapters episodically
- **Query pattern**: by title / chapter sequence / tags (indexed at Phase 3)

Option A (vendor RW mirror) rejected — ADR-2605172000 mandates kotoba.
Option C (hybrid assets) — blobs on CDN, metadata on PDS (this PR).

## Related

- [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md) — Phase E write-target options
- [kiyo kotoba](../../etzhayyim-project-kiyo/kotoba/) — sibling Option B reference (12/12 ✓)
- [sbom kotoba](../../etzhayyim-project-sbom/kotoba/) — Option B reference (17/N)
- [hanrei kotoba](../../etzhayyim-project-hanrei/kotoba/) — Option B reference (31/31 ✓)
