import { execFileSync } from 'child_process'

// Windows DPAPI (CurrentUser scope) via PowerShell — no native module required.
// Protection is bound to the logged-in Windows account: only the same user on
// the same machine can decrypt, so a stolen credentials file is useless
// elsewhere. Non-Windows platforms have no DPAPI, so callers fall back to base64.
export function dpapiAvailable(): boolean {
  return process.platform === 'win32'
}

function runPowerShell(script: string): string {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf-8', windowsHide: true }
  ).trim()
}

// plaintext (utf-8) -> base64 of DPAPI-protected bytes. The input is passed as
// base64 (only [A-Za-z0-9+/=]) so it's safe to embed in the single-quoted
// PowerShell string with no escaping concerns.
export function dpapiProtect(plaintext: string): string {
  const inB64 = Buffer.from(plaintext, 'utf-8').toString('base64')
  const script =
    `Add-Type -AssemblyName System.Security; ` +
    `$b=[Convert]::FromBase64String('${inB64}'); ` +
    `$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'); ` +
    `[Convert]::ToBase64String($p)`
  return runPowerShell(script)
}

// base64 of DPAPI-protected bytes -> plaintext (utf-8)
export function dpapiUnprotect(protectedB64: string): string {
  const script =
    `Add-Type -AssemblyName System.Security; ` +
    `$b=[Convert]::FromBase64String('${protectedB64}'); ` +
    `$u=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'); ` +
    `[Convert]::ToBase64String($u)`
  return Buffer.from(runPowerShell(script), 'base64').toString('utf-8')
}
