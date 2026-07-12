# syntax=docker/dockerfile:1
# Build context: apps/inventory (see docker-compose.yml)

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

# Minimal runtime; alpine keeps busybox wget available for compose healthchecks
FROM alpine:3.22 AS runner
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /out/server /usr/local/bin/server
USER app
ENV PORT=8081
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/server"]
