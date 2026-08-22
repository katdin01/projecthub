# ProjectHub (local web edition)

This is ProjectHub converted from an Electron desktop app to a **local web app**
that runs on a small Node server and opens in your browser — for machines where
Electron is blocked.

**To run it: double-click `start.bat`.** See **[HOW-TO-RUN.md](HOW-TO-RUN.md)**
for full instructions, including how to bring your existing `data.db` over.

Quick commands:

```bash
npm install     # once (start.bat does this for you)
npm run build   # build the UI into ./dist
npm run serve   # start the server at http://localhost:4317
```
