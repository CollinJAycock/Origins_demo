# syntax=docker/dockerfile:1

# Build: install exactly what the lockfile pins (cached until it changes), then type-check and bundle.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve: static files from nginx, which also proxies /api to the API container. The unprivileged image
# runs nginx as a non-root user, listening on port 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
