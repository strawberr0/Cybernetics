# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go server
FROM golang:1.22-alpine AS server-builder
WORKDIR /app
COPY go.mod ./
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/cybernetics-server ./cmd/composer

# Stage 3: Runtime
FROM alpine:latest
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=server-builder /out/cybernetics-server ./cybernetics-server
COPY --from=frontend-builder /app/frontend/dist ./static

# Port comes from $PORT (Cloud Run injects this). No hardcoded default in image.
USER appuser
CMD ["./cybernetics-server"]
