// Package middleware provides production-grade HTTP middleware: structured
// logging, request IDs, panic recovery, body size limits, bearer-token auth
// (constant-time), per-IP token-bucket rate limiting, strict CORS allowlist,
// and security response headers.
//
// All middleware is stdlib-only and composable: wrap an http.Handler with
// Chain(h, R1, R2, ...) so requests pass through in declaration order.
package middleware

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type ctxKey int

const (
	ctxRequestID ctxKey = iota
)

// RequestID returns the correlation ID attached to a request context, or "" if
// the request did not pass through WithRequestID.
func RequestID(ctx context.Context) string {
	if v, ok := ctx.Value(ctxRequestID).(string); ok {
		return v
	}
	return ""
}

// Chain composes middlewares left-to-right: Chain(h, A, B) yields A(B(h)).
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// statusRecorder captures the response status for access logging without
// buffering the body.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

func newRequestID() string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "req-unknown"
	}
	return hex.EncodeToString(b[:])
}

// WithRequestID attaches a per-request correlation ID (existing
// X-Request-ID is honoured, otherwise generated) and echoes it in the
// response header.
func WithRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" || len(id) > 64 {
			id = newRequestID()
		}
		ctx := context.WithValue(r.Context(), ctxRequestID, id)
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AccessLog logs every completed request as a structured JSON line with the
// request ID, method, path, status, byte count, and latency.
func AccessLog(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)
			logger.LogAttrs(r.Context(), slog.LevelInfo, "http.request",
				slog.String("request_id", RequestID(r.Context())),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.status),
				slog.Int("bytes", rec.bytes),
				slog.Duration("duration", time.Since(start)),
				slog.String("remote", clientIP(r)),
			)
		})
	}
}

