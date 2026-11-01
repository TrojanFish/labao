# ============================================================
# YoloCycling — Multi-stage Docker Build
# Stage 1: Node 20 Alpine — build React/Vite app
# Stage 2: Nginx Alpine — serve static files
# ============================================================

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer cache optimization)
COPY package.json package-lock.json ./

RUN npm ci --frozen-lockfile

# Copy source and build
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /var/www/yolocycling/dist

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/sites-available/yolocycling.app
RUN mkdir -p /etc/nginx/sites-enabled && \
    ln -s /etc/nginx/sites-available/yolocycling.app /etc/nginx/sites-enabled/yolocycling.app && \
    nginx -t

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/robots.txt || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
