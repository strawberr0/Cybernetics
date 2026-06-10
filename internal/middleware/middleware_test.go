package middleware

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newReq(method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.RemoteAddr = "10.0.0.1:1234"
	_ = req // appease linters in older Go
	_ = rec
	return rec
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
}

func TestWithRequestID_GeneratesAndEchoes(t *testing.T) {
	h := WithRequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id := RequestID(r.Context()); id == "" {
			t.Fatal("expected request id in context")
		}
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	h.ServeHTTP(rec, req)
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("X-Request-ID not echoed")
	}
}

func TestWithRequestID_RespectsClientHeader(t *testing.T) {
	const want = "client-supplied-id"
	h := WithRequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := RequestID(r.Context()); got != want {
			t.Fatalf("want %q got %q", want, got)
		}
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("X-Request-ID", want)
	h.ServeHTTP(rec, req)
}

func TestWithRequestID_RejectsOverlongHeader(t *testing.T) {
	long := strings.Repeat("a", 200)
	h := WithRequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id := RequestID(r.Context()); id == long {
			t.Fatal("overlong header should be replaced")
		}
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("X-Request-ID", long)
	h.ServeHTTP(rec, req)
}

func TestRecover_TurnsPanicInto500(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := Recover(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500 got %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Fatal("panic value leaked to client")
	}
}

func TestMaxBody_Enforces413OnOversize(t *testing.T) {
	called := false
	h := MaxBody(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader("this body is too big"))
	h.ServeHTTP(rec, req)
	if !called {
		t.Fatal("handler not invoked")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("want 413 got %d", rec.Code)
	}
}

func TestCORS_AllowlistOnly(t *testing.T) {
	h := CORS([]string{"https://app.example.com"})(okHandler())
	t.Run("allowed origin echoed", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "https://app.example.com")
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
			t.Fatalf("want allowed origin echoed, got %q", got)
		}
	})
	t.Run("disallowed origin not echoed", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "https://evil.example.com")
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("disallowed origin should not be echoed, got %q", got)
		}
	})
	t.Run("never wildcard", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "*")
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
			t.Fatal("wildcard origin leaked")
		}
	})
}

func TestBearerAuth_RequiresExactToken(t *testing.T) {
	h := BearerAuth("s3cr3t", "/healthz")(okHandler())
	cases := []struct {
		name   string
		header string
		path   string
		want   int
	}{
		{"missing", "", "/api/x", http.StatusUnauthorized},
		{"wrong scheme", "Basic abc", "/api/x", http.StatusUnauthorized},
		{"wrong token", "Bearer nope", "/api/x", http.StatusUnauthorized},
		{"correct token", "Bearer s3cr3t", "/api/x", http.StatusOK},
		{"skip health", "", "/healthz", http.StatusOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, c.path, nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}
			h.ServeHTTP(rec, req)
			if rec.Code != c.want {
				t.Fatalf("want %d got %d", c.want, rec.Code)
			}
		})
	}
}

func TestBearerAuth_DisabledWhenEmpty(t *testing.T) {
	h := BearerAuth("")(okHandler())
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/x", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 (auth disabled), got %d", rec.Code)
	}
}

func TestRateLimiter_BurstAndRefill(t *testing.T) {
	rl := NewRateLimiter(2, 10) // burst 2, refill 10/s
	now := time.Unix(0, 0)
	if !rl.allow("1.2.3.4", now) {
		t.Fatal("first token denied")
	}
	if !rl.allow("1.2.3.4", now) {
		t.Fatal("second token denied")
	}
	if rl.allow("1.2.3.4", now) {
		t.Fatal("third token should be denied (bucket empty)")
	}
	// 200ms later → 2 tokens refilled
	if !rl.allow("1.2.3.4", now.Add(200*time.Millisecond)) {
		t.Fatal("token should refill within 200ms at 10/s")
	}
}

func TestRateLimiter_PerIPIsolation(t *testing.T) {
	rl := NewRateLimiter(1, 1)
	now := time.Unix(0, 0)
	if !rl.allow("1.1.1.1", now) {
		t.Fatal("denied first request from 1.1.1.1")
	}
	if !rl.allow("2.2.2.2", now) {
		t.Fatal("buckets should be per-IP — 2.2.2.2 should have its own")
	}
}

func TestChain_OrderLeftToRight(t *testing.T) {
	var order []string
	mw := func(name string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	h := Chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "handler")
	}), mw("A"), mw("B"))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	h.ServeHTTP(rec, req)
	want := []string{"A", "B", "handler"}
	if len(order) != len(want) {
		t.Fatalf("want %v got %v", want, order)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("step %d: want %s got %s", i, want[i], order[i])
		}
	}
}

func TestRequestID_DefaultNoContextEmpty(t *testing.T) {
	if got := RequestID(context.Background()); got != "" {
		t.Fatalf("want empty, got %q", got)
	}
}
