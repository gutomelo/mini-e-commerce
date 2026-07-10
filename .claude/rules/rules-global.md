# Global Engineering Rules

## General Principles

* Always prioritize readability, maintainability, and scalability.
* Follow SOLID principles whenever applicable.
* Keep code simple and avoid unnecessary abstractions.
* Follow the Single Responsibility Principle.
* Favor composition over inheritance.
* Apply Clean Architecture concepts whenever possible.
* Keep business rules independent from frameworks.
* Prefer convention over configuration.

---

# Monorepo

This project uses a Turborepo-based monorepo.

## Structure

```text
apps/
packages/
docker/
docs/
```

## Applications

* web (Next.js Storefront)
* admin (Angular Admin)
* api (NestJS API Gateway/BFF)
* inventory (Go Inventory Service)
* payment (Spring Boot Payment Service)

## Shared Packages

Use the `packages` directory only for reusable modules.

Examples:

* ui
* shared
* config
* types

Avoid duplicating shared code across applications.

---

# Architecture

Use a Service-Oriented Architecture.

Each service must have a single responsibility.

Responsibilities must never overlap.

Communication rules:

* Frontends communicate only with NestJS.
* NestJS orchestrates the application.
* Inventory and Payment are independent services.
* Services communicate using REST or asynchronous events.

Never allow frontends to communicate directly with Go or Spring Boot.

---

# Event-Driven Architecture

Use Upstash QStash for asynchronous communication.

Examples:

* order.created
* inventory.updated
* payment.completed
* payment.failed

Every event must include:

* event
* timestamp
* correlationId
* payload

Services should never depend directly on each other when an event is sufficient.

---

# Cache

Use Upstash Redis exclusively for caching.

Cache only read operations.

Examples:

* Product List
* Product Details
* Categories

Always invalidate cache after write operations.

Never cache critical transactional data.

---

# Database

Use PostgreSQL.

Prefer migrations.

Never rely on automatic schema synchronization in production.

Repositories must abstract all database access.

Business logic must never access the database directly.

---

# API Standards

Follow RESTful conventions.

Always:

* Version APIs (`/api/v1`)
* Return proper HTTP status codes
* Validate all incoming requests
* Use DTOs
* Use pagination
* Use filtering
* Use consistent response objects

Generate Swagger/OpenAPI documentation.

---

# Security

Always implement:

* JWT Authentication
* Refresh Tokens
* Password hashing (bcrypt)
* Environment Variables
* CORS
* Rate Limiting
* Input Validation

Never expose secrets.

Always provide a `.env.example`.

---

# Logging

Use structured logging.

Every request should include a Correlation ID.

Never log:

* Passwords
* Tokens
* Secrets
* Sensitive personal information

Errors should always provide meaningful context.

---

# Error Handling

Use centralized exception handling.

Never expose internal stack traces to clients.

Return standardized error responses.

---

# Docker

Every application must have its own Dockerfile.

Development environment must use Docker Compose.

The entire development environment should start with:

```bash
docker compose up
```

---

# Testing

Prioritize:

* Unit Tests
* Integration Tests

Focus tests on:

* Business Rules
* Critical Flows
* API Endpoints

Avoid testing implementation details.

---

# Observability

Provide:

* /health endpoint
* Structured logs
* Correlation IDs

Keep the project ready for future integration with:

* OpenTelemetry
* Prometheus
* Grafana

---

# Next.js Rules

Use Next.js 16+ App Router.

Prefer Server Components.

Only use Client Components when required:

* State management
* Browser APIs
* Event handlers
* Effects

Avoid unnecessary client rendering.

---

## File Structure

```text
app/
    products/
        _components/
        actions/
        data-access/
        page.tsx
```

---

## Component Placement

### Page Components

Components used only within a route must live inside:

```text
app/**/_components
```

Never move them to global folders unnecessarily.

---

### Shared Components

Reusable components belong in:

```text
packages/ui
```

Only move components there when they are truly reusable.

---

## Data Access

Never fetch data directly inside UI components.

Use:

* data-access
* server actions
* services

Keep data access isolated.

---

## UI

Use:

* Shadcn UI
* Radix UI
* Tailwind CSS

Avoid:

* Inline styles
* Massive components
* Business logic inside UI

---

## TypeScript

Use strict typing.

Never use `any` unless absolutely necessary.

Always define:

* Interfaces
* Types
* DTOs

Prefer explicit types.

---

## React

Keep components small.

Prefer composition.

Avoid prop drilling.

Use Context only when appropriate.

Extract reusable logic into custom hooks.

---

# Angular Rules

Organize by feature.

Recommended structure:

```text
core/
shared/
features/
```

Keep business logic inside services.

Components should focus on presentation.

Avoid duplicated code.

---

# NestJS Rules

NestJS acts as the API Gateway (Backend for Frontend).

Responsibilities:

* Authentication
* Users
* Products
* Orders
* Cache
* Event Publishing

Controllers must remain thin.

Business logic belongs in Use Cases or Services.

Repositories should abstract persistence.

---

# Go Rules

Go is responsible only for Inventory.

Responsibilities:

* Inventory updates
* Inventory queries
* Event consumers

Avoid framework-heavy solutions.

Prefer the standard library whenever practical.

Keep packages cohesive.

---

# Spring Boot Rules

Spring Boot is responsible only for Payments.

Responsibilities:

* Payment processing
* Payment status
* Payment persistence

Follow layered architecture.

Use constructor injection.

Avoid business logic inside controllers.

---

# Backend Architecture

Every backend service should follow Clean Architecture.

Recommended layers:

```text
domain/
application/
infrastructure/
presentation/
```

Responsibilities:

* Domain → Business Rules
* Application → Use Cases
* Infrastructure → Database, Redis, HTTP Clients
* Presentation → Controllers, DTOs

Never place business logic inside controllers.

---

# Code Quality

Use:

* ESLint
* Prettier
* EditorConfig
* Husky
* lint-staged

Follow Conventional Commits.

Keep functions small.

Prefer descriptive names.

Avoid magic numbers.

---

# Documentation

Every application must contain:

* README
* Environment Variables
* Running Instructions
* Architecture Overview

The repository README should describe:

* Monorepo structure
* Services
* Technologies
* Application flow
* Development workflow

---

# Development Philosophy

When generating code:

* Prioritize simplicity.
* Prefer maintainable solutions over clever solutions.
* Avoid unnecessary abstractions.
* Generate production-quality code.
* Follow established framework conventions.
* Keep responsibilities clearly separated.
* Write code as if it will be maintained by a professional engineering team.

