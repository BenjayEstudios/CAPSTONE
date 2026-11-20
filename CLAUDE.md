# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

`CAPSTONE/` is the Duoc UC capstone (APT) repo for **Cotizapp**, a multi-provider quotation/purchase ecommerce for food-industry SMEs. Only one folder holds code:

- `Proyecto/` — the pnpm + Turborepo monorepo (backend, Angular apps, Flutter app). **All commands, architecture and conventions are in [Proyecto/CLAUDE.md](Proyecto/CLAUDE.md)** (plus `Proyecto/README.md` and `Proyecto/docs/ARCHITECTURE.md`). Run every `pnpm`/`docker compose` command from `Proyecto/`, not from here.
- `Fase1/`, `Fase 2/` — course deliverables (docs, diagrams, minutes, rubrics, individual reflections). Not code; don't modify `Fase1/`.
- `ApuntesSeba/` — Sebastián's working notes in Spanish: `tareas-pendientes.md` (Jira KAN status), `estado-de-sesion.md` (where the last working session stopped), `plan-de-trabajo.md`, `modelo-de-negocio.md`. Read `estado-de-sesion.md` first when resuming; update `tareas-pendientes.md` after Jira status changes.
- `.claude/worktrees/` — untracked, local only.

## Working rules for this repo

- Docs, UI text, commit messages and notes are in Spanish; keep that.
- Work only on `dev-sebamax`. Never push to, or commit on, `main` or `dev`; changes reach them via PR (`dev-sebamax` → `main` → `dev`, where `dev` is the production branch).
- Sebastián makes the commits and pushes himself — do not commit unless asked, and do not add co-author lines.
- Sebastián's scope is the **admin-site** and its API (Jira project KAN). `apps/ecommerce`/`apps/mobile` belong to teammates; KAN-146 (offers) was dropped from the plan.
- On Docker for Windows the bind mount does not deliver file-change events to the watchers in the containers: if an edit seems to have no effect, restart the container before diagnosing.
