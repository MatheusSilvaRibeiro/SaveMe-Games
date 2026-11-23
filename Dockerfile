FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY tools ./tools
COPY backend ./backend
COPY data ./data
RUN npm run build:production

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 SERVE_WEB=true
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/public ./backend/public
COPY --from=build /app/data ./data
COPY --from=build /app/tools/start-production.mjs ./tools/start-production.mjs
USER node
EXPOSE 3000
CMD ["node", "tools/start-production.mjs"]
