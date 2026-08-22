# ProjectHub — Claude Code project guide

A local web app for tracking client conversion projects (schedules, tasks,
notes, and Jira ticket tracking). Originally an Electron desktop app; converted
to run as a small local Node server + browser UI because Electron is blocked on
the target (managed Windows) machine.

## ⚠️ Important guardrails (read first)

- **NEVER commit the `data/` folder.** It holds the real client database
  (`data.db`), backups, logs, and Jira credentials. It is gitignored — keep it
  that way. Do not add real client data, tokens, or `.env` files to the repo.
- **This runs on a managed corporate laptop.** Do **not** add auto-start,
  background services, scheduled tasks, hidden processes, or VBScript launchers.
  An earlier "make it real" attempt with those mechanisms tripped endpoint
  security. Keep it **dev/refine mode only**: a plain server the user starts in a
  terminal. A properly hosted version (HTTPS + SSO, off the managed device) is
  the sanctioned path for "real" — not local persistence.
- Any GitHub repo for this must be **private**.

## What it is / architecture

- **`src/renderer/`** — the React + TypeScript UI (unchanged from the Electron
  app). It talks to the backend only through `window.api.*`, which is installed
  by `src/renderer/src/lib/browserApi.ts` as a thin `fetch` wrapper over the
  server's HTTP API. This is why no UI component needed to change in the port.
- **`server/`** — the local Node/Express server.
  - `server/index.ts` boots the DB, optional Jira sync, backups, then serves the
    built UI from `dist/` and exposes `POST /api/invoke {channel, args}` and
    `POST /api/upload`.
  - `server/handlers.ts` maps every old Electron IPC channel (`ns:method`) to a
    function — it's the request router.
- **`src/main/`** — the backend logic reused from the Electron app: SQLite
  repositories (`db/repositories`), migrations (`db/migrations`, plain `.sql`
  files loaded in order), Excel/PDF import, and the Jira client/sync/write code.
- **`src/shared/types.ts`** — types shared by UI and server.
- Data lives in a SQLite file. In dev it's `./data/data.db` (set via
  `PH_DATA_DIR`); by default the server would use `%LOCALAPPDATA%\ProjectHub`.

## Run it (dev / refine mode)

From the project root in PowerShell:

```powershell
$env:PH_DATA_DIR="$PWD\data"; $env:PH_BACKUP_DIR="$PWD\data\backups"; $env:PH_DISABLE_SYNC="1"; npm run serve
```

Then open http://localhost:4317 in a browser. Close the terminal to stop.

- `npm run build` — rebuild the UI into `dist/` (needed after renderer changes;
  the server serves the built files).
- `npm run serve` — run the server (tsx runs the TS directly; no build step for
  the server itself).

### Env vars
- `PH_DATA_DIR` — where `data.db` lives (default: `%LOCALAPPDATA%\ProjectHub\data`).
- `PH_BACKUP_DIR` — where automatic backups are written (default: OneDrive/Documents).
  Point it at a local folder in dev.
- `PH_DISABLE_SYNC=1` — skip the automatic background Jira sync (manual "Sync now"
  in the UI still works). Use this in dev to avoid unattended external calls.
- `PH_PORT` — server port (default 4317).

## Conventions

- After editing anything under `src/renderer/`, run `npm run build` and refresh
  the browser (hard refresh) to see changes.
- Migrations are append-only: add a new numbered `.sql` in
  `src/main/db/migrations/`; never edit a shipped one. The filename is the
  migration's identity in the `_migrations` table.
- The Jira token is encrypted at rest with Windows DPAPI (`src/main/jira/dpapi.ts`).
- Keep changes dev-only and reversible; no OS-level persistence.
