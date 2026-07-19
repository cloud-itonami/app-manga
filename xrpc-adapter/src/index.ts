/**
 * manga XRPC adapter — CF Worker.
 *
 * Wires the kotoba reference impl (12 TS functions) into a deployable
 * CF Worker that exposes each function as an XRPC endpoint at
 * https://manga.etzhayyim.com/xrpc/com.etzhayyim.manga.<cmd>
 *
 * Per ADR-2605210000 execution-layer demonstration. Instantiates the
 * Etzhayyim SDK from env bindings, calls the kotoba function with parsed input,
 * and maps status codes to HTTP responses.
 */

import {
  createAuthedEtzhayyim,
  extractBearerToken,
  type Etzhayyim,
} from "@etzhayyim/sdk-auth";
import * as mangaRwFree from "@etzhayyim/manga-kotoba";

interface Env {
  ACTOR_DID: string;
  PDS_URL: string;
  L2_RPC_URL: string;
  PDS_ACCESS_JWT?: string;
  PDS_REFRESH_JWT?: string;
}

type Handler = (e: Etzhayyim, input: unknown) => Promise<unknown>;

const NSID_BASE = "com.etzhayyim.manga";

interface RouteConfig {
  method: "POST" | "GET";
  handler: Handler;
}

const routes: Record<string, RouteConfig> = {
  // Titles
  [`${NSID_BASE}.createTitle`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.createTitle(e, input as any),
  },
  [`${NSID_BASE}.getTitle`]: {
    method: "GET",
    handler: (e, input) => mangaRwFree.getTitle(e, input as any),
  },
  [`${NSID_BASE}.listTitles`]: {
    method: "GET",
    handler: (e, input) => mangaRwFree.listTitles(e, input as any),
  },
  [`${NSID_BASE}.searchTitles`]: {
    method: "GET",
    handler: (e, input) => mangaRwFree.searchTitles(e, input as any),
  },
  [`${NSID_BASE}.addTag`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.addTag(e, input as any),
  },
  // Chapters
  [`${NSID_BASE}.createChapter`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.createChapter(e, input as any),
  },
  [`${NSID_BASE}.getChapter`]: {
    method: "GET",
    handler: (e, input) => mangaRwFree.getChapter(e, input as any),
  },
  [`${NSID_BASE}.listChapters`]: {
    method: "GET",
    handler: (e, input) => mangaRwFree.listChapters(e, input as any),
  },
  [`${NSID_BASE}.publishChapter`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.publishChapter(e, input as any),
  },
  [`${NSID_BASE}.updateChapterStatus`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.updateChapterStatus(e, input as any),
  },
  // Ingest
  [`${NSID_BASE}.submitFromNarou`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.submitFromNarou(e, input as any),
  },
  [`${NSID_BASE}.recordReadingProgress`]: {
    method: "POST",
    handler: (e, input) => mangaRwFree.recordReadingProgress(e, input as any),
  },
};

function mapStatus(status?: string): number {
  if (status === "rejected") return 400;
  if (status === "notFound" || status === "invalidId") return 400;
  if (status === "alreadyExists" || status === "invalidStatus") return 200;
  return 200;
}

function jsonResponse(
  body: unknown,
  status: number = 200,
  init?: ResponseInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (!url.pathname.startsWith("/xrpc/")) {
      return jsonResponse({ error: "NotFound" }, 404);
    }

    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];

    if (!route) {
      return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    }

    if (req.method !== route.method) {
      return jsonResponse({ error: "MethodNotAllowed" }, 405);
    }

    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({
      env: {
        ACTOR_DID: env.ACTOR_DID,
        PDS_URL: env.PDS_URL,
        L2_RPC_URL: env.L2_RPC_URL,
        PDS_ACCESS_JWT: env.PDS_ACCESS_JWT,
        PDS_REFRESH_JWT: env.PDS_REFRESH_JWT,
      },
      bearerToken,
    });

    let input: unknown;
    try {
      if (route.method === "POST") {
        input = await req.json().catch(() => ({}));
      } else {
        input = Object.fromEntries(url.searchParams.entries());
        const typed = input as Record<string, unknown>;
        if (typed.limit) typed.limit = Number(typed.limit);
        if (typed.offset) typed.offset = Number(typed.offset);
        if (typed.chapterNum) typed.chapterNum = Number(typed.chapterNum);
        if (typed.pageCount) typed.pageCount = Number(typed.pageCount);
      }
    } catch (err) {
      return jsonResponse(
        {
          error: "InvalidInput",
          message: `Failed to parse ${route.method === "POST" ? "JSON" : "query params"}`,
        },
        400
      );
    }

    try {
      const result = await route.handler(e, input);
      const status = mapStatus((result as Record<string, unknown>)?.status as string | undefined);
      return jsonResponse(result, status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(
        {
          error: "InternalError",
          message,
          nsid,
        },
        500
      );
    }
  },
} satisfies ExportedHandler<Env>;
