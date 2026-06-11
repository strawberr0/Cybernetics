# syntax=docker/dockerfile:1.7
# ────────────────────────────────────────────────────────────────────
# Multi-stage, distroless, non-root production image.
# Hardening: no shell, read-only root FS compatible, scratch-equivalent
# attack surface, build provenance via Go ldflags + cosign keyless sign.
# ────────────────────────────────────────────────────────────────────

# Stage 1: Frontend build
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Go server build (static, stripped, reproducible)
FROM golang:1.23-alpine AS server-builder
ARG VERSION=dev
ARG COMMIT=unknown
WORKDIR /src
COPY go.mod ./
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -buildvcs=false \
      -ldflags "-s -w -X main.buildVersion=${VERSION} -X main.buildCommit=${COMMIT}" \
      -o /out/composer ./cmd/composer

# Stage 3: Runtime — distroless static-nonroot (uid 65532, no shell, no libc)
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=server-builder /out/composer /app/composer
COPY --from=frontend-builder /app/frontend/dist /app/static

# Read-only root FS compatible; /tmp is the only writable surface if needed.
# Cloud Run injects $PORT; honour it or fall back to 8080.
USER nonroot:nonroot
ENTRYPOINT ["/app/composer"]
