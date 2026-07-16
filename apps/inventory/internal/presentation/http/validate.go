package http

import "regexp"

// uuidPattern matches the canonical 8-4-4-4-12 hyphenated UUID text form,
// case-insensitively. The standard library has no UUID type or parser, and
// this service has no existing UUID dependency to reuse, so a small
// compiled regexp is the least-dependency way to reject a malformed
// productId before it ever reaches the repository layer — matching how
// apps/api's NestJS controllers use ParseUUIDPipe at the boundary.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isValidUUID reports whether s is a well-formed UUID string.
func isValidUUID(s string) bool {
	return uuidPattern.MatchString(s)
}
