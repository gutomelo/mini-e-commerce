// Package migrations embeds the golang-migrate SQL files so cmd/migrate can
// apply them regardless of the process's working directory — notably
// inside a container image where only the compiled binary is copied.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
