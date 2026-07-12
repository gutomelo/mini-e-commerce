# Phase 01 Implementation Decisions

Decisions made during Phase 01 (Walking Skeleton) implementation, recorded so later phases inherit them explicitly.

## 1. Angular pinned to v21 (not v22)

Angular CLI 22 requires Node >= 24.15 (machine has 24.14.0) and TypeScript 6 (workspace is pinned to 5.9.x until typescript-eslint supports TS >= 6). Angular 21 accepts TS `>=5.9 <6.1` and the installed Node. Revisit together with the TypeScript pin.

## 2. Host toolchain requirements surfaced by this phase

- **Docker group:** the local user is not in the `docker` group, so image builds and `docker compose` runs require `sudo usermod -aG docker $USER` (plus a new login/session). Compose file syntax was validated client-side (`docker compose config`).
- **JDK 21:** the machine had only JREs; Maven compilation requires a JDK. A user-local Temurin JDK 21 was installed at `~/.jdks/jdk-21.0.11+10` for verification (`JAVA_HOME` must point at it). Recommended permanent fix: `sudo apt install openjdk-21-jdk`.

## 3. Java 21 instead of the current LTS (25)

The spec says "current LTS Java"; Java 25 has been the current LTS since September 2025. The payment service targets **Java 21** (also an active LTS) because it is the JDK line available on the development machine and in the OS packages, keeping local runs, CI-less verification, and the `eclipse-temurin:21` images aligned. Revisit when the toolchain moves.

## 4. Dockerfile authorship deviation

The plan assigned each Dockerfile to its stack specialist agent. With the Docker daemon inaccessible, specialists could not build or verify images, so the orchestrator wrote all five Dockerfiles inline following the documented Turborepo Docker pattern (`turbo prune --docker` for the three Node apps) and delegated correctness checking to the code review + the `/verify-phase` gate. Content ownership rules were otherwise respected.

## 5. Compose environment defaults

`docker-compose.yml` uses variable substitution with safe defaults (`${POSTGRES_USER:-postgres}` etc.) instead of a required `env_file`, so the stack boots without a `.env` while still honoring one when present. No app connects to PostgreSQL in this phase.

## 6. Turborepo wrappers for Go and Maven

`apps/inventory` and `apps/payment` carry thin `package.json` wrappers (`build`, `dev`) plus per-package `turbo.json` overrides (`outputs: []` for Go, `target/**` for Maven) so one command drives all five stacks without polluting the root task config.
