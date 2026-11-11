# AGENTS.md — Git Pulse AI Coding Guidelines

Primary rules and engineering standards for AI coding assistants working in Git Pulse.

---

## 1. Project Overview & Architecture

- **Mission**: Developer Intelligence & Git Workspace. Aggregates daily pull requests and commits, generates high-precision standup reports using Dual-Core AI (GitHub Models & WebLLM WebGPU), and provides developer activity radar.
- **Brand Naming**: The platform is strictly named **`Git Pulse`** (spaced, never hyphenated as `Git-Pulse`).
- **Monorepo**: Unified `pnpm` monorepo (`client/`, `server/`, `docs/`).
- **Standard Ecosystem Ports (Prism Hub)**:
  - Git Pulse Client: `http://localhost:6100`
  - Git Pulse Server: `http://localhost:6101` (`/api/v1`)
  - Central Gateway Client: `http://localhost:5100`
  - Central Gateway Server: `http://localhost:5101` (`/api/v1`)
  - Wonderlab Client: `http://localhost:4100`
  - Wonderlab Server: `http://localhost:4101`
  - Database: Local PostgreSQL 16 on `127.0.0.1:5432` (`git_pulse`)
- **Runtime & Tools**: Node `v24.x` (`.nvmrc`), `pnpm@12.11.2`. Never use `npm` or `yarn`.

---

## 2. Security & Environment Standards

- **Zero Secret Leaks**: Never commit `.env*` or tokens.
- **Client Boundaries**: Only `NEXT_PUBLIC_*` variables allowed in client code.
- **Token Security**: GitHub access tokens and PATs stored in the database must be encrypted at rest using AES-256-GCM.
- **SSO Authentication**: Central Gateway handles Google Authentication. Git Pulse syncs shadow profiles and validates sessions via HttpOnly cookies (`git_pulse_session`).
- **Service-to-Service (S2S) Architecture**:
  - Connections managed dynamically via `service_connections` database table (`slug`, `domain`, `apiPrefix`, `apiKey`, `incomingSecret`, `isActive`).
  - Strict HMAC-SHA256 signature verification (`X-S2S-Service`, `X-S2S-Timestamp`, `X-S2S-Signature`, `Authorization: Bearer <secret>`).
  - Inbound S2S calls verified timing-safely via `crypto.timingSafeEqual` with a 5-minute replay-prevention window. Outbound calls signed via `S2SService.call(...)`.

---

## 3. UI/UX Standard ("Cosmic Void Glass & Kinetic Pulse")

- **Aesthetic**: Deep void space (`#040714`), glowing nebula dust (`#081026` -> `#0d1b3e`), astral glass cards with hairline cyan borders (`border-cyan-500/25`), and animated celestial waveforms.
- **Typography & Font Rules**:
  - Headings: `Plus Jakarta Sans`
  - Body: `Inter`
  - Telemetry & Git Hash: `JetBrains Mono` / `Geist Mono` with `tabular-nums`
  - **Min Font Size ($\ge 12\text{px}$)**: Strictly forbid text below `12px` (`text-xs`). Never use `text-[10px]` or `text-[11px]`.
- **Zero Redundant Tags / Badge Clutter**:
  - Forbid vanity decorative tags (e.g. `v0.1`, `Dual-Core`, `Cloud AI`, `In-Browser`, `PAT`, `Gateway SSO`).
  - Maintain spacious, clean, and breathable layouts (`p-6` to `p-8` on cards and modals).
- **Auth Modal Specification**:
  - Modal must strictly replicate Wonderlab's exact component hierarchy (User/Email input with user icon, Password input with lock icon + eye toggle + "Quên mật khẩu?", submit button `→ Đăng nhập`, divider `HOẶC TIẾP TỤC VỚI`, Google button with 4-color SVG, footer `Chưa có tài khoản Git Pulse? Đăng ký ngay`).
  - Styled with Cosmic Void Glass (`bg-[#070b1a]/95 backdrop-blur-2xl border-cyan-500/25`).
- **Signature Elements**:
  - Live Pulsar Waveform (Audio/Gamma wave oscillating by commit frequency)
  - Git Orbit Constellation (Nodes connected by energy rays)
  - Cockpit Dual-Engine AI Console (Switch between WebGPU and GitHub Models)
  - Multi-Format Export Dock (1-click copy for Parabol, Slack, Markdown, Jira)

---

## 4. Coding & Verification Standards

- **Strict Zero-`any` Policy**: No `any`, `Record<string, any>`, or `@ts-ignore`.
- **Unified Verification**: Always verify changes via:
  ```bash
  pnpm check
  ```
