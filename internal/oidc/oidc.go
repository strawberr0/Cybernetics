// Package oidc provides a minimal, stdlib-only OIDC JWT verifier with a
// JWKS cache. It verifies RS256 signatures, issuer, audience, expiry, and
// not-before. It is designed for service-to-service auth (e.g. Cloud Run
// service account ID tokens, IAP-fronted requests, Workload Identity).
//
// Trade-offs:
//   - RS256 only (most enterprise IdPs default to this).
//   - JWKS refresh on cache miss / rotation; fixed 1-hour TTL otherwise.
//   - No nonce / state — this is for inbound API auth, not OAuth login.
package oidc

import (
	"context"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	// ErrInvalidToken is returned for any verification failure. The detailed
	// reason is wrapped (use errors.Is/As).
	ErrInvalidToken = errors.New("invalid token")
	// ErrJWKSUnavailable is returned when the issuer's keyset cannot be
	// fetched or parsed.
	ErrJWKSUnavailable = errors.New("jwks unavailable")
)

// Claims is the subset of OIDC claims this verifier validates.
type Claims struct {
	Issuer    string   `json:"iss"`
	Subject   string   `json:"sub"`
	Audience  Audience `json:"aud"`
	ExpiresAt int64    `json:"exp"`
	IssuedAt  int64    `json:"iat"`
	NotBefore int64    `json:"nbf"`
	Email     string   `json:"email,omitempty"`
	HD        string   `json:"hd,omitempty"` // Google Workspace hosted domain
}

// Audience tolerates both "aud":"x" and "aud":["x","y"] shapes.
type Audience []string

func (a *Audience) UnmarshalJSON(b []byte) error {
	if len(b) == 0 {
		return nil
	}
	if b[0] == '[' {
		var arr []string
		if err := json.Unmarshal(b, &arr); err != nil {
			return err
		}
		*a = arr
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	*a = []string{s}
	return nil
}

// Has reports whether the audience contains the given value.
func (a Audience) Has(v string) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}

// Verifier validates JWTs against a configured issuer and audience.
type Verifier struct {
	issuer    string
	audience  string
	clockSkew time.Duration

	httpClient *http.Client
	mu         sync.RWMutex
	jwksURL    string
	keys       map[string]*rsa.PublicKey
	keysAt     time.Time
	ttl        time.Duration
}

// Config configures a Verifier.
type Config struct {
	// Issuer is the expected "iss" claim. Required.
	Issuer string
	// Audience is the expected "aud" claim value. Required.
	Audience string
	// ClockSkew tolerates small clock drift; default 60s.
	ClockSkew time.Duration
	// HTTPClient overrides the default http.Client used to fetch JWKS.
	HTTPClient *http.Client
	// CacheTTL controls how long a JWKS is reused; default 1h.
	CacheTTL time.Duration
}

// NewVerifier constructs a Verifier. The JWKS URL is discovered lazily from
// the issuer's `.well-known/openid-configuration` on first verification.
func NewVerifier(cfg Config) (*Verifier, error) {
	if cfg.Issuer == "" {
		return nil, errors.New("oidc: issuer required")
	}
	if cfg.Audience == "" {
		return nil, errors.New("oidc: audience required")
	}
	v := &Verifier{
		issuer:     strings.TrimRight(cfg.Issuer, "/"),
		audience:   cfg.Audience,
		clockSkew:  cfg.ClockSkew,
		httpClient: cfg.HTTPClient,
		keys:       map[string]*rsa.PublicKey{},
		ttl:        cfg.CacheTTL,
	}
	if v.clockSkew == 0 {
		v.clockSkew = 60 * time.Second
	}
	if v.httpClient == nil {
		v.httpClient = &http.Client{Timeout: 5 * time.Second}
	}
	if v.ttl == 0 {
		v.ttl = time.Hour
	}
	return v, nil
}

