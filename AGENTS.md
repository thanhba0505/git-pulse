# AGENTS.md — Git-Pulse AI Coding Guidelines

Primary rules and engineering standards for AI coding assistants working in Git-Pulse.

---

## 1. Project Overview & Architecture

- **Mission**: Developer Intelligence & Git Workspace. Aggregates daily pull requests and commits, generates high-precision standup reports using Dual-Core AI (GitHub Models & WebLLM WebGPU), and provides developer activity radar.
- **Monorepo**: Unified `pnpm` monorepo (`client/`, `server/`, `docs/`).
- **Standard Ecosystem Ports (Prism Hub)**:
  - Git-Pulse Client: `http://localhost:6100`
  - Git-Pulse Server: `http://localhost:6101` (`/api/v1`)
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
- **SSO Authentication**: Central Gateway handles Google Authentication. Git-Pulse syncs shadow profiles and validates sessions via HttpOnly cookies (`git_pulse_session`).

---

## 3. UI/UX Standard ("Deep Space Pulsar & Celestial Constellation")

- **Aesthetic**: Deep void space (`#040714`), glowing nebula dust (`#081026` -> `#0d1b3e`), astral glass cards with hairline cyan borders (`border-cyan-500/25`), and animated celestial waveforms.
- **Color Palette**:
  - Cosmic Void: `#040714`
  - Astral Glass: `bg-[#0a1128]/70` with `backdrop-blur-xl`
  - Pulsar Cyan: `#06B6D4` / `#22D3EE` (PR signal & sync)
  - Supernova Emerald: `#10B981` / `#34D399` (commits & heartbeat)
  - Solar Flare Amber: `#F59E0B` / `#FBBF24` (pending & alerts)
  - Hyperdrive Violet: `#8B5CF6` / `#A78BFA` (AI computation)
- **Typography**:
  - Headings: `Plus Jakarta Sans`
  - Body: `Inter`
  - Telemetry & Git Hash: `JetBrains Mono` / `Geist Mono` with `tabular-nums`
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
