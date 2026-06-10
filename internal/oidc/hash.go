package oidc

import "crypto"

// cryptoSHA256 returns crypto.SHA256 — split into a tiny file to keep the
// import contained and to make stubbing easier in tests if ever needed.
func cryptoSHA256() crypto.Hash { return crypto.SHA256 }
