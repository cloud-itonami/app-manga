import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  chapterDid,
  chapterRkey,
  chapterSlug,
  titleDid,
  titleRkey,
  titleSlug,
  type ChapterRecord,
  type SubmitFromNarouInput,
  type SubmitFromNarouOutput,
  type TitleRecord,
  type RecordReadingProgressInput,
  type RecordReadingProgressOutput,
  readingProgressDid,
  readingProgressRkey,
  readingProgressSlug,
} from "./types.js";

const TITLE_COLLECTION = "com.etzhayyim.manga.title";
const CHAPTER_COLLECTION = "com.etzhayyim.manga.chapter";
const READING_COLLECTION = "com.etzhayyim.manga.reading";

function generateNanoid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function submitFromNarou(
  e: Etzhayyim,
  input: SubmitFromNarouInput
): Promise<SubmitFromNarouOutput> {
  if (!input.narou_title_id) {
    return { status: "rejected", error: "missingNarouTitleId" };
  }
  const titleId = generateNanoid();
  const titleRk = titleRkey(titleId);
  const existing = await e
    .read<TitleRecord>({ collection: TITLE_COLLECTION, rkey: titleRk })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "rejected",
      error: "titleAlreadyExists",
      title_id: titleId,
    };
  }
  const titleDidValue = titleDid(titleId);
  const now = new Date().toISOString();
  const titleRecord: TitleRecord = {
    did: titleDidValue,
    title: input.title ?? `Title ${titleId}`,
    series_id: input.narou_title_id,
    description: input.description,
    genre: input.genre,
    status: "active",
    thumbnail_key: input.thumbnail_key,
    coin_price: 0,
    wait_free_hours: 0,
    chapter_count: input.narou_chapter_id ? 1 : 0,
    tags: [],
    created_at: now,
  };
  const titleReceipt = await e.write({
    collection: TITLE_COLLECTION,
    record: titleRecord as unknown as Record<string, unknown>,
    rkey: titleRk,
  });
  let chapterId: string | undefined;
  if (input.narou_chapter_id && input.episode_title) {
    const chId = `${titleId}-ch1`;
    const chapterDidValue = chapterDid(chId);
    const chapterRecord: ChapterRecord = {
      did: chapterDidValue,
      title_id: titleId,
      chapter_num: 1,
      episode_title: input.episode_title,
      status: "published",
      asset_manifest_uri: input.asset_manifest_uri,
      page_count: input.page_count,
      published_at: now,
      created_at: now,
    };
    const chapterReceipt = await e.write({
      collection: CHAPTER_COLLECTION,
      record: chapterRecord as unknown as Record<string, unknown>,
      rkey: chapterRkey(chId),
    });
    chapterId = chId;
  }
  return {
    status: "registered",
    title_id: titleId,
    chapter_id: chapterId,
  };
}

export async function recordReadingProgress(
  e: Etzhayyim,
  input: RecordReadingProgressInput
): Promise<RecordReadingProgressOutput> {
  if (
    !input.user_id ||
    !input.title_id ||
    !input.chapter_id
  ) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const progressId = `${input.user_id}-${input.title_id}-${input.chapter_id}`;
  const rkey = readingProgressRkey(progressId);
  const now = new Date().toISOString();
  const record = {
    user_id: input.user_id,
    title_id: input.title_id,
    chapter_id: input.chapter_id,
    page_num: input.page_num ?? 0,
    created_at: now,
    updated_at: now,
  };
  const receipt = await e.write({
    collection: READING_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    id: progressId,
  };
}
