/**
 * Builds an OpenAPI 3.0 document from the endpoint catalogue.
 *
 * `servers` points at this app's own `/api` proxy (not OfficeRnD directly), so
 * Swagger UI "Try it out" calls hit our proxy, which forwards the bearer token
 * the user minted via the Authorize dialog to OfficeRnD.
 *
 * Auth is an OAuth2 client-credentials scheme whose `tokenUrl` is this app's own
 * `/oauth/token` proxy: the user enters client_id/secret + picks scopes in the
 * Authorize dialog, Swagger UI mints a token, and sends it as a Bearer header.
 */
import { ENDPOINTS, SERVER_NAME } from "./endpoints.js";
import { SCOPES } from "./scopes.js";

const isCollection = (p) =>
  !p.includes("{") &&
  !/\/(count|status|summary|methods|documents|occurrences|stats|comments)$/.test(p);

// Common optional filters OfficeRnD accepts on most list endpoints (FK fields).
const COMMON_FILTERS = ["member", "company", "location"];

function paramsFor(ep) {
  const params = [];

  // Path params
  for (const name of ep.path.match(/\{(\w+)\}/g)?.map((s) => s.slice(1, -1)) ?? []) {
    params.push({
      name, in: "path", required: true,
      schema: { type: "string" },
      description: name === "id" ? "Record _id (24-hex ObjectId)" : name,
    });
  }

  if (ep.method !== "get" || !isCollection(ep.path)) return params;

  // Pagination (v2)
  params.push(
    { name: "$limit", in: "query", schema: { type: "integer", maximum: 50, default: 50 }, description: "Page size (max 50)" },
    { name: "$cursorNext", in: "query", schema: { type: "string" }, description: "Cursor from the previous response's cursorNext" },
  );

  // Incremental filter
  if (ep.incremental) {
    params.push({
      name: `${ep.incremental}[$gte]`, in: "query", schema: { type: "string", format: "date-time" },
      description: `Only records with ${ep.incremental} ≥ this ISO timestamp (incremental sync filter)`,
    });
  }

  // Common FK filters + special fan-out params
  for (const f of COMMON_FILTERS) {
    params.push({ name: f, in: "query", schema: { type: "string" }, description: `Filter by ${f} _id` });
  }
  if (ep.path === "/assignments") {
    params.push({ name: "resource", in: "query", schema: { type: "string" }, description: "Filter by resource _id (required to list — assignments can't be bulk-listed)" });
  }

  return params;
}

export function buildSpec({ orgSlug }) {
  const paths = {};
  const tagSet = new Set();

  for (const ep of ENDPOINTS) {
    tagSet.add(ep.tag);
    const op = {
      tags: [ep.tag],
      summary: ep.summary,
      description: `**Scope:** \`${ep.scope}\``,
      operationId: `${ep.method}_${ep.path.replace(/[/{}]/g, "_")}`,
      security: [{ oauth2: [ep.scope] }],
      parameters: paramsFor(ep),
      responses: {
        200: { description: "Success", content: { "application/json": { schema: { type: "object" } } } },
        401: { description: "Unauthorized — token/scope problem" },
        403: { description: "Forbidden — scope not granted" },
        429: { description: "Rate limited (~400 reads/min)" },
      },
    };
    if (ep.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { type: "object", additionalProperties: true }, example: {} } },
      };
    }
    (paths[ep.path] ??= {})[ep.method] = op;
  }

  const tags = [...tagSet].sort().map((name) => ({ name }));

  return {
    openapi: "3.0.3",
    info: {
      title: `${SERVER_NAME} — Avila Spaces Explorer`,
      version: "2.0.0",
      description: [
        `Live explorer for the OfficeRnD Flex v2 API${orgSlug ? `, default org **${orgSlug}**` : ""}.`,
        "",
        "**Set your org slug** in the field at the top of the page (it's applied to",
        "every request as `X-Org-Slug`). Then click the green **Authorize** button,",
        "enter your `client_id` / `client_secret`, tick the scopes you need, and",
        "**Authorize** — Swagger UI mints an OAuth2 client-credentials token (via",
        "this app's `/oauth/token` proxy) and sends it as a Bearer token.",
        "",
        "⚠️ This calls the **real OfficeRnD API**. GET is safe; POST/PATCH/DELETE",
        "mutate live data. The token only carries the scopes you ticked, so",
        "endpoints whose scope isn't granted/selected return 401/403. Including a",
        "scope your app wasn't granted makes the whole token request fail.",
        "",
        "See `docs/API_ENDPOINTS.md` and `docs/DATA_MODEL.md` for full reference.",
      ].join("\n"),
    },
    servers: [{ url: "/api", description: "Local proxy → OfficeRnD (forwards your Bearer token)" }],
    tags,
    components: {
      securitySchemes: {
        oauth2: {
          type: "oauth2",
          description:
            "OAuth2 client-credentials. Token is minted through this app's " +
            "`/oauth/token` proxy (avoids CORS); credentials and token stay in your browser.",
          flows: {
            clientCredentials: {
              tokenUrl: "/oauth/token",
              scopes: SCOPES,
            },
          },
        },
      },
    },
    security: [{ oauth2: [] }],
    paths,
  };
}
