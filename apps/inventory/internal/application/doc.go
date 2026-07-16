// Package application holds the inventory service's use cases and the
// ports they depend on (StockRepository, ProcessedEventRepository,
// EventPublisher). Ports and use cases live flat in this single package
// rather than a nested ports/ subpackage: the port set is small (three
// interfaces) and every use case in this package needs to reference them,
// so a subpackage would only add an import qualifier with no encapsulation
// benefit. Infrastructure adapters (Postgres, QStash, fakes) implement
// these ports from internal/infrastructure; presentation handlers call
// these use cases from internal/presentation. No business logic lives
// outside this package and internal/domain.
package application
