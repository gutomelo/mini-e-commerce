package qstash

import (
	"fmt"

	upstash "github.com/upstash/qstash-go"
)

// SignatureVerifier verifies the Upstash-Signature header of inbound QStash
// webhook requests against the account's signing keys.
//
// QStash signs each delivered request with a JWT (issuer "Upstash",
// subject the destination URL, and a claim carrying the base64url-encoded
// SHA-256 hash of the request body) using an HMAC key. Verification is
// delegated to the official qstash-go SDK's Receiver rather than
// hand-rolled here: getting JWT/HMAC verification subtly wrong (timing
// side channels, algorithm confusion, hash-comparison mistakes) is a real
// security risk, and the SDK is maintained by Upstash itself against its
// own signing implementation.
type SignatureVerifier struct {
	receiver *upstash.Receiver
}

// NewSignatureVerifier constructs a SignatureVerifier from the account's
// current and next signing keys (QSTASH_CURRENT_SIGNING_KEY /
// QSTASH_NEXT_SIGNING_KEY). Both are accepted, and tried in that order,
// because QStash rotates keys and accepts signatures made with either key
// during the rotation window.
func NewSignatureVerifier(currentSigningKey, nextSigningKey string) *SignatureVerifier {
	return &SignatureVerifier{
		receiver: upstash.NewReceiver(currentSigningKey, nextSigningKey),
	}
}

// Verify checks that signature (the raw Upstash-Signature header value) is
// a valid, unexpired JWT signed by either the current or next signing key,
// whose claims match destinationURL and body. It returns an error if
// signature fails to verify against both keys, if the destination URL
// claim does not match destinationURL, or if the body hash claim does not
// match a hash of body.
func (v *SignatureVerifier) Verify(signature, destinationURL, body string) error {
	err := v.receiver.Verify(upstash.VerifyOptions{
		Signature: signature,
		Url:       destinationURL,
		Body:      body,
	})
	if err != nil {
		return fmt.Errorf("verify qstash signature: %w", err)
	}

	return nil
}
