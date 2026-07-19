import type { Etzhayyim } from "@etzhayyim/sdk";

export const MANGA_DID_PREFIX = "did:web:manga.etzhayyim.com:" as const;

export type ChapterStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "archived";

export interface TitleRecord {
  did: string;
  title: string;
  series_id?: string;
  description?: string;
  genre?: string;
  status: string;
  thumbnail_key?: string;
  coin_price?: number;
  wait_free_hours?: number;
  chapter_count: number;
  tags?: string[];
  created_at: string;
}

export interface TitleView extends TitleRecord {
  title_uri: string;
}

export interface CreateTitleInput {
  title: string;
  title_id?: string;
  description?: string;
  genre?: string;
  thumbnail_key?: string;
  coin_price?: number;
  wait_free_hours?: number;
  user_id?: string;
  org_id?: string;
}

export interface CreateTitleOutput {
  status: "registered" | "rejected" | "alreadyExists";
  id?: string;
  series_id?: string;
  title_uri?: string;
  error?: string;
}

export interface GetTitleInput {
  id: string;
}

export interface GetTitleOutput {
  title?: TitleView;
  error?: string;
}

export interface ListTitlesInput {
  genre?: string;
  status?: string;
  user_id?: string;
  offset?: number;
  limit?: number;
}

export interface ListTitlesOutput {
  titles: TitleView[];
  total: number;
  offset: number;
  limit: number;
}

export interface SearchTitlesInput {
  q: string;
  genre?: string;
  tag?: string;
  offset?: number;
  limit?: number;
}

export interface SearchTitlesOutput {
  titles: TitleView[];
  total: number;
  offset: number;
  limit: number;
}

export interface AddTagInput {
  title_id: string;
  tag: string;
  user_id?: string;
}

export interface AddTagOutput {
  status: "registered" | "rejected" | "alreadyExists";
  title_id?: string;
  tag?: string;
  error?: string;
}

export interface ChapterRecord {
  did: string;
  title_id: string;
  chapter_num: number;
  episode_title: string;
  status: ChapterStatus;
  asset_manifest_uri?: string;
  page_count?: number;
  published_at?: string;
  created_at: string;
}

export interface ChapterView extends ChapterRecord {
  chapter_uri: string;
}

export interface CreateChapterInput {
  title_id: string;
  chapter_num: number;
  episode_title: string;
  asset_manifest_uri?: string;
  page_count?: number;
  user_id?: string;
  org_id?: string;
}

export interface CreateChapterOutput {
  status: "registered" | "rejected" | "alreadyExists";
  id?: string;
  chapter_uri?: string;
  error?: string;
}

export interface GetChapterInput {
  id: string;
}

export interface GetChapterOutput {
  chapter?: ChapterView;
  error?: string;
}

export interface ListChaptersInput {
  title_id: string;
  status?: ChapterStatus;
  offset?: number;
  limit?: number;
}

export interface ListChaptersOutput {
  chapters: ChapterView[];
  total: number;
  offset: number;
  limit: number;
}

export interface PublishChapterInput {
  chapter_id: string;
  user_id?: string;
}

export interface PublishChapterOutput {
  status: "published" | "rejected" | "invalidState";
  chapter_id?: string;
  actual?: ChapterStatus;
  error?: string;
}

export interface UpdateChapterStatusInput {
  chapter_id: string;
  status: ChapterStatus;
  asset_manifest_uri?: string;
  page_count?: number;
  user_id?: string;
}

export interface UpdateChapterStatusOutput {
  status: "updated" | "rejected" | "invalidState";
  chapter_id?: string;
  actual?: ChapterStatus;
  error?: string;
}

export interface RecordReadingProgressInput {
  user_id: string;
  title_id: string;
  chapter_id: string;
  page_num?: number;
  org_id?: string;
}

export interface RecordReadingProgressOutput {
  status: "registered" | "rejected";
  id?: string;
  error?: string;
}

export interface SubmitFromNarouInput {
  narou_title_id: string;
  narou_chapter_id?: string;
  title?: string;
  description?: string;
  genre?: string;
  episode_title?: string;
  asset_manifest_uri?: string;
  page_count?: number;
  thumbnail_key?: string;
  user_id?: string;
  org_id?: string;
}

export interface SubmitFromNarouOutput {
  status: "registered" | "rejected";
  title_id?: string;
  chapter_id?: string;
  error?: string;
}

export function titleSlug(titleId: string): string {
  return titleId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export function titleDid(titleId: string): string {
  return `${MANGA_DID_PREFIX}title:${titleSlug(titleId)}`;
}

export function titleRkey(titleId: string): string {
  return `title-${titleSlug(titleId)}`;
}

export function chapterSlug(chapterId: string): string {
  return chapterId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export function chapterDid(chapterId: string): string {
  return `${MANGA_DID_PREFIX}chapter:${chapterSlug(chapterId)}`;
}

export function chapterRkey(chapterId: string): string {
  return `chapter-${chapterSlug(chapterId)}`;
}

export function readingProgressSlug(progressId: string): string {
  return progressId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export function readingProgressDid(progressId: string): string {
  return `${MANGA_DID_PREFIX}reading:${readingProgressSlug(progressId)}`;
}

export function readingProgressRkey(progressId: string): string {
  return `reading-${readingProgressSlug(progressId)}`;
}
