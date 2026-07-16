package qstash_test

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/qstash"
)

const (
	testCurrentSigningKey = "current-signing-key"
	testNextSigningKey    = "next-signing-key"
	testDestinationURL    = "https://inventory.example.com/internal/v1/events/qstash"
)

// bodyClaims mirrors the (unexported) claims shape QStash signs into its
// Upstash-Signature JWT: a "body" claim carrying the base64url-encoded
// SHA-256 hash of the request body, alongside standard registered claims.
type bodyClaims struct {
	Body string `json:"body"`
	jwt.RegisteredClaims
}

// signBody builds a QStash-shaped signature for body, signed with
// signingKey and asserting the given destination URL as its subject. It
// exists so these tests can exercise SignatureVerifier without a live
// Upstash account, per the phase's non-goal of no real QStash round-trip
// in automated verification.
func signBody(t *testing.T, signingKey, destinationURL, body string) string {
	t.Helper()

	hash := sha256.Sum256([]byte(body))
	bodyHash := strings.TrimRight(base64.URLEncoding.EncodeToString(hash[:]), "=")

	claims := bodyClaims{
		Body: bodyHash,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "Upstash",
			Subject:   destinationURL,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := token.SignedString([]byte(signingKey))
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}

	return signed
}

func TestSignatureVerifier_Verify(t *testing.T) {
	body := `{"event":"order.created","correlationId":"abc-123"}`

	t.Run("valid signature from the current key verifies", func(t *testing.T) {
		verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)
		signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

		if err := verifier.Verify(signature, testDestinationURL, body); err != nil {
			t.Fatalf("Verify() = %v, want nil", err)
		}
	})

	t.Run("valid signature from the next key verifies", func(t *testing.T) {
		verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)
		signature := signBody(t, testNextSigningKey, testDestinationURL, body)

		if err := verifier.Verify(signature, testDestinationURL, body); err != nil {
			t.Fatalf("Verify() = %v, want nil", err)
		}
	})

	t.Run("tampered body fails", func(t *testing.T) {
		verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)
		signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

		tamperedBody := body + "tampered"

		if err := verifier.Verify(signature, testDestinationURL, tamperedBody); err == nil {
			t.Fatal("Verify() = nil, want error for tampered body")
		}
	})

	t.Run("signature from an unknown key fails", func(t *testing.T) {
		verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)
		signature := signBody(t, "some-other-key", testDestinationURL, body)

		if err := verifier.Verify(signature, testDestinationURL, body); err == nil {
			t.Fatal("Verify() = nil, want error for signature from an unknown key")
		}
	})

	t.Run("mismatched destination URL fails", func(t *testing.T) {
		verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)
		signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

		if err := verifier.Verify(signature, "https://attacker.example.com/webhook", body); err == nil {
			t.Fatal("Verify() = nil, want error for mismatched destination URL")
		}
	})
}
