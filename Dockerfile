# --- build stage ---
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 is a native module; needs build toolchain to compile.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# --- runtime stage ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# git is needed only if AUTO_GIT_COMMIT=true
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

COPY --from=build /app/dist ./dist

# Data lives on a mounted volume so it survives redeploys.
VOLUME ["/app/data"]

# Default: long-running scheduler. Override with `node dist/cli.js sync` for one-shot.
CMD ["node", "dist/scheduler.js"]
