# AGENTS.md — Git Pulse AI Coding Guidelines

Primary rules and engineering standards for AI coding assistants working in Git Pulse.

> [!CRITICAL]
>
> ### 🚨 Mandatory Single-Workspace & Standard Ports Protocol
>
> 1. **Primary Workspace**: The repository root directory is the sole and primary development workspace.
> 2. **Standard Ecosystem Ports (Prism Hub)**:
>    - Git Pulse Client: `http://localhost:6100`
>    - Git Pulse Server: `http://localhost:6101` (`/api/v1`)
>    - Central Gateway Client: `http://localhost:5100`
>    - Central Gateway Server: `http://localhost:5101` (`/api/v1`)
>    - Wonderlab Client: `http://localhost:4100`
>    - Wonderlab Server: `http://localhost:4101` (`/api/v1`)
>    - Database: Local PostgreSQL 16 on `127.0.0.1:5432` (`git_pulse`)
> 3. **Execution Workflow**:
>    ```bash
>    git fetch origin && git checkout -B <type>/<task-name> origin/develop
>    # Edits & verification:
>    pnpm check
>    # Direct push to develop & cleanup:
>    git fetch origin && git rebase origin/develop && git push origin HEAD:develop
>    git checkout develop && git pull origin develop && git branch -d <type>/<task-name>
>    ```
> 4. **No Worktrees**: Do not create or use git worktrees. All development and dev servers operate directly in the main repository using standard assigned ports.

---

## 1. Project Overview & Architecture

- **Mission**: Developer Intelligence & Git Workspace. Aggregates daily pull requests and commits, generates concise standup reports using Dual-Engine AI (GitHub Models & WebLLM WebGPU), and provides clean Git activity visibility.
- **Brand Naming**: The platform is strictly named **`Git Pulse`** (spaced, never hyphenated as `Git-Pulse`).
- **Monorepo**: Unified `pnpm` monorepo (`client/`, `server/`, `docs/`, `scripts/`).
- **Client (`client/`)**: Next.js 15 App Router, React 19, Tailwind CSS. Deployed to Vercel at `https://git-pulse-app.vercel.app`.
- **Server (`server/`)**: NestJS 10 REST API. Global prefix `/api/v1`, Swagger `/api/docs`, health check `/api/v1/health`. Deployed to Vercel with Fluid Serverless at `https://git-pulse-server.vercel.app`.
- **Database**: Neon Serverless PostgreSQL 16 (AWS Oregon `us-west-2`) with connection pooling in production; local Docker PostgreSQL 16 on `127.0.0.1:5432` in development.
- **Runtime & Tools**: Node `v24.x` (`.nvmrc`), `pnpm@12.11.2`. Never use `npm` or `yarn`.

---

## 2. Security & Environment Standards

- **Zero Secret Leaks**: Never commit `.env*` or tokens.
- **Client Boundaries**: Only `NEXT_PUBLIC_*` variables allowed in client code.
- **Production Database Safety & Migration Protocol**:
  - STRICTLY FORBID executing manual or ad-hoc database migrations, schema pushes, or seed scripts (`prisma migrate deploy`, `prisma db push`, `prisma db seed`) directly against remote Neon production databases from local terminal or agent turns.
  - Production database schema migrations must ONLY run automatically through the official Release workflow / CI/CD pipeline when releasing a new version (`v*.*.*`).
- **Token Security**:
  - GitHub access tokens and PATs are encrypted at rest using **AES-256-GCM** with **Per-User HKDF Key Derivation** (`crypto.hkdfSync`).
  - Production fail-fast: Server strictly requires a high-entropy 256-bit `ENCRYPTION_KEY` in production.
  - Automatic scope analysis: detects and alerts on over-privileged scopes (`delete_repo`, `admin:org`).
  - Expiration tracking: reads and stores `expiresAt` for Fine-Grained PATs.
  - Zero-leak logger: regex redaction for all GitHub token patterns (`ghp_`, `github_pat_`, `gho_`).
  - Audit logging: all token operations (save, decrypt, purge, revoke) are logged to `token_audit_logs`.
  - Rate limiting: `@Throttle` (max 5 requests/min) on PAT and OAuth verification endpoints.
- **SSO Authentication**: Central Gateway handles Google Authentication. Git Pulse syncs shadow profiles and validates sessions via HttpOnly cookies (`git_pulse_session`).
- **Service-to-Service (S2S) Architecture**:
  - Connections managed dynamically via `service_connections` database table (`slug`, `domain`, `apiPrefix`, `apiKey`, `incomingSecret`, `isActive`).
  - `apiKey` and `incomingSecret` stored in PostgreSQL are encrypted at rest using AES-256-GCM (`enc:v1:<iv>:<tag>:<ciphertext>`) via `s2s-vault.util.ts`. Requires dedicated 256-bit `S2S_ENCRYPTION_KEY`.
  - Strict HMAC-SHA256 signature verification (`X-S2S-Service`, `X-S2S-Timestamp`, `X-S2S-Signature`, `Authorization: Bearer <secret>`).
  - Inbound S2S calls verified timing-safely via `crypto.timingSafeEqual` with a 5-minute replay-prevention window. Outbound calls signed via `S2SService.call(...)`.

