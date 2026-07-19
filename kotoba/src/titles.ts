import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  titleDid,
  titleRkey,
  titleSlug,
  type AddTagInput,
  type AddTagOutput,
  type CreateTitleInput,
  type CreateTitleOutput,
  type GetTitleInput,
  type GetTitleOutput,
  type ListTitlesInput,
  type ListTitlesOutput,
  type SearchTitlesInput,
  type SearchTitlesOutput,
  type TitleRecord,
  type TitleView,
} from "./types.js";

const TITLE_COLLECTION = "com.etzhayyim.manga.title";
const TAG_COLLECTION = "com.etzhayyim.manga.tag";

function isTitleId(id: string): boolean {
  return /^[a-z0-9-]{1,32}$/i.test(id);
}

export async function createTitle(
  e: Etzhayyim,
  input: CreateTitleInput
): Promise<CreateTitleOutput> {
  if (!input.title || input.title.trim().length === 0) {
    return { status: "rejected", error: "missingTitle" };
  }
  const titleId = input.title_id || titleSlug(input.title).slice(0, 32);
  if (!isTitleId(titleId)) {
    return { status: "rejected", error: "invalidTitleId" };
  }
  const rkey = titleRkey(titleId);
  const existing = await e
    .read<TitleRecord>({ collection: TITLE_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      id: titleId,
      title_uri: existing.records[0].uri,
    };
  }
  const did = titleDid(titleId);
  const now = new Date().toISOString();
  const record: TitleRecord = {
    did,
    title: input.title,
    description: input.description,
    genre: input.genre,
    status: "active",
    thumbnail_key: input.thumbnail_key,
    coin_price: input.coin_price ?? 0,
    wait_free_hours: input.wait_free_hours ?? 0,
    chapter_count: 0,
    tags: [],
    created_at: now,
  };
  const receipt = await e.write({
    collection: TITLE_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    id: titleId,
    series_id: titleId,
    title_uri: receipt.uri,
  };
}

export async function getTitle(
  e: Etzhayyim,
  input: GetTitleInput
): Promise<GetTitleOutput> {
  if (!input.id) return { error: "missingTitleId" };
  const resp = await e
    .read<TitleRecord>({
      collection: TITLE_COLLECTION,
      rkey: titleRkey(input.id),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: TitleView = { ...r.value, title_uri: r.uri };
  return { title: view };
}

export async function listTitles(
  e: Etzhayyim,
  input: ListTitlesInput = {}
): Promise<ListTitlesOutput> {
  const offset = input.offset ?? 0;
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<TitleRecord>({
    collection: TITLE_COLLECTION,
    limit: limit + offset,
  });
  const filtered = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.genre && v.genre !== input.genre) return false;
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .slice(offset, offset + limit);
  const items: TitleView[] = filtered.map((r) => ({
    ...r.value,
    title_uri: r.uri,
  }));
  return {
    titles: items,
    total: filtered.length,
    offset,
    limit,
  };
}

export async function searchTitles(
  e: Etzhayyim,
  input: SearchTitlesInput
): Promise<SearchTitlesOutput> {
  if (!input.q || input.q.trim().length === 0) {
    return { titles: [], total: 0, offset: 0, limit: 0 };
  }
  const offset = input.offset ?? 0;
  const limit = Math.min(input.limit ?? 50, 100);
  const q = input.q.toLowerCase();
  const resp = await e.read<TitleRecord>({
    collection: TITLE_COLLECTION,
    limit: limit + offset,
  });
  const filtered = resp.records
    .filter((r) => {
      const v = r.value;
      const titleMatch =
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q));
      if (!titleMatch) return false;
      if (input.genre && v.genre !== input.genre) return false;
      if (input.tag && (!v.tags || !v.tags.includes(input.tag)))
        return false;
      return true;
    })
    .slice(offset, offset + limit);
  const items: TitleView[] = filtered.map((r) => ({
    ...r.value,
    title_uri: r.uri,
  }));
  return {
    titles: items,
    total: filtered.length,
    offset,
    limit,
  };
}

export async function addTag(
  e: Etzhayyim,
  input: AddTagInput
): Promise<AddTagOutput> {
  if (!input.title_id || !input.tag) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const resp = await e
    .read<TitleRecord>({
      collection: TITLE_COLLECTION,
      rkey: titleRkey(input.title_id),
    })
    .catch(() => ({ records: [] }));
  const existing = resp.records[0]?.value;
  if (!existing) {
    return { status: "rejected", error: "titleNotFound" };
  }
  if (existing.tags && existing.tags.includes(input.tag)) {
    return {
      status: "alreadyExists",
      title_id: input.title_id,
      tag: input.tag,
    };
  }
  const merged: TitleRecord = {
    ...existing,
    tags: [...(existing.tags ?? []), input.tag],
  };
  await e.write({
    collection: TITLE_COLLECTION,
    record: merged as unknown as Record<string, unknown>,
    rkey: titleRkey(input.title_id),
  });
  return {
    status: "registered",
    title_id: input.title_id,
    tag: input.tag,
  };
}
