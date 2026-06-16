# OfficeRnD Flex API Explorer

A local **Swagger UI** for the OfficeRnD Flex v2 API where you can browse every
endpoint and **run live requests** against the real API. You authenticate right
in the UI: enter your credentials, pick scopes, mint a token — no Postman setup.

```
org-slug field (top of page) ─┐ applied as X-Org-Slug on every request
                              │
browser ──▶ "Authorize" ──▶ /oauth/token (this app) ──▶ OfficeRnD identity
   │        (client_id/secret + scopes)                   (mints token)
   │
   └──▶ "Try it out" ──▶ /api/<path> (this app) ──▶ OfficeRnD Flex v2 API
                              │ forwards your Bearer token + org slug
```

Auth is an OAuth2 **client-credentials** scheme. The **org slug** is a single
field at the top of the page (applied to every request); credentials + scopes
are entered once in the **Authorize** dialog. Swagger UI mints the token in your
browser; the two local proxy hops only exist to sidestep CORS. Your credentials
and token live in the browser, never on the server.

## Setup

1. **Config.** Optional — nothing is required. Any of `OFFICERND_ORG_SLUG`,
   `OFFICERND_CLIENT_ID`, `OFFICERND_CLIENT_SECRET` set in `swagger/.env` (or the
   project-root `.env`, auto-loaded as a fallback) **pre-fills** the matching
   field — still editable in the browser. Leave any blank to type it in each time:
   ```bash
   cp .env.example .env
   ```
   > Note: a pre-filled `client_secret` is sent to the browser to seed the form.
   > Fine for this localhost tool; omit it from `.env` if you'd rather paste it.

2. **Run:**
   ```bash
   npm install
   npm start
   ```
   Open <http://localhost:8088/>.

3. **Org slug.** Set the **Org slug** field at the top of the page (prefilled
   from `.env` if present, editable, remembered across reloads). It's sent as
   `X-Org-Slug` on every API call.

4. **Authorize.** Click the green **Authorize** button, enter your `client_id`
   and `client_secret`, tick the scopes you need, and **Authorize** — once. The
   token only carries the scopes you tick, so any endpoint whose scope isn't
   selected returns **401/403**.
   > ⚠️ Only tick scopes actually **granted** to your app in OfficeRnD →
   > Developer Tools. One ungranted scope makes the whole token request fail.
   > For a read-only explorer, select just the `*.read` scopes.

## Using it

- Expand any endpoint → **Try it out** → **Execute**. Your minted token is sent
  automatically; responses (and timing) show inline.
- Each operation's description shows the **scope** it needs, and the lock icon
  reflects whether you're authorized.
- List endpoints expose `$limit` (max 50), `$cursorNext` (paging), the
  incremental `modifiedAt[$gte]` / `start[$gte]` filter, and `member` / `company`
  / `location` filters.
- `GET /openapi.json` — the raw spec (import into Postman/Insomnia/codegen).
- `POST /oauth/token` — the token-minting proxy Swagger UI calls when you
  Authorize (forwards a client-credentials grant to OfficeRnD identity).

## ⚠️ This hits the real API

GET requests are safe. **POST / PATCH / DELETE mutate live OfficeRnD data.**
Write endpoints are included for completeness — use them deliberately, and
consider authorizing with only `*.read` scopes if you just want to browse.

## How it's built

| File | Role |
|------|------|
| `endpoints.js` | Hand-maintained catalogue of every Flex v2 endpoint + scope (from the official reference; OfficeRnD publishes no downloadable OpenAPI spec). |
| `scopes.js` | Full OAuth2 scope catalogue (name → description) shown as checkboxes in the Authorize dialog. |
| `openapi.js` | Turns the catalogue into an OpenAPI 3.0 document with an OAuth2 client-credentials security scheme; `servers` points at the local `/api` proxy. |
| `server.js` | Express app: serves a custom Swagger UI page (org-slug field + `requestInterceptor`) from `swagger-ui-dist`, plus the `/oauth/token` token-minting proxy and `/api` token-forwarding proxy. |

To refresh after OfficeRnD adds endpoints, update `endpoints.js` (cross-check
`https://developer.officernd.com/llms.txt`) and restart. Keep it in sync with
[`../docs/API_ENDPOINTS.md`](../docs/API_ENDPOINTS.md).
