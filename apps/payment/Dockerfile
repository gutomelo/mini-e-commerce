# syntax=docker/dockerfile:1
# Build context: apps/payment (see docker-compose.yml)

FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -q dependency:go-offline
COPY src ./src
RUN ./mvnw -q -DskipTests package

# JRE-only runtime; alpine keeps busybox wget available for compose healthchecks.
# postgresql-client provides psql for the entrypoint's create-database-if-missing step.
FROM eclipse-temurin:21-jre-alpine AS runner
RUN apk add --no-cache postgresql-client \
    && addgroup -S app && adduser -S app -G app
COPY --from=builder /src/target/*.jar /app/app.jar
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER app
ENV SERVER_PORT=8082
EXPOSE 8082
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
