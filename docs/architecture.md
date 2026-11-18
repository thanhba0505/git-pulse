# Git Pulse Architecture & Technical Specifications

This document outlines the architectural blueprint, security protocols, AI execution models, and data flows of **Git Pulse**.

```mermaid
graph TD
    User["Developer Browser (Next.js 15 Client)"] -->|HTTPS / WSS| Edge["Vercel Edge Network"]
    Edge --> ClientApp["git-pulse-client (Next.js 15 App Router on Vercel)"]
    Edge --> ServerAPI["git-pulse-server (NestJS 10 on Vercel Serverless)"]
    ServerAPI -->|Pooled Connection| NeonDB["Neon Lakebase PostgreSQL 16 (AWS Oregon)"]
    ServerAPI -->|HMAC-SHA256 S2S| Gateway["Central Gateway (IAM Master & SSO)"]
    ClientApp -->|In-Browser WebGPU| WebLLM["Local WebLLM Core (Llama-3.2-1B / Qwen2.5)"]
    ServerAPI -->|Decrypted Token| GitHubAPI["GitHub REST & GraphQL API"]
    ServerAPI -->|Decrypted Token| GitHubModels["GitHub Models Frontier AI (Azure Inference)"]
```

---

## 1. Ecosystem Alignment (Prism Hub)

Git Pulse is a core intelligence layer within the **Prism Hub** ecosystem, delivering developer productivity analytics and automated standup report synthesis:

- **Git Pulse Client**: [git-pulse-app.vercel.app](https://git-pulse-app.vercel.app) (Local: `http://localhost:6100`)
- **Git Pulse Server**: [git-pulse-server.vercel.app/api/v1](https://git-pulse-server.vercel.app/api/v1) (Local: `http://localhost:6101`)
- **Central Gateway (SSO & IAM)**: [central-gateway-client.vercel.app](https://central-gateway-client.vercel.app) (Local: `http://localhost:5100` / `5101`)
- **Wonderlab**: [wonderlab.io.vn](https://wonderlab.io.vn) (Local: `http://localhost:4100` / `4101`)
- **Production Database**: Neon Lakebase PostgreSQL 16 (`us-west-2` AWS Oregon) with connection pooling.
- **Local Database**: PostgreSQL 16 Docker container on `127.0.0.1:5432` (`git_pulse`).

---

## 2. Authentication Architecture

### 2.1 Central Gateway IAM (Google SSO)

All users authenticate centrally through **Central Gateway**:

1. Git Pulse Client initiates Google Sign-In or OAuth2 with PKCE flow forwarding to `server/src/auth`.
2. Git Pulse Server communicates with Central Gateway via HMAC-signed Service-to-Service (S2S) requests.
3. Upon Gateway identity validation, Git Pulse syncs a local shadow profile in the `users` table and issues a secure HttpOnly session cookie (`git_pulse_session`). Offline JWT verification ensures sub-millisecond route guards with zero latency overhead.

### 2.2 Service-to-Service (S2S) Cryptographic Protocol

Cross-service communication between Git Pulse, Central Gateway, and Wonderlab enforces HMAC-SHA256 digital signatures with a strict 5-minute replay window:

- **Pre-Shared Symmetric Secrets**: Stored in `service_connections` PostgreSQL table (`slug`, `domain`, `apiKey`, `incomingSecret`).
- **Encrypted-at-Rest Secrets (S2S Vault)**: All secrets in PostgreSQL are encrypted using AES-256-GCM (`enc:v1:<iv>:<tag>:<ciphertext>`) via `s2s-vault.util.ts`. Production strictly enforces a dedicated 256-bit `S2S_ENCRYPTION_KEY`.
- **Cryptographic Headers**:
  - `X-S2S-Service`: Identity slug of sending service (`git-pulse`).
  - `X-S2S-Timestamp`: Epoch timestamp in ms (`Date.now()`). Max clock skew allowable: 5 minutes (`300,000ms`).
  - `X-S2S-Signature`: HMAC-SHA256 hex digest of `${timestamp}.${method}.${normalizedPath}.${canonicalBody}` signed with the decrypted shared secret.
- **Constant-Time Verification**: Enforces `crypto.timingSafeEqual` in `S2SAuthGuard` to prevent timing side-channel attacks.

### 2.3 GitHub Integration & Token Security (OAuth / PAT)

1. Developers link GitHub credentials via Personal Access Token (Fine-Grained or Classic) or 1-Click OAuth.
2. **Multi-Layer Cryptographic Hardening**:
   - Stored using **AES-256-GCM** with **Per-User HKDF Key Derivation**:
     $$\text{DEK}_{\text{user}} = \text{HKDF-SHA256}(\text{MasterKey}, \text{Salt}=\text{userId}, \text{Info}=\text{"git-pulse-token-v1"}, 32)$$
   - Production fail-fast: Server strictly requires 256-bit `GITHUB_TOKEN_ENCRYPTION_KEY` in production.
   - Key versioning (`keyVersion`) allows seamless zero-downtime key rotation.
3. **Least Privilege & Scope Guardrails**:
   - Detects over-privileged scopes (`delete_repo`, `admin:org`, `workflow`) and flags warnings on the client UI.
   - Tracks token expiration date (`expiresAt`) for Fine-Grained PATs.
4. **Lifecycle & Self-Healing**:
   - Automatic `REVOKED` status transition upon HTTP 401 Bad Credentials from GitHub API, halting background polling immediately.
   - User disconnect irrevocably purges encrypted tokens and logs a `DISCONNECT` audit record.
5. **Zero-Leak Redaction & Audit Logs**:
   - Global regex redaction for `ghp_`, `github_pat_`, and `gho_` tokens in logs and traces.
   - Detailed `token_audit_logs` record every decryption, save, and revocation with client IP and User-Agent.
   - Rate limited with NestJS Throttler (`@Throttle` 5 attempts/min on sensitive token routes).

---

## 3. Dual-Core AI Architecture

Git Pulse introduces a Dual-Engine AI system that incurs **Zero Server Compute Costs**:

1. **GitHub Models (Cloud)**:
   - Dispatches inference requests directly to `https://models.inference.ai.azure.com/chat/completions` using the developer's decrypted GitHub token.
   - Supported models: `gpt-4o-mini`, `meta-llama-3.3-70b-instruct`.
2. **WebLLM (In-Browser WebGPU)**:
   - Executes quantized models (`Llama-3.2-1B-Instruct-q4f16_1-MLC`, `Qwen2.5-Coder-1.5B`) directly inside the user's browser via WebGPU using `@mlc-ai/web-llm`.
   - 100% private, client-side, zero token usage, functional offline.
