# Git Pulse Security Architecture & Cryptographic Protocols

Git Pulse enforces enterprise-grade security standards to guarantee that developer credentials, personal access tokens, and cross-service communications remain isolated and uncompromised.

---

## 1. Threat Model & Design Principles

1. **Zero Raw Token Exposure**: Raw GitHub tokens are never stored in plaintext, logged to disk, or transmitted to downstream third-party analytics.
2. **Cryptographic Tenant Isolation**: Even if database rows are compromised, tokens cannot be decrypted in bulk because each user possesses an isolated derived key.
3. **No Dev Leaks in Production**: Production environments strictly require high-entropy 256-bit encryption keys and fail fast at startup if keys are missing or malformed.

---

## 2. GitHub Token Vault (AES-256-GCM + Per-User HKDF)

When a developer connects a GitHub Personal Access Token or OAuth credential:

1. **Key Derivation (HKDF-SHA256)**:
   A dedicated Data Encryption Key ($\text{DEK}_{\text{user}}$) is derived dynamically in memory using HMAC-based Extract-and-Expand Key Derivation:
   $$\text{DEK}_{\text{user}} = \text{HKDF-SHA256}(\text{MasterKey}, \text{Salt}=\text{userId}, \text{Info}=\text{"git-pulse-token-v1"}, 32)$$
2. **Authenticated Encryption (AES-256-GCM)**:
   - A unique 12-byte cryptographically secure initialization vector (IV) is generated via `crypto.randomBytes(12)`.
   - The token is encrypted with AES-256-GCM producing ciphertext and a 16-byte authentication tag.
   - The encrypted text, IV, tag, and key version are stored in `git_accounts`.
3. **Key Rotation & Versioning**:
   - Every encrypted record includes `keyVersion`.
   - Key rotation occurs with zero service downtime.

---

## 3. Zero-Leak Log Redaction

All logger streams, exception filters, and telemetry pipelines employ automated regex redaction to intercept and sanitize accidental token leaks:

- **Classic GitHub Tokens**: `ghp_[a-zA-Z0-9]{36}` -> `[REDACTED_GH_TOKEN]`
- **Fine-Grained PATs**: `github_pat_[a-zA-Z0-9_]{82}` -> `[REDACTED_GH_PAT]`
- **OAuth Access Tokens**: `gho_[a-zA-Z0-9]{36}` -> `[REDACTED_GH_OAUTH]`
- **Bearer Tokens**: `Bearer [a-zA-Z0-9\-._~+/]+=*` -> `Bearer [REDACTED]`

---

## 4. S2S Vault (Encryption-at-Rest for Microservices)

Central Gateway and Wonderlab pre-shared API keys and secrets stored in PostgreSQL are encrypted at rest using AES-256-GCM envelope encryption (`enc:v1:<iv>:<tag>:<ciphertext>`) via `s2s-vault.util.ts`:

- Inbound requests are verified timing-safely via `crypto.timingSafeEqual`.
- Clock skew is capped at 5 minutes (`300,000ms`) to thwart replay attacks.

---

## 5. Security Audit Trail (`token_audit_logs`)

All token state transitions trigger immutable audit logs:

| Action           | Description                              | Logged Metadata                                |
| :--------------- | :--------------------------------------- | :--------------------------------------------- |
| `PAT_SAVE`       | New token connected                      | IP address, User-Agent, Granted scopes, Expiry |
| `ACTIVITY_FETCH` | Token decrypted for activity fetch       | IP address, User-Agent, Status                 |
| `AI_SUMMARIZE`   | Token decrypted for AI synthesis         | Model name, PR count                           |
| `DISCONNECT`     | Token permanently wiped                  | IP address, User-Agent                         |
| `TOKEN_REVOKED`  | GitHub 401 detected, token auto-disabled | Timestamp, Failure reason                      |

Sensitive token values are strictly excluded from audit metadata.
