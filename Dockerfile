FROM node:22-slim AS deps
WORKDIR /repo/apps/api
COPY apps/api/package.json ./package.json
COPY apps/api/prisma ./prisma
RUN npm install --omit=dev

FROM node:22-slim AS build
WORKDIR /repo
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
WORKDIR /repo/apps/api
RUN npm install
COPY packages/shared-types /repo/packages/shared-types
RUN npx tsc -p /repo/packages/shared-types/tsconfig.json
COPY apps/api ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/apps/api/node_modules ./node_modules
COPY --from=deps /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
