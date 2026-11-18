<div align="center">

# Git Pulse

**Developer Intelligence & Git Workspace with Dual-Core AI and Activity Radar — part of the Prism Hub ecosystem.**

[![CI Pipeline](https://github.com/thanhba0505/git-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/thanhba0505/git-pulse/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/thanhba0505/git-pulse?color=06b6d4&style=flat-square&label=Release)](https://github.com/thanhba0505/git-pulse/releases)
[![Version](https://img.shields.io/badge/version-v0.3.1-06b6d4?style=flat-square)](https://github.com/thanhba0505/git-pulse/releases)
[![Client Web App](https://img.shields.io/badge/Client-Live%20on%20Vercel-10b981?style=flat-square&logo=vercel)](https://git-pulse-app.vercel.app)
[![Server API](https://img.shields.io/badge/Server-API%20v1-0284c7?style=flat-square&logo=nestjs)](https://git-pulse-server.vercel.app/api/v1)
[![Swagger OpenAPI](https://img.shields.io/badge/Docs-Swagger%20OpenAPI-85ea2d?style=flat-square&logo=swagger)](https://git-pulse-server.vercel.app/api/docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[🌐 Web App](https://git-pulse-app.vercel.app) • [📖 Architecture](docs/architecture.md) • [🚀 Deployment](docs/deployment.md) • [📑 API Docs](docs/api-reference.md) • [🔒 Security Guide](docs/security.md)

</div>

---

## 📌 Project Overview

**Git Pulse** aggregates daily GitHub pull requests, commits, and issue activities to synthesize high-precision standup reports using an innovative **Dual-Core AI** engine. It visualizes developer momentum through cosmic radar HUDs and real-time pulsar waveforms, keeping engineering teams aligned with zero cognitive friction.

### Key Capabilities:

- **Dual-Core AI Synthesis (Zero Server Cost)**:
  - **Warp-Drive Core (Cloud AI)**: Dispatches inference calls to GitHub Models (Azure Inference) directly using the user's decrypted GitHub token (`gpt-4o-mini`, `meta-llama-3.3-70b-instruct`).
  - **Sub-Light Core (In-Browser WebGPU)**: Runs quantized models (`Llama-3.2-1B`, `Qwen2.5-Coder-1.5B`) directly inside the developer's browser via WebGPU using `@mlc-ai/web-llm` — 100% private, offline, and zero API quota consumed.
- **Developer Radar & Activity Scanner**: Live sonar radar mapping commit frequency, open PRs, and repository contributions across time windows.
- **Live Pulsar Waveform**: Oscillating visualizer reflecting coding rhythm and velocity.
- **Multi-Format Export Dock**: 1-click clipboard formatting for Parabol standups, Slack bullet lists, Markdown tables, and Jira tickets.
- **Central Gateway SSO & S2S**: Seamless single sign-on powered by Central Gateway with cryptographic HMAC-SHA256 signature verification.
- **Enterprise-Grade Token Security**: GitHub credentials encrypted at rest with **AES-256-GCM** using **Per-User HKDF Key Derivation**, backed by automated regex log sanitization.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Developer["Developer Browser"] -->|HTTPS| VercelEdge["Vercel Edge Network"]
    VercelEdge --> ClientApp["git-pulse-client (Next.js 15 App Router)"]
    VercelEdge --> ServerAPI["git-pulse-server (NestJS 10 Serverless)"]
    ServerAPI -->|DATABASE_URL (Pooler)| NeonDB[("Neon Lakebase PostgreSQL 16 (AWS Oregon)")]
    ServerAPI -->|HMAC-SHA256 S2S| Gateway["Central Gateway (IAM Master)"]
    ClientApp -->|WebGPU In-Browser| WebLLM["WebLLM Core (Llama-3.2-1B)"]
    ServerAPI -->|Decrypted PAT| GitHubAPI["GitHub REST & Models API"]
```

---

## 🧭 Monorepo Structure & Ecosystem Ports

Git Pulse is part of the **Prism Hub** ecosystem and strictly adheres to standard workspace port assignments:

| Project                    | Role                  |    Standard Port     | Production Endpoint                                                                                  |
| :------------------------- | :-------------------- | :------------------: | :--------------------------------------------------------------------------------------------------- |
| **Git Pulse Client**       | Frontend Workspace    |        `6100`        | [https://git-pulse-app.vercel.app](https://git-pulse-app.vercel.app)                                 |
| **Git Pulse Server**       | REST API & AI Engine  |  `6101` (`/api/v1`)  | [https://git-pulse-server.vercel.app/api/v1](https://git-pulse-server.vercel.app/api/v1)             |
| **Central Gateway Client** | Ecosystem IAM & Admin |        `5100`        | [https://central-gateway-client.vercel.app](https://central-gateway-client.vercel.app)               |
| **Central Gateway Server** | SSO & Notifications   |  `5101` (`/api/v1`)  | [https://central-gateway-server.vercel.app/api/v1](https://central-gateway-server.vercel.app/api/v1) |
| **Wonderlab Client**       | Science Simulations   |        `4100`        | [https://wonderlab.io.vn](https://wonderlab.io.vn)                                                   |
| **Wonderlab Server**       | Simulation API        |  `4101` (`/api/v1`)  | [https://wonderlab-server.vercel.app/api/v1](https://wonderlab-server.vercel.app/api/v1)             |
| **Local Database**         | PostgreSQL 16 Docker  | `5432` (`git_pulse`) | `127.0.0.1:5432`                                                                                     |

```
git-pulse/
├── client/          # Next.js 15 App Router, React 19, Tailwind CSS v4, WebLLM
├── server/          # NestJS 10 REST API, Prisma ORM, AES-256-GCM Token Vault
├── docs/            # Technical specifications (architecture, deployment, api-reference, security)
└── scripts/         # Production release sync and deployment verification utilities
```

---

## 🔒 Security & Token Cryptography

- **AES-256-GCM + Per-User HKDF Key Derivation**:
  $$\text{DEK}_{\text{user}} = \text{HKDF-SHA256}(\text{MasterKey}, \text{Salt}=\text{userId}, \text{Info}=\text{"git-pulse-token-v1"}, 32)$$
- **Zero-Leak Logger**: Automatic redaction of GitHub PATs (`ghp_*`, `github_pat_*`, `gho_*`) across all server logs.
- **S2S Vault**: Central Gateway pre-shared keys are encrypted at rest with envelope prefix `enc:v1:`.
- **Production Database Safety**: Manual migrations against remote Neon databases from local terminal are strictly forbidden. All schema updates run automatically through the official release CI/CD pipeline.

---

## 🚀 Quickstart & Local Development

### 1. Prerequisites

- **Node.js**: `v24.x` (see `.nvmrc`)
- **Package Manager**: `pnpm@12.11.2`
- **Docker**: For local PostgreSQL 16 container

### 2. Setup Environment

```bash
# Clone the repository
git clone git@github.com:thanhba0505/git-pulse.git
cd git-pulse

# Copy root environment template
cp .env.example .env

# Install dependencies across all monorepo workspaces
pnpm install

# Start local PostgreSQL container
docker compose up -d

# Generate Prisma Client and push local database schema
pnpm --filter git-pulse-server prisma:generate
pnpm --filter git-pulse-server db:push
```

### 3. Launch Development Servers

```bash
# Start both Client (port 6100) and Server (port 6101) concurrently
pnpm dev

# Or run individual workspaces:
pnpm dev:client  # Next.js on http://localhost:6100
pnpm dev:server  # NestJS on http://localhost:6101/api/v1
```

### 4. Code Quality & Unified Verification

Before pushing to `origin/develop`, run the complete verification suite:

```bash
pnpm check
# Executes: format:check + lint + typecheck + unit tests + Next.js build + NestJS build
```

---

## 🚢 Automated Production Deployment

Deployments to **Vercel** and **Neon PostgreSQL** are 100% automated via GitHub Actions:

1. Merge approved features into `develop`.
2. Draft release notes are automatically compiled by `.github/workflows/release-drafter.yml`.
3. Publishing an official release (`v*.*.*`) triggers `.github/workflows/deploy.yml`:
   - Fast-forwards `develop` into `main`.
   - Synchronizes version numbers across `package.json` and `README.md`.
   - Triggers Vercel Deploy Hooks for server and client.
   - Automatically executes `prisma migrate deploy` on Neon PostgreSQL.
   - Polls `/health` endpoints with fail-fast health assertion.
   - Updates GitHub Deployments (`main - git-pulse-server` & `main - git-pulse-client`) to `success` 🟢.
   - Sends real-time notifications to Slack `#deployments`.

---

## 📄 License

This project is licensed under the terms of the [MIT License](LICENSE). Copyright © 2026 Bá Lê Thanh.
