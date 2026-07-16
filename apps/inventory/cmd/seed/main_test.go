package main

import (
	"slices"
	"testing"
)

func TestResolveProductIDs(t *testing.T) {
	tests := []struct {
		name         string
		slugs        []string
		slugToID     map[string]string
		wantResolved []string
		wantSkipped  []string
	}{
		{
			name:         "all slugs resolve",
			slugs:        []string{"a-slug", "b-slug"},
			slugToID:     map[string]string{"a-slug": "id-a", "b-slug": "id-b"},
			wantResolved: []string{"id-a", "id-b"},
			wantSkipped:  []string{},
		},
		{
			name:         "unknown slug is skipped, not an error",
			slugs:        []string{"a-slug", "renamed-slug"},
			slugToID:     map[string]string{"a-slug": "id-a"},
			wantResolved: []string{"id-a"},
			wantSkipped:  []string{"renamed-slug"},
		},
		{
			name:         "empty catalog skips every slug",
			slugs:        []string{"a-slug", "b-slug"},
			slugToID:     map[string]string{},
			wantResolved: []string{},
			wantSkipped:  []string{"a-slug", "b-slug"},
		},
		{
			name:         "no fixture slugs resolves nothing",
			slugs:        []string{},
			slugToID:     map[string]string{"a-slug": "id-a"},
			wantResolved: []string{},
			wantSkipped:  []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, skipped := resolveProductIDs(tt.slugs, tt.slugToID)

			if !slices.Equal(resolved, tt.wantResolved) {
				t.Errorf("resolved = %v, want %v", resolved, tt.wantResolved)
			}

			if !slices.Equal(skipped, tt.wantSkipped) {
				t.Errorf("skipped = %v, want %v", skipped, tt.wantSkipped)
			}
		})
	}
}

func TestSeedSlugsMatchesKnownCatalogSize(t *testing.T) {
	const wantCount = 12
	if len(seedSlugs) != wantCount {
		t.Fatalf("seedSlugs has %d entries, want %d (see apps/api/prisma/seed.ts)", len(seedSlugs), wantCount)
	}

	seen := map[string]bool{}
	for _, slug := range seedSlugs {
		if seen[slug] {
			t.Fatalf("duplicate slug in seedSlugs: %q", slug)
		}

		seen[slug] = true
	}
}
