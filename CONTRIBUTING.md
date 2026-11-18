# Contributing to Git Pulse

Thank you for your interest in contributing to Git Pulse! Git Pulse provides **Developer Intelligence & Git Workspace with Dual-Core AI and Activity Radar**, part of the Prism Hub ecosystem.

Please adhere to the guidelines outlined below to maintain high engineering standards, cryptographic token security, and strict type safety across our developer workspace.

---

## 1. Commit Guidelines (Conventional Commits)

Git Pulse strictly enforces the **Conventional Commits v1.0.0** specification in English:

- `feat: <description>`: Introduces a new feature or public capability.
- `fix: <description>`: Fixes a defect or resolves an issue.
- `chore: <description>`: Maintenance tasks, dependencies, build configs.
- `docs: <description>`: Technical documentation and architecture updates.
- `test: <description>`: Unit, integration, or E2E tests.
- `refactor: <description>`: Code modifications without behavior changes.
- `ci: <description>`: CI/CD configuration files, workflows, and scripts.

_Example_: `feat(ai): integrate WebGPU local inference with Qwen2.5-Coder`

---

## 2. Development Workflow

Git Pulse uses a unified trunk-based workflow targeting `develop`:

1. **Branch Off `origin/develop`**:
   ```bash
   cd git-pulse
   git fetch origin
   git checkout -B <type>/<task-name> origin/develop
   ```
2. **Implement Changes**:
   - Strictly follow the core engineering guidelines in [AGENTS.md](AGENTS.md).
   - **Zero Secret Leaks & Token Security**: Never commit `.env*` or GitHub personal access tokens. All stored GitHub credentials must use AES-256-GCM encryption with per-user HKDF key derivation.
   - **Standard Ecosystem Ports (Prism Hub)**:
     - Git Pulse Client: `http://localhost:6100`
     - Git Pulse Server: `http://localhost:6101` (`/api/v1`)
     - Database: Local PostgreSQL 16 on `127.0.0.1:5432` (`git_pulse` DB)
   - **Cosmic Radar & Pulsar Aesthetic**: Glowing cyan/blue accents, cosmic radar HUDs, and tactile feedback.
3. **Mandatory Verification**:
   Before submitting changes, run the full verification pipeline:
   ```bash
   pnpm check
   ```
   All checks (`format:check`, `lint`, `typecheck`, `test`, `build`) must pass with exit code `0`.
4. **Merge Directly to `develop`**:
   ```bash
   git fetch origin && git rebase origin/develop && git push origin HEAD:develop
   git checkout develop && git pull origin develop && git branch -d <type>/<task-name>
   ```
   _Note_: The `main` branch is strictly reserved for production releases and automated CD synchronization.

---

## 3. Definition of Done (DoD)

A contribution is considered complete and ready for integration when:

- [ ] Linter reports zero errors and zero warnings (`pnpm lint`).
- [ ] TypeScript compiler passes in strict mode without `any` (`pnpm typecheck`).
- [ ] Unit and integration tests pass cleanly (`pnpm test`).
- [ ] Both Next.js web application and NestJS server compile successfully (`pnpm build`).
- [ ] Architectural docs in `docs/` updated if API endpoints, security, or AI modules changed.
