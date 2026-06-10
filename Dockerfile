# Stage 1: Build the frontend (Vite/React) -> frontend/dist
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go web server (cmd/composer)
# This is the actual production server: it serves the Gemini-backed API
# (/api/templates, /api/compose, /api/deploy, /api/chat) and the static
# frontend from ./static. The Go module is rooted at the repo (go.mod) with its
# entrypoint at ./cmd/composer. Stdlib-only build — no go.sum / module download.
FROM golang:1.22-alpine AS server-builder
WORKDIR /app
COPY go.mod ./

# Stage 3: Minimal production image
FROM alpine:latest
WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Server binary + built frontend (the server reads ./static relative to its CWD)
COPY --from=server-builder /out/cybernetics-server ./cybernetics-server
COPY --from=frontend-builder /app/frontend/dist ./static

# Cloud Run injects $PORT; the server honours it (defaults to 3001 otherwise).
ENV PORT=8080
EXPOSE 8080
USER appuser

# Start the Go server (serves ./static + /api/*)
CMD ["./cybernetics-server"]
