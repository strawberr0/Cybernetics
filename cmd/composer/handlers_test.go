package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListTemplates_ReturnsCatalog(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/templates", nil)
	listTemplates(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("want application/json got %q", ct)
	}
	var body struct {
		Templates []Template `json:"templates"`
		Adapters  []Adapter  `json:"adapters"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Templates) == 0 {
		t.Fatal("expected at least one template")
	}
	if len(body.Adapters) == 0 {
		t.Fatal("expected at least one adapter")
	}
}

func TestHealthz_AlwaysOK(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	healthz(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 got %d", rec.Code)
	}
}

func TestReadyz_StartingWhenNotReady(t *testing.T) {
	// ready defaults to false at test start
	ready.Store(false)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyz(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("want 503 got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "starting") {
		t.Fatalf("expected starting payload, got %s", rec.Body.String())
	}
}

func TestReadyz_DegradedWhenNoKey(t *testing.T) {
	ready.Store(true)
	t.Setenv("GEMINI_API_KEY", "")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyz(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("want 503 (degraded) got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "degraded") {
		t.Fatalf("expected degraded payload, got %s", rec.Body.String())
	}
}

func TestReadyz_OKWhenReadyAndKeyed(t *testing.T) {
	ready.Store(true)
	t.Setenv("GEMINI_API_KEY", "test")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyz(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 got %d (body=%s)", rec.Code, rec.Body.String())
	}
}

func TestDeployAgent_RejectsMissingFields(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/deploy", strings.NewReader(`{}`))
	deployAgent(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 got %d", rec.Code)
	}
}

func TestDeployAgent_HappyPath(t *testing.T) {
	body := `{"project_id":"p","region":"us-central1","service_name":"svc"}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/deploy", strings.NewReader(body))
	deployAgent(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 got %d (body=%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "gcloud run deploy svc") {
		t.Fatalf("expected gcloud command in response, got %s", rec.Body.String())
	}
}

func TestEnvIntDefaultsAndOverrides(t *testing.T) {
	if got := envInt("__MISSING__", 7); got != 7 {
		t.Fatalf("want 7 got %d", got)
	}
	t.Setenv("CYB_TEST_INT", "42")
	if got := envInt("CYB_TEST_INT", 7); got != 42 {
		t.Fatalf("want 42 got %d", got)
	}
	t.Setenv("CYB_TEST_INT", "not-a-number")
	if got := envInt("CYB_TEST_INT", 7); got != 7 {
		t.Fatalf("invalid value should fall back to default, got %d", got)
	}
}
