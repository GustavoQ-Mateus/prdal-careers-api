FROM node:22-slim AS build
WORKDIR /repo
COPY apps/api/package.json ./apps/api/package.json
WORKDIR /repo/apps/api
RUN npm install
COPY packages/shared-types /repo/packages/shared-types
RUN npx tsc -p /repo/packages/shared-types/tsconfig.json
COPY apps/api ./
RUN npm run build

FROM node:22-slim AS deps
WORKDIR /repo/apps/api
COPY apps/api/package.json ./package.json
RUN npm install --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
