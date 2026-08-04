# Stage 1: build client (Angular)
FROM node:22-slim AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build -- --configuration production

# Stage 2: build server (TypeScript)
FROM node:22-slim AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
RUN npm prune --omit=dev

# Stage 3: runtime (un solo contenedor sirve API + cliente)
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/public
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=client /app/client/dist/client/browser ./public
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "dist/index.js"]
