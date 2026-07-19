import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  chapterDid,
  chapterRkey,
  chapterSlug,
  titleRkey,
  type ChapterRecord,
  type ChapterStatus,
  type ChapterView,
  type CreateChapterInput,
  type CreateChapterOutput,
  type GetChapterInput,
  type GetChapterOutput,
  type ListChaptersInput,
  type ListChaptersOutput,
  type PublishChapterInput,
  type PublishChapterOutput,
  type TitleRecord,
  type UpdateChapterStatusInput,
  type UpdateChapterStatusOutput,
} from "./types.js";

const CHAPTER_COLLECTION = "com.etzhayyim.manga.chapter";
const TITLE_COLLECTION = "com.etzhayyim.manga.title";

const VALID_TRANSITIONS: Record<ChapterStatus, ChapterStatus[]> = {
  draft: ["in_review", "published", "archived"],
  in_review: ["approved", "published", "draft", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["archived"],
  archived: [],
};

function isValidChapterId(id: string): boolean {
  return /^[a-z0-9-]{1,32}$/i.test(id);
}

function canTransition(from: ChapterStatus, to: ChapterStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export async function createChapter(
  e: Etzhayyim,
  input: CreateChapterInput
): Promise<CreateChapterOutput> {
  if (
    !input.title_id ||
    !input.episode_title ||
    input.chapter_num === undefined ||
    input.chapter_num === null
  ) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const chapterId = `${input.title_id}-ch${input.chapter_num}`;
  if (!isValidChapterId(chapterId)) {
    return { status: "rejected", error: "invalidChapterId" };
  }
  const rkey = chapterRkey(chapterId);
  const existing = await e
    .read<ChapterRecord>({ collection: CHAPTER_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      id: chapterId,
      chapter_uri: existing.records[0].uri,
    };
  }
  const titleResp = await e
    .read<TitleRecord>({
      collection: TITLE_COLLECTION,
      rkey: titleRkey(input.title_id),
    })
    .catch(() => ({ records: [] }));
  if (!titleResp.records[0]?.value) {
    return { status: "rejected", error: "titleNotFound" };
  }
  const did = chapterDid(chapterId);
  const now = new Date().toISOString();
  const record: ChapterRecord = {
    did,
    title_id: input.title_id,
    chapter_num: input.chapter_num,
    episode_title: input.episode_title,
    status: "draft",
    asset_manifest_uri: input.asset_manifest_uri,
    page_count: input.page_count,
    created_at: now,
  };
  const receipt = await e.write({
    collection: CHAPTER_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    id: chapterId,
    chapter_uri: receipt.uri,
  };
}

export async function getChapter(
  e: Etzhayyim,
  input: GetChapterInput
): Promise<GetChapterOutput> {
  if (!input.id) return { error: "missingChapterId" };
  const resp = await e
    .read<ChapterRecord>({
      collection: CHAPTER_COLLECTION,
      rkey: chapterRkey(input.id),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: ChapterView = { ...r.value, chapter_uri: r.uri };
  return { chapter: view };
}

export async function listChapters(
  e: Etzhayyim,
  input: ListChaptersInput
): Promise<ListChaptersOutput> {
  if (!input.title_id) {
    return { chapters: [], total: 0, offset: 0, limit: 0 };
  }
  const offset = input.offset ?? 0;
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<ChapterRecord>({
    collection: CHAPTER_COLLECTION,
    limit: limit + offset,
  });
  const filtered = resp.records
    .filter((r) => {
      const v = r.value;
      if (v.title_id !== input.title_id) return false;
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .slice(offset, offset + limit);
  const items: ChapterView[] = filtered.map((r) => ({
    ...r.value,
    chapter_uri: r.uri,
  }));
  return {
    chapters: items,
    total: filtered.length,
    offset,
    limit,
  };
}

export async function publishChapter(
  e: Etzhayyim,
  input: PublishChapterInput
): Promise<PublishChapterOutput> {
  if (!input.chapter_id) {
    return { status: "rejected", error: "missingChapterId" };
  }
  const rkey = chapterRkey(input.chapter_id);
  const resp = await e
    .read<ChapterRecord>({ collection: CHAPTER_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  const existing = resp.records[0]?.value;
  if (!existing) {
    return { status: "rejected", error: "chapterNotFound" };
  }
  if (existing.status === "published") {
    return {
      status: "published",
      chapter_id: input.chapter_id,
    };
  }
  if (!canTransition(existing.status, "published")) {
    return {
      status: "invalidState",
      chapter_id: input.chapter_id,
      actual: existing.status,
    };
  }
  const merged: ChapterRecord = {
    ...existing,
    status: "published",
    published_at: new Date().toISOString(),
  };
  await e.write({
    collection: CHAPTER_COLLECTION,
    record: merged as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "published",
    chapter_id: input.chapter_id,
  };
}

export async function updateChapterStatus(
  e: Etzhayyim,
  input: UpdateChapterStatusInput
): Promise<UpdateChapterStatusOutput> {
  if (!input.chapter_id || !input.status) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = chapterRkey(input.chapter_id);
  const resp = await e
    .read<ChapterRecord>({ collection: CHAPTER_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  const existing = resp.records[0]?.value;
  if (!existing) {
    return { status: "rejected", error: "chapterNotFound" };
  }
  if (existing.status === input.status) {
    return {
      status: "updated",
      chapter_id: input.chapter_id,
    };
  }
  if (!canTransition(existing.status, input.status)) {
    return {
      status: "invalidState",
      chapter_id: input.chapter_id,
      actual: existing.status,
    };
  }
  const merged: ChapterRecord = {
    ...existing,
    status: input.status,
    asset_manifest_uri:
      input.asset_manifest_uri ?? existing.asset_manifest_uri,
    page_count: input.page_count ?? existing.page_count,
  };
  await e.write({
    collection: CHAPTER_COLLECTION,
    record: merged as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "updated",
    chapter_id: input.chapter_id,
  };
}
