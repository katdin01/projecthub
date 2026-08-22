import { spawn } from 'child_process'

// In the Electron build these were native OS dialogs (shell/dialog). In the web
// build the file PICKERS live in the browser (src/renderer/src/lib/browserApi.ts
// uploads the chosen file to the server), so the only thing left for the server
// to do is OPEN a path with the OS default handler when the user clicks a saved
// doc reference. openPath runs on the same machine as the browser, which is the
// whole point of the local-server design.
export async function openPath(path: string): Promise<void> {
  if (!path) return
  await new Promise<void>((resolve) => {
    let child
    if (process.platform === 'win32') {
      // `start` is a cmd builtin; the empty "" is the window title argument so a
      // quoted path isn't mistaken for it.
      child = spawn('cmd', ['/c', 'start', '', path], { windowsHide: true })
    } else if (process.platform === 'darwin') {
      child = spawn('open', [path])
    } else {
      child = spawn('xdg-open', [path])
    }
    child.on('error', () => resolve())
    child.on('close', () => resolve())
  })
}
