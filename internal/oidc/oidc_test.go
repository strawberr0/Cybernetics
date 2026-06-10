package oidc

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// signJWT creates an RS256-signed JWT for tests.
func signJWT(t *testing.T, key *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	hdr := map[string]string{"alg": "RS256", "kid": kid, "typ": "JWT"}
	hb, _ := json.Marshal(hdr)
	pb, _ := json.Marshal(claims)
	signing := base64.RawURLEncoding.EncodeToString(hb) + "." + base64.RawURLEncoding.EncodeToString(pb)
	sum := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, cryptoSHA256(), sum[:])
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signing + "." + base64.RawURLEncoding.EncodeToString(sig)
}

// jwksHandler returns an httptest server exposing OIDC discovery + JWKS.
func jwksHandler(t *testing.T, kid string, key *rsa.PublicKey) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	var srv *httptest.Server
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"jwks_uri": srv.URL + "/jwks"})
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, r *http.Request) {
		n := base64.RawURLEncoding.EncodeToString(key.N.Bytes())
		e := base64.RawURLEncoding.EncodeToString(intBytes(key.E))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{
				{"kid": kid, "kty": "RSA", "alg": "RS256", "n": n, "e": e},
			},
		})
	})
	srv = httptest.NewServer(mux)
	return srv
}

func intBytes(n int) []byte {
	b := make([]byte, 0, 4)
	for n > 0 {
		b = append([]byte{byte(n & 0xff)}, b...)
		n >>= 8
	}
	if len(b) == 0 {
		return []byte{0}
	}
	return b
}

func TestVerifier_HappyPath(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	const kid = "test-kid"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()

	v, err := NewVerifier(Config{Issuer: srv.URL, Audience: "my-aud"})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	tok := signJWT(t, priv, kid, map[string]any{
		"iss": srv.URL,
		"sub": "user-1",
		"aud": "my-aud",
		"iat": now.Unix(),
		"exp": now.Add(5 * time.Minute).Unix(),
	})
	claims, err := v.Verify(context.Background(), tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.Subject != "user-1" {
		t.Fatalf("want sub=user-1 got %q", claims.Subject)
	}
}

func TestVerifier_RejectsBadSignature(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	const kid = "k1"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()
	v, _ := NewVerifier(Config{Issuer: srv.URL, Audience: "aud"})

	// Sign with a different key
	otherPriv, _ := rsa.GenerateKey(rand.Reader, 2048)
	now := time.Now()
	tok := signJWT(t, otherPriv, kid, map[string]any{
		"iss": srv.URL, "aud": "aud", "exp": now.Add(time.Minute).Unix(),
	})
	_, err := v.Verify(context.Background(), tok)
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("want ErrInvalidToken, got %v", err)
	}
}

func TestVerifier_RejectsExpired(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	const kid = "k1"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()
	v, _ := NewVerifier(Config{Issuer: srv.URL, Audience: "aud"})

	tok := signJWT(t, priv, kid, map[string]any{
		"iss": srv.URL, "aud": "aud",
		"exp": time.Now().Add(-10 * time.Minute).Unix(),
	})
	_, err := v.Verify(context.Background(), tok)
	if !errors.Is(err, ErrInvalidToken) || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("want expired, got %v", err)
	}
}

func TestVerifier_RejectsWrongAudience(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	const kid = "k1"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()
	v, _ := NewVerifier(Config{Issuer: srv.URL, Audience: "expected-aud"})

	tok := signJWT(t, priv, kid, map[string]any{
		"iss": srv.URL, "aud": "other-aud",
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	_, err := v.Verify(context.Background(), tok)
	if !errors.Is(err, ErrInvalidToken) || !strings.Contains(err.Error(), "audience") {
		t.Fatalf("want audience mismatch, got %v", err)
	}
}

func TestVerifier_RejectsWrongIssuer(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	const kid = "k1"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()
	v, _ := NewVerifier(Config{Issuer: srv.URL, Audience: "aud"})

	tok := signJWT(t, priv, kid, map[string]any{
		"iss": "https://attacker.example.com", "aud": "aud",
		"exp": time.Now().Add(time.Minute).Unix(),
	})
	_, err := v.Verify(context.Background(), tok)
	if !errors.Is(err, ErrInvalidToken) || !strings.Contains(err.Error(), "issuer") {
		t.Fatalf("want issuer mismatch, got %v", err)
	}
}

func TestVerifier_RejectsAlgNotRS256(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	const kid = "k1"
	srv := jwksHandler(t, kid, &priv.PublicKey)
	defer srv.Close()
	v, _ := NewVerifier(Config{Issuer: srv.URL, Audience: "aud"})

	// Construct a token with alg=none manually
	hdr := map[string]string{"alg": "none", "kid": kid, "typ": "JWT"}
	hb, _ := json.Marshal(hdr)
	pb, _ := json.Marshal(map[string]any{"iss": srv.URL, "aud": "aud", "exp": time.Now().Add(time.Minute).Unix()})
	tok := base64.RawURLEncoding.EncodeToString(hb) + "." + base64.RawURLEncoding.EncodeToString(pb) + "."
	_, err := v.Verify(context.Background(), tok)
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("want ErrInvalidToken for alg=none, got %v", err)
	}
}

func TestAudience_UnmarshalBothShapes(t *testing.T) {
	var s Audience
	if err := json.Unmarshal([]byte(`"single"`), &s); err != nil || !s.Has("single") {
		t.Fatalf("string aud: %v %v", err, s)
	}
	var m Audience
	if err := json.Unmarshal([]byte(`["a","b"]`), &m); err != nil || !m.Has("b") {
		t.Fatalf("array aud: %v %v", err, m)
	}
}

func TestNewVerifier_RequiresIssuerAndAudience(t *testing.T) {
	if _, err := NewVerifier(Config{}); err == nil {
		t.Fatal("expected error for empty issuer")
	}
	if _, err := NewVerifier(Config{Issuer: "x"}); err == nil {
		t.Fatal("expected error for empty audience")
	}
}
