# Git Pulse Architecture & Technical Specifications

## 1. Ecosystem Alignment (Prism Hub)

Git Pulse is a core member of the **Prism Hub** ecosystem, providing developer intelligence and automated daily standup reports.

- **Client**: `http://localhost:6100` (Next.js 15 App Router, React 19, Tailwind CSS v4)
- **Server**: `http://localhost:6101` (`/api/v1`) (NestJS 10 REST API, Prisma ORM)
- **Central Gateway (SSO)**: `http://localhost:5100` / `5101`
- **Database**: Local PostgreSQL 16 on `127.0.0.1:5432` (`git_pulse`)

---

## 2. Authentication Architecture

### 2.1 Central Gateway IAM (Google SSO)

All users authenticate via Google SSO managed centrally by **Central Gateway**.

1. Git Pulse client sends Google credentials or initiates OAuth2 with PKCE to `server/src/auth`.
2. Git Pulse backend forwards to Central Gateway `/auth/google` via secure S2S communication.
3. Upon Gateway verification, Git Pulse creates or updates a local shadow profile in `users` table and issues a secure `git_pulse_session` HttpOnly cookie.

### 2.2 Service-to-Service (S2S) Security Protocol

S2S communication between Git Pulse, Central Gateway, and Wonderlab enforces HMAC-SHA256 digital signatures with replay-attack protection:

- **Pre-Shared Symmetric Secrets**: Stored in `service_connections` PostgreSQL table (`slug`, `domain`, `apiKey`, `incomingSecret`).
- **Cryptographic Headers**:
  - `X-S2S-Service`: Identity slug of sending service (e.g. `git-pulse`, `central-gateway`).
  - `X-S2S-Timestamp`: Epoch timestamp in ms (`Date.now()`). Max allowable clock skew: 5 minutes (`300,000ms`).
  - `X-S2S-Signature`: HMAC-SHA256 hex digest of `${timestamp}.${method}.${normalizedPath}.${canonicalBody}` signed with the shared pre-shared secret.
  - `Authorization`: `Bearer <secret>` fallback for backward compatibility.
- **Constant-Time Verification**: Uses `crypto.timingSafeEqual` to prevent timing attacks.

### 2.3 GitHub Integration (OAuth / PAT)

1. Users connect their GitHub account using either:
   - **Personal Access Token (PAT)** (Fine-grained or Classic with `repo` scope).
   - **1-Click GitHub OAuth Flow**.
2. GitHub access tokens are **encrypted at rest** using **AES-256-GCM** before persisting in `git_accounts`.
3. The server decrypts the token on-the-fly only when querying GitHub APIs or Azure AI endpoints.

---

## 3. Dual-Core AI Architecture

Git Pulse introduces a Dual-Engine AI system that incurs **Zero Server Cost**:

1. **Warp-Drive Core (GitHub Models API)**:
   - Calls `https://models.inference.ai.azure.com/chat/completions` directly using the user's decrypted GitHub token.
   - Accesses frontier models: `gpt-4o-mini`, `meta-llama-3.3-70b-instruct`.
2. **Sub-Light Core (WebLLM WebGPU In-Browser)**:
   - Runs quantized LLMs (`Llama-3.2-1B`, `Qwen2.5-Coder-1.5B`) directly inside the user's browser using `@mlc-ai/web-llm` and WebGPU.
   - 100% private, client-side, zero token usage, works offline.
