# syntax=docker/dockerfile:1
# Build context: apps/inventory (see docker-compose.yml)

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seed ./cmd/seed

# Minimal runtime; alpine keeps busybox wget available for compose healthchecks
FROM alpine:3.22 AS runner
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /out/server /usr/local/bin/server
COPY --from=builder /out/migrate /usr/local/bin/migrate
COPY --from=builder /out/seed /usr/local/bin/seed
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER app
ENV PORT=8081
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
