# payment — Spring Boot Payment Service

Owns the payments bounded context (simulated gateway, approval/rejection, payment records — arriving in Phase 5). Java 21, Maven. Internal service, never exposed through the reverse proxy.

## Run locally

Requires a JDK 21 (`JAVA_HOME` must point at a JDK, not a JRE):

```bash
./mvnw spring-boot:run   # http://localhost:8082  (or: pnpm turbo run dev --filter=payment)
```

## Health

`GET /health` → `{"status":"ok","service":"payment"}`. Spring Actuator stays at `/actuator/*`.

## Environment variables

- `SERVER_PORT` — HTTP port (default `8082` via `application.properties`).

Database and QStash variables arrive in Phase 5.

## Docker

`docker compose build payment`. Internal-only: reachable as `http://payment:8082` inside the Compose network; no host port.
