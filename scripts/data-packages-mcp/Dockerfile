# The data-packages MCP server (see README.md). Built from this directory:
#
#   docker build -t mwnf/data-packages-mcp scripts/data-packages-mcp            # the server
#   docker build --target check scripts/data-packages-mcp                       # type-check, lint, tests
#
# The repo-root compose.yml builds the server stage as the `data-packages-mcp`
# service, which is what .mcp.json starts.

FROM node:25-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Everything CI runs, against the same sources the server is built from.
FROM deps AS check
COPY . .
RUN npm run type-check && npm run lint:check && npm test

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:25-alpine AS server
WORKDIR /app
ENV NODE_ENV=production \
    DATA_PACKAGES_CACHE=/cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
# A fresh named volume takes the ownership of the directory it is mounted on,
# so the unprivileged user can write the cache from the first run.
RUN mkdir -p /cache && chown node:node /cache
USER node
VOLUME /cache
ENTRYPOINT ["node", "dist/src/index.js"]