// Recover converts panics into 500 responses without leaking stack traces to
// the client and emits a structured ERROR log with the request ID.
func Recover(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic recovered",
						slog.String("request_id", RequestID(r.Context())),
						slog.Any("panic", rec),
					)
					http.Error(w, "internal server error", http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// MaxBody caps request body size to limit; oversized bodies fail on read.
// Apply only to write endpoints — GETs typically have no body.
func MaxBody(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders sets sensible defaults: no sniff, no embed, strict referrer,
// HSTS, and a conservative Content-Security-Policy. Tune CSP per deployment
// via the CSP env var (any value overrides the default).
func SecurityHeaders(next http.Handler) http.Handler {
	csp := strings.TrimSpace(os.Getenv("CSP"))
	if csp == "" {
		// Default CSP: SPA-friendly but XSS-resistant.
		// - default-src 'self' blocks third-party loads.
		// - script-src 'self' rejects inline <script> and eval(); React app
		//   ships a single bundled JS file so this is sufficient.
		// - style-src allows 'unsafe-inline' because Tailwind / inline style
		//   props are common in React; safe given script-src is locked down.
		// - connect-src allows fetches to the same origin and the Gemini API
		//   directly (the BYOK path the frontend uses for /api/chat).
		// - frame-ancestors 'none' duplicates X-Frame-Options:DENY for browsers
		//   that prefer CSP.
		csp = "default-src 'self'; " +
			"script-src 'self'; " +
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob:; " +
			"font-src 'self' data:; " +
			"connect-src 'self' https://generativelanguage.googleapis.com; " +
			"frame-ancestors 'none'; " +
			"form-action 'self'; " +
			"base-uri 'self'; " +
			"object-src 'none'"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("Content-Security-Policy", csp)
		next.ServeHTTP(w, r)
	})
}

// CORS allows only origins explicitly in allowlist. An empty allowlist
// disables cross-origin entirely (Same-Origin only). "*" is never returned.
func CORS(allowlist []string) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, o := range allowlist {
		o = strings.TrimSpace(o)
		if o != "" {
			allowed[o] = struct{}{}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if _, ok := allowed[origin]; ok && origin != "" {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Vary", "Origin")
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
				h.Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// BearerAuth enforces Authorization: Bearer <token> using constant-time
// comparison. If expected is empty, auth is disabled (returns next unchanged) —
// callers should log a startup warning in that case.
// Paths matching any skipPrefix are bypassed (e.g. /healthz, /readyz, static
// frontend, "/api" preflight).
func BearerAuth(expected string, skipPrefix ...string) func(http.Handler) http.Handler {
	expectedBytes := []byte(expected)
	return func(next http.Handler) http.Handler {
		if expected == "" {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, p := range skipPrefix {
				if strings.HasPrefix(r.URL.Path, p) {
					next.ServeHTTP(w, r)
					return
				}
			}
			h := r.Header.Get("Authorization")
			const prefix = "Bearer "
			if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if subtle.ConstantTimeCompare([]byte(h[len(prefix):]), expectedBytes) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// TokenVerifier is the minimal interface a token verifier must implement to
// plug into OIDCAuth — kept narrow so handlers and tests can substitute fakes
// without dragging in the full oidc package.
type TokenVerifier interface {
	Verify(ctx context.Context, token string) (any, error)
}

// OIDCAuth enforces Bearer JWT tokens via a TokenVerifier. Returns 401 on any
// verification failure. skipPrefix paths bypass auth (e.g. /healthz, /readyz).
// If v is nil, auth is disabled and next is returned unchanged — log a startup
// warning in that case.
func OIDCAuth(v TokenVerifier, skipPrefix ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if v == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, p := range skipPrefix {
				if strings.HasPrefix(r.URL.Path, p) {
					next.ServeHTTP(w, r)
					return
				}
			}
			h := r.Header.Get("Authorization")
			const prefix = "Bearer "
			if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if _, err := v.Verify(r.Context(), h[len(prefix):]); err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ── Rate limiter (per-IP token bucket) ───────────────────────────────

type bucket struct {
	tokens float64
	last   time.Time
}

// RateLimiter is a per-client-IP token-bucket limiter safe for concurrent use.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity float64
	refillHz float64 // tokens per second
}

// NewRateLimiter creates a limiter with burst `capacity` and refill rate
// `perSecond` tokens/second per client IP.
func NewRateLimiter(capacity, perSecond float64) *RateLimiter {
	if capacity <= 0 {
		capacity = 1
	}
	if perSecond <= 0 {
		perSecond = 1
	}
	return &RateLimiter{
		buckets:  make(map[string]*bucket),
		capacity: capacity,
		refillHz: perSecond,
	}
}

// allow consumes one token for ip, returning false if the bucket is empty.
func (rl *RateLimiter) allow(ip string, now time.Time) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b, ok := rl.buckets[ip]
	if !ok {
		b = &bucket{tokens: rl.capacity, last: now}
		rl.buckets[ip] = b
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * rl.refillHz
	if b.tokens > rl.capacity {
		b.tokens = rl.capacity
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Middleware returns the limiter as an http middleware. Use behind CORS so
// the IP is the real client (caller is responsible for trusting any reverse
// proxy headers — see clientIP).
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.allow(clientIP(r), time.Now()) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP extracts the request IP, honouring X-Forwarded-For only if the
// TRUST_PROXY env is set to a non-empty value at process start (callers
// should not blindly trust headers).
func clientIP(r *http.Request) string {
	if trustProxy() {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if comma := strings.IndexByte(xff, ','); comma >= 0 {
				return strings.TrimSpace(xff[:comma])
			}
			return strings.TrimSpace(xff)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

var (
	trustProxyOnce sync.Once
	trustProxyVal  bool
)

func trustProxy() bool {
	trustProxyOnce.Do(func() {
		v := strings.TrimSpace(envOnce("TRUST_PROXY"))
		trustProxyVal = v == "1" || strings.EqualFold(v, "true")
	})
	return trustProxyVal
}

// envOnce is a process-lifetime read of env. Kept tiny to avoid pulling os.
func envOnce(key string) string {
	return osGetenv(key)
}

// ErrBodyTooLarge is returned by handlers that need to translate
// http.MaxBytesError into a 413.
var ErrBodyTooLarge = errors.New("request body too large")