---

## 3. UI/UX Standard ("Precision Developer Dark")

- **Aesthetic**: Elevated layered Carbon-Slate surfaces (`#090B10` canvas -> `#11141C` cards -> `#161A24` elevated items -> `#0C0E14` recessed inputs/controls -> `#141821` floating overlays), clean hairline slate borders (`border-slate-800/90`), and a crisp monochromatic primary accent (`Sky-500` `#0EA5E9`). Static CSS dot-grid/radial canvas backdrop only — strictly forbid continuous `requestAnimationFrame` starfields, scanline overlays, spinning ambient logos, radar HUDs, border beams, or decorative `animate-ping`/`animate-pulse` dots.
- **Typography & Font Rules**:
  - Sans / Headings / Body: `Plus Jakarta Sans` & `Inter` (`subsets: ['latin', 'vietnamese']`)
  - Code / Git Identifiers / Counters: `JetBrains Mono` with `tabular-nums`
  - **Min Font Size ($\ge 12\text{px}$)**: Strictly forbid text below `12px` (`text-xs`). Never use `text-[10px]` or `text-[11px]`.
- **Zero Redundant Tags / Sci-Fi Jargon**:
  - Strictly forbid decorative status badges (`RADAR ONLINE`, `AI CORE READY`, `0 PULSES`), sci-fi terminology (_"quỹ đạo"_, _"chòm sao"_, _"radar"_, _"Warp-Drive"_, _"Sub-Light"_), or internal tech boasting (`HKDF`, `AES-256-GCM`, `Gateway SSO`, `PAT`, `v0.1`).
  - Animations are reserved strictly for functional progress states (`Loader2` / `RefreshCw` spinning only while an async task is actively running).
- **UI Primitives & Accessible Forms (`client/src/components/ui/`)**:
  - Standardize controls across the app via `Select` (WAI-ARIA combobox + top-layer listbox option rows), `Input` (recessed field, `<label htmlFor>`, hint/error linking, password visibility toggle), `SegmentedControl`, and native `<dialog>`-backed `ModalDialog` (`showModal()`, scroll containment, light-dismiss).
  - Strictly forbid native browser `window.alert()` / `window.confirm()`; render inline errors and inline 2-step destructive confirmations.
- **Full Internationalization (`client/src/i18n/`)**:
  - Complete Vietnamese (`vi`) and English (`en`) dictionary coverage with UI language switching (`VI | EN`) separated cleanly from AI standup report output language.
- **Auth Form Hierarchy**:
  - Replicate Wonderlab's clean form field hierarchy (Username/Email input, Password input + eye toggle + "Quên mật khẩu?" link, solid primary submit CTA, "Hoặc tiếp tục với" divider, Google Sign-In button, register/login switch link) styled with the Carbon-Slate overlay surface (`#141821`).
- **Workspace Modules**:
  - Git Activity Scanner (`ActivityScanner`): Timeframe switcher + Pull Request & Commit timeline cards.
  - Standup AI Console (`CockpitAiConsole`): Dual-engine switcher (GitHub Models & WebLLM WebGPU) with custom `Select` for model and report language.
  - Standup Output Dock (`StandupOutputDock`): 1-click formatted clipboard export (Bullet list, Parabol, Slack).

---

## 4. Coding & Verification Standards

- **Strict Zero-`any` Policy**: No `any`, `Record<string, any>`, or `@ts-ignore`.
- **Clean Architecture & Guard Clauses**: Early returns (maximum 2 levels of nesting), intent-revealing names, grouped imports.
- **Unified Verification**: Always verify changes via:
  ```bash
  pnpm check
  ```
- **Dev Server Standard (`pnpm dev` only)**:
  - STRICTLY run `pnpm dev` or `pnpm dev:client` (port 6100) and `pnpm dev:server` (port 6101).
  - NEVER execute `pnpm start` or `next start`. `next start` binds to an immutable `BUILD_ID`; any build causes mismatch resulting in broken asset errors.

---

## 5. Git Workflow, Versioning & Deployment

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`. Strict English for all commits and PRs.
- **Direct Push to `develop`**: Branch off `origin/develop`, verify with `pnpm check`, rebase, push `develop`.
- **Single Source of Truth for Versioning**:
  - Root `package.json` (`version`) is authoritative. Dynamically consumed by `client` (`next.config.ts`) and `server` (`version.ts`).
  - Only bump versions on official release events (`release: [published]` or tag `push: tags: ['v*']`). Never bump on draft releases or regular commits to `develop`.
- **Automated Production Releases**:
  - Release published or tag `v*.*.*` triggers `.github/workflows/deploy.yml`.
  - Auto-syncs `develop` into `main`, syncs version across `package.json` and lockfiles.
  - Deploys via Vercel Deploy Hooks.
  - Records real-time GitHub Deployment environments:
    - ⏳ / 🟢 `main - git-pulse-server`
    - ⏳ / 🟢 `main - git-pulse-client`
  - Runs fail-fast verification via `scripts/verify-deployment.sh` and sends real-time alerts to Slack `#deployments`.
