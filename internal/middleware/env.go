package middleware

import "os"

// osGetenv is split out so tests can stub if needed; thin wrapper over os.
func osGetenv(key string) string { return os.Getenv(key) }
