# manga XRPC Adapter

CF Worker that exposes the 12 kotoba commands as XRPC endpoints.

## Endpoints

- `POST /xrpc/com.etzhayyim.manga.createTitle` — register manga title
- `GET /xrpc/com.etzhayyim.manga.getTitle?titleId=...` — title + chapters
- `GET /xrpc/com.etzhayyim.manga.listTitles?limit=...&offset=...` — paginated titles
- `GET /xrpc/com.etzhayyim.manga.searchTitles?q=...` — keyword search
- `POST /xrpc/com.etzhayyim.manga.addTag` — add tag to title
- `POST /xrpc/com.etzhayyim.manga.createChapter` — create chapter
- `GET /xrpc/com.etzhayyim.manga.getChapter?chapterNum=...` — chapter + pages
- `GET /xrpc/com.etzhayyim.manga.listChapters?titleId=...` — chapters for title
- `POST /xrpc/com.etzhayyim.manga.publishChapter` — publish chapter
- `POST /xrpc/com.etzhayyim.manga.updateChapterStatus` — chapter workflow
- `POST /xrpc/com.etzhayyim.manga.submitFromNarou` — ingest from Narou
- `POST /xrpc/com.etzhayyim.manga.recordReadingProgress` — reading history

## Setup

```bash
cd 60-apps/etzhayyim-project-manga/xrpc-adapter
npm install
```

## Development

```bash
npm run dev
# Worker listens on http://localhost:8787
```

## Deploy

```bash
wrangler deploy
# Deploys to manga.etzhayyim.com/xrpc/*
```

See ADR-2605210000 for design context.
