# Stage 1: Build Frontend (Node.js)
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend (Go)
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod ./
RUN go mod download || true
COPY cmd/ ./cmd
COPY cybernetics/ ./cybernetics
# Embed frontend assets from stage 1 into the Go binary's directory
COPY --from=frontend-builder /app/frontend/dist ./static
RUN CGO_ENABLED=0 GOOS=linux go build -o cybernetics-server ./cmd/composer/main.go

# Stage 3: Final Production Image (Minimal)
FROM alpine:latest
WORKDIR /root/

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy Go binary and assets
COPY --from=backend-builder /app/cybernetics-server .
COPY --from=backend-builder /app/static ./static

# Security: Environment settings
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080
USER appuser

# Start the Go server (which serves the ./static files)
CMD ["./cybernetics-server"]