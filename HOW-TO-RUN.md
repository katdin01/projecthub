# ProjectHub — real, everyday setup

ProjectHub runs as a small local web app (no Electron): a background server on
your machine that you open in its own window. It only listens on `127.0.0.1`
(your machine only) — nothing is exposed to the network.

## One-time setup

Double-click **`Setup-ProjectHub.cmd`**. It will (no admin needed):

- install dependencies and build the app if needed,
- set it to **start automatically and hidden every time you log in** (and
  restart itself if it ever crashes),
- create a **"ProjectHub" icon** on your Desktop and Start Menu that opens it in
  its own app window (via Edge),
- move your data to a stable location and retire the old folder.

You only do this once (safe to re-run any time, e.g. after an update).

## Daily use

Click the **ProjectHub** icon (Start Menu or Desktop). That's it — the server is
already running in the background, so it opens instantly in its own window.

- Nothing to keep open, no terminal window.
- If you ever open it right after logging in and see "can't reach this page,"
  wait a few seconds (the server is still starting) and refresh.

## Where your data lives

- **Live database:** `%LOCALAPPDATA%\ProjectHub\data\data.db`
  (i.e. `C:\Users\<you>\AppData\Local\ProjectHub\data`).
- **Automatic backups:** a rotating copy is written to
  `…\OneDrive\ProjectHub Backups` on startup and once a day (keeps the last 14),
  so a copy always exists off this machine.
- **Manual backup / JSON export:** still available in the app under
  **Settings → Backup**.

To move everything to another machine later, copy `data.db` (or a file from the
backups folder) into that machine's `%LOCALAPPDATA%\ProjectHub\data`.

## Security

- The app is **localhost-only** — not reachable from the network. Your Windows
  account is the boundary.
- Your **Jira API token is encrypted at rest with Windows DPAPI** — it can only
  be decrypted by your Windows login on this machine. A copied credentials file
  is useless on any other account/machine.
- The database itself is not separately encrypted; it relies on your Windows
  account and your organization's disk encryption (BitLocker). If you ever need
  the database encrypted with a passphrase too, that can be added.

## Managing it

- **Stop it / turn off auto-start:** double-click **`Uninstall-ProjectHub.cmd`**
  (removes the icons and auto-start and stops the server; your data and backups
  are kept). Re-run `Setup-ProjectHub.cmd` to turn it back on.
- **Restart it now:** run `Uninstall-ProjectHub.cmd` then `Setup-ProjectHub.cmd`,
  or just log out and back in.
- **After changing the code:** run `npm run build`, then restart (log out/in, or
  uninstall+setup) so the server reloads.

## Troubleshooting

- **Log file:** `%LOCALAPPDATA%\ProjectHub\data\logs\server.log` records startup,
  backups, Jira sync, and any errors — check here first if something misbehaves.
- **Port in use:** the app uses port 4317. If another app takes it, set a
  different one before launch: `set PH_PORT=4400` and open `http://localhost:4400`
  (and update the icon's `--app=` URL to match).
- **Change data/backup locations:** set `PH_DATA_DIR` and/or `PH_BACKUP_DIR`
  environment variables.

## Under the hood (reference)

- `projecthub-supervisor.vbs` — hidden watcher that keeps the server running.
- `Setup-ProjectHub.cmd` / `Uninstall-ProjectHub.cmd` — install / remove.
- `server/` — the local Node server (HTTP API + serves the built UI in `dist/`).
- `src/` — the React UI (`src/renderer`) and backend logic (`src/main`).
- `npm run build` rebuilds the UI; `npm run serve` runs the server in a visible
  terminal (handy for debugging).
