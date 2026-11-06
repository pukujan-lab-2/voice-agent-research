# The site and its backend (demo/live-site/server.ts): the app, the copilot and /api on one port. See deploy/README.md.
FROM node:24.22-bookworm-slim AS build
# The pnpm this repo's app is built with on the Mac. esbuild and swc ship prebuilt binaries, so their install scripts
# stay skipped, as they are locally; pnpm 12 would stop on that by default.
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /src
COPY . .
WORKDIR /src/demo/live-site
RUN npm ci --omit=dev \
  && (cd app && pnpm install --frozen-lockfile --config.strict-dep-builds=false) \
  && node --no-warnings build.ts && rm -rf app/node_modules

FROM node:24.22-bookworm-slim
# The name matcher for caller verification (tools/verify_match.py), with the versions server.ts pins.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
  && pip3 install --no-cache-dir --break-system-packages rapidfuzz==3.10.1 jellyfish==1.1.3 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/copilot-engine/src copilot-engine/src
COPY --from=build /src/demo/live-site demo/live-site
# The voice stacks and languages server.ts offers (demo/live-site/voice-config.ts).
COPY --from=build /src/agent/voice agent/voice
COPY --from=build /src/agent/languages agent/languages
WORKDIR /app/demo/live-site
ENV HOST=0.0.0.0 PORT=8787 VERIFY_MATCHER="python3 tools/verify_match.py" TRUST_PROXY=1
USER node
EXPOSE 8787
CMD ["node", "--no-warnings", "server.ts"]