// Verify parses, validates, and returns the claims of the given JWT.
// Returns ErrInvalidToken on any signature/claim failure.
func (v *Verifier) Verify(ctx context.Context, token string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: malformed JWT", ErrInvalidToken)
	}

	header, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("%w: header b64: %v", ErrInvalidToken, err)
	}
	var hdr struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
		Typ string `json:"typ"`
	}
	if err := json.Unmarshal(header, &hdr); err != nil {
		return nil, fmt.Errorf("%w: header json: %v", ErrInvalidToken, err)
	}
	if hdr.Alg != "RS256" {
		return nil, fmt.Errorf("%w: unsupported alg %q (RS256 only)", ErrInvalidToken, hdr.Alg)
	}
	if hdr.Kid == "" {
		return nil, fmt.Errorf("%w: missing kid", ErrInvalidToken)
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("%w: payload b64: %v", ErrInvalidToken, err)
	}
	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("%w: payload json: %v", ErrInvalidToken, err)
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("%w: signature b64: %v", ErrInvalidToken, err)
	}

	key, err := v.keyFor(ctx, hdr.Kid)
	if err != nil {
		return nil, err
	}

	signed := parts[0] + "." + parts[1]
	hashed := sha256.Sum256([]byte(signed))
	if err := rsa.VerifyPKCS1v15(key, cryptoSHA256(), hashed[:], sig); err != nil {
		return nil, fmt.Errorf("%w: signature: %v", ErrInvalidToken, err)
	}

	// Validate claims.
	now := time.Now()
	if claims.Issuer == "" || strings.TrimRight(claims.Issuer, "/") != v.issuer {
		return nil, fmt.Errorf("%w: issuer mismatch (got %q want %q)", ErrInvalidToken, claims.Issuer, v.issuer)
	}
	if !claims.Audience.Has(v.audience) {
		return nil, fmt.Errorf("%w: audience mismatch (want %q)", ErrInvalidToken, v.audience)
	}
	if claims.ExpiresAt == 0 || time.Unix(claims.ExpiresAt, 0).Add(v.clockSkew).Before(now) {
		return nil, fmt.Errorf("%w: token expired", ErrInvalidToken)
	}
	if claims.NotBefore > 0 && time.Unix(claims.NotBefore, 0).Add(-v.clockSkew).After(now) {
		return nil, fmt.Errorf("%w: token not yet valid", ErrInvalidToken)
	}
	return &claims, nil
}

// keyFor returns the RSA public key for the given kid, fetching JWKS on
// cache miss.
func (v *Verifier) keyFor(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	if k, ok := v.keys[kid]; ok && time.Since(v.keysAt) < v.ttl {
		v.mu.RUnlock()
		return k, nil
	}
	v.mu.RUnlock()

	v.mu.Lock()
	defer v.mu.Unlock()
	if k, ok := v.keys[kid]; ok && time.Since(v.keysAt) < v.ttl {
		return k, nil
	}
	if err := v.refreshLocked(ctx); err != nil {
		return nil, err
	}
	k, ok := v.keys[kid]
	if !ok {
		return nil, fmt.Errorf("%w: kid %q not in JWKS", ErrInvalidToken, kid)
	}
	return k, nil
}

func (v *Verifier) refreshLocked(ctx context.Context) error {
	if v.jwksURL == "" {
		if err := v.discoverLocked(ctx); err != nil {
			return err
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: HTTP %d", ErrJWKSUnavailable, resp.StatusCode)
	}

	var ks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			N   string `json:"n"`
			E   string `json:"e"`
			X5c []string `json:"x5c,omitempty"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ks); err != nil {
		return fmt.Errorf("%w: decode: %v", ErrJWKSUnavailable, err)
	}

	keys := make(map[string]*rsa.PublicKey, len(ks.Keys))
	for _, k := range ks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		// Prefer x5c if present (PEM-wrapped X.509) — strict path.
		if len(k.X5c) > 0 {
			certDER, err := base64.StdEncoding.DecodeString(k.X5c[0])
			if err != nil {
				continue
			}
			cert, err := x509.ParseCertificate(certDER)
			if err != nil {
				continue
			}
			if pub, ok := cert.PublicKey.(*rsa.PublicKey); ok {
				keys[k.Kid] = pub
				continue
			}
		}
		// Otherwise reconstruct from n/e.
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		var e int
		for _, b := range eBytes {
			e = e<<8 | int(b)
		}
		if e <= 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}
	}
	if len(keys) == 0 {
		return fmt.Errorf("%w: no usable RSA keys", ErrJWKSUnavailable)
	}
	v.keys = keys
	v.keysAt = time.Now()
	return nil
}

func (v *Verifier) discoverLocked(ctx context.Context) error {
	url := v.issuer + "/.well-known/openid-configuration"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: discovery HTTP %d", ErrJWKSUnavailable, resp.StatusCode)
	}
	var doc struct {
		JwksURI string `json:"jwks_uri"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("%w: discovery decode: %v", ErrJWKSUnavailable, err)
	}
	if doc.JwksURI == "" {
		return fmt.Errorf("%w: discovery missing jwks_uri", ErrJWKSUnavailable)
	}
	v.jwksURL = doc.JwksURI
	return nil
}

// _ pem reference to silence unused import linters in some toolchains.
var _ = pem.EncodeToMemory
