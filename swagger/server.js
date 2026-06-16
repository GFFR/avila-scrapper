/**
 * OfficeRnD Flex API Explorer — Swagger UI + token-minting & forwarding proxy.
 *
 *   browser ──▶ /oauth/token ──▶ this proxy ──▶ OfficeRnD identity   (mint token)
 *   browser ──▶ /api/<path> ──▶ this proxy ──▶ OfficeRnD v2          (forward token)
 *
 * A custom Swagger UI page carries one "Org slug" field (prefilled from .env,
 * editable, persisted) that's attached to every request as the X-Org-Slug
 * header via a requestInterceptor. Credentials + scopes are entered in the
 * single OAuth2 "Authorize" dialog (also prefilled); Swagger UI mints a
 * client-credentials token through /oauth/token and sends it as a Bearer header.
 * The two local proxy hops exist purely to sidestep CORS — credentials and token
 * live in the browser, not here.
 */
import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildSpec } from "./openapi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const SWAGGER_UI_DIST = require("swagger-ui-dist").getAbsoluteFSPath();

// Load this folder's .env first, then fall back to the parent project's .env.
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  OFFICERND_ORG_SLUG: ORG_SLUG = "",
  OFFICERND_CLIENT_ID: CLIENT_ID = "",
  OFFICERND_CLIENT_SECRET: CLIENT_SECRET = "",
  PORT = "8088",
} = process.env;

const TOKEN_URL = "https://identity.officernd.com/oauth/token";
const apiBaseFor = (slug) => `https://app.officernd.com/api/v2/organizations/${slug}`;

// ── App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "2mb" }));

const spec = buildSpec({ orgSlug: ORG_SLUG });

// Custom Swagger UI page. The .env values below are serialised into the page to
// PREFILL the org-slug field and the OAuth2 Authorize form — all still editable.
// (A prefilled client_secret is therefore sent to the browser; fine for this
// localhost tool — omit it from .env to type it manually instead.)
const PREFILL = JSON.stringify({ orgSlug: ORG_SLUG, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OfficeRnD Flex Explorer</title>
  <link rel="stylesheet" href="assets/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    #org-bar { display: flex; align-items: center; gap: .6rem; padding: .7rem 1.2rem;
      background: #1b1b1b; color: #fff; font: 14px/1.4 sans-serif; flex-wrap: wrap; }
    #org-bar label { font-weight: 600; }
    #org-bar input { flex: 0 1 320px; padding: .45rem .6rem; border: 1px solid #555;
      border-radius: 4px; background: #fff; font-size: 14px; }
    #org-bar .hint { color: #9aa0a6; font-size: 12px; }
    #org-bar .ok { color: #7bd88f; }
  </style>
</head>
<body>
  <div id="org-bar">
    <label for="org-slug">Org slug</label>
    <input id="org-slug" type="text" placeholder="your-org-slug" autocomplete="off" spellcheck="false" />
    <span id="org-state" class="hint">sent as <code>X-Org-Slug</code> on every request</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="assets/swagger-ui-bundle.js"></script>
  <script src="assets/swagger-ui-standalone-preset.js"></script>
  <script>
    const PREFILL = ${PREFILL};
    const LS_KEY = "avila.orgSlug";
    const orgInput = document.getElementById("org-slug");
    const orgState = document.getElementById("org-state");
    // Prefill order: a value the user previously typed (localStorage) wins,
    // otherwise the .env default.
    orgInput.value = localStorage.getItem(LS_KEY) ?? PREFILL.orgSlug ?? "";
    const currentSlug = () => orgInput.value.trim();
    const renderState = () => {
      orgState.textContent = currentSlug()
        ? "✓ " + currentSlug() + " — sent as X-Org-Slug"
        : "⚠ no org slug — API calls will 400";
      orgState.className = currentSlug() ? "ok" : "hint";
    };
    orgInput.addEventListener("input", () => { localStorage.setItem(LS_KEY, currentSlug()); renderState(); });
    renderState();

    window.ui = SwaggerUIBundle({
      url: "openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      plugins: [SwaggerUIBundle.plugins.DownloadUrl],
      layout: "StandaloneLayout",
      tryItOutEnabled: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      // Attach the org slug to every proxied API call (not the token mint).
      requestInterceptor: (req) => {
        const slug = currentSlug();
        if (slug && req.url.includes("/api/")) req.headers["X-Org-Slug"] = slug;
        return req;
      },
      onComplete: () => {
        // Seed the Authorize form's client_id / client_secret (editable).
        window.ui.initOAuth({ clientId: PREFILL.clientId || "", clientSecret: PREFILL.clientSecret || "" });
      },
    });
  </script>
</body>
</html>`;

// Serve the static Swagger UI assets + our custom page.
app.use("/assets", express.static(SWAGGER_UI_DIST));
app.get("/", (_req, res) => res.type("html").send(indexHtml));
app.get("/openapi.json", (_req, res) => res.json(spec));

// Token-minting proxy: Swagger UI's Authorize dialog POSTs the client-credentials
// grant here (form-encoded). We forward it to OfficeRnD identity — this hop only
// exists so the browser doesn't hit a cross-origin token endpoint. Credentials
// arrive either in the body or as an HTTP Basic header, depending on the
// "client credentials location" the user picks; handle both.
app.post("/oauth/token", express.urlencoded({ extended: false }), async (req, res) => {
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  const auth = req.headers.authorization;
  if ((!clientId || !clientSecret) && auth?.startsWith("Basic ")) {
    const [id, secret] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
    clientId ||= id;
    clientSecret ||= secret;
  }

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: "invalid_request", error_description: "Missing client_id / client_secret" });
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const scope = (req.body.scope || "").trim();
  if (scope) body.set("scope", scope);

  try {
    const upstream = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "proxy_error", error_description: String(e.message || e) });
  }
});

// Forwarding proxy: everything under /api/* → OfficeRnD, carrying the Bearer
// token the browser obtained via Authorize. We never mint or store it.
app.all(/^\/api\/(.*)/, async (req, res) => {
  const rest = req.params[0]; // path after /api/
  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";

  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({
      error: "Not authorized",
      detail: "Click the green Authorize button, enter credentials, pick scopes, and authorize first.",
    });
  }

  const orgSlug = req.headers["x-org-slug"] || ORG_SLUG;
  if (!orgSlug) {
    return res.status(400).json({
      error: "Missing org slug",
      detail: "Fill the 'Org slug' field at the top of the page, or set OFFICERND_ORG_SLUG on the server.",
    });
  }
  const url = `${apiBaseFor(orgSlug)}/${rest}${qs}`;

  try {
    const hasBody = !["GET", "HEAD"].includes(req.method) && req.body && Object.keys(req.body).length > 0;
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: auth,
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "Proxy error", detail: String(e.message || e), url });
  }
});

app.listen(Number(PORT), () => {
  const prefill = [CLIENT_ID && "client_id", CLIENT_SECRET && "client_secret", ORG_SLUG && "org slug"].filter(Boolean);
  console.log(`\n  OfficeRnD Flex Explorer`);
  console.log(`  ─ org:     ${ORG_SLUG || "(none — enter in Authorize dialog)"}`);
  console.log(`  ─ auth:    org-slug field + OAuth2 "Authorize" (client-credentials)`);
  console.log(`  ─ prefill: ${prefill.length ? prefill.join(", ") + " from .env (editable in UI)" : "(none — enter all in Authorize dialog)"}`);
  console.log(`  ─ UI:      http://localhost:${PORT}/`);
  console.log(`  ─ spec:    http://localhost:${PORT}/openapi.json\n`);
});
