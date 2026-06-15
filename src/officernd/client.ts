import { config } from "../config.js";
import { log } from "../logger.js";

/** A record from OfficeRnD always carries a stable Mongo `_id`. */
export interface OrndRecord {
  _id: string;
  createdAt?: string;
  modifiedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface TokenState {
  accessToken: string;
  /** epoch ms at which the token should be considered expired */
  expiresAt: number;
}

export interface ListOptions {
  /** ISO timestamp; only return records modified at/after this (incremental sync). */
  modifiedSince?: string;
  /** Field to filter `modifiedSince` against. Defaults to "modifiedAt". */
  incrementalField?: string;
  /** Page size. OfficeRnD v2 max is 50. */
  pageSize?: number;
}

const TOKEN_SKEW_MS = 60_000; // refresh a minute before expiry
const MAX_PAGE_SIZE = 50;
const MAX_RETRIES = 5;

export class OfficeRndClient {
  private token: TokenState | null = null;

  /** Obtain (and cache) a bearer token via OAuth2 client-credentials. */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - TOKEN_SKEW_MS) {
      return this.token.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.officernd.clientId,
      client_secret: config.officernd.clientSecret,
    });
    if (config.officernd.scopes) body.set("scope", config.officernd.scopes);

    const res = await this.fetchWithRetry(
      config.officernd.tokenUrl,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "token",
    );

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    log.debug("Obtained OfficeRnD access token", { expiresInSec: json.expires_in });
    return this.token.accessToken;
  }

  /** Fetch with retry on 429 (Retry-After honored) and transient 5xx. */
  private async fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
    let attempt = 0;
    while (true) {
      attempt++;
      const res = await fetch(url, init);
      if (res.ok) return res;

      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retryable || attempt > MAX_RETRIES) {
        const text = await res.text().catch(() => "");
        throw new Error(`OfficeRnD ${label} request failed: ${res.status} ${res.statusText} ${text}`);
      }

      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30_000, 2 ** attempt * 500);
      log.warn(`Retrying ${label} after ${res.status}`, { attempt, waitMs });
      await sleep(waitMs);
    }
  }

  /** Authenticated GET against the org base URL. */
  private async apiGet(pathAndQuery: string): Promise<Response> {
    const accessToken = await this.getToken();
    return this.fetchWithRetry(
      `${config.officernd.baseUrl}${pathAndQuery}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      pathAndQuery,
    );
  }

  /**
   * Fetch every record from a collection, transparently following the v2 cursor.
   * Yields one page (array of records) at a time so callers can stream into the DB.
   */
  async *listAll(resourcePath: string, opts: ListOptions = {}): AsyncGenerator<OrndRecord[]> {
    const pageSize = Math.min(opts.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams();
      params.set("$limit", String(pageSize));
      if (cursor) params.set("$cursorNext", cursor);
      if (opts.modifiedSince) {
        const field = opts.incrementalField ?? "modifiedAt";
        params.set(`${field}[$gte]`, opts.modifiedSince);
      }

      const res = await this.apiGet(`${resourcePath}?${params.toString()}`);
      const payload = (await res.json()) as
        | OrndRecord[]
        | { results?: OrndRecord[]; data?: OrndRecord[]; cursorNext?: string | null };

      let records: OrndRecord[];
      let nextCursor: string | undefined;

      if (Array.isArray(payload)) {
        // Defensive: some endpoints may return a bare array (no further pages).
        records = payload;
        nextCursor = undefined;
      } else {
        records = payload.results ?? payload.data ?? [];
        nextCursor = payload.cursorNext ?? undefined;
      }

      if (records.length > 0) yield records;
      cursor = nextCursor;
    } while (cursor);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
