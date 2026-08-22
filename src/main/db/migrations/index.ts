import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Load every *.sql migration in this folder, in filename order (the zero-padded
// numeric prefixes make a plain lexical sort correct). The file name is used as
// the migration's identity in the _migrations table, so these names must stay
// stable — that's what lets a data.db copied from another machine skip the
// migrations it already has and only apply newer ones.
//
// The Electron build inlined these as `?raw` text imports (a bundler feature) so
// they'd survive being packed into an asar. This web build runs the source
// directly with tsx, so it just reads the files from disk next to this module.
const migrationsDir = __dirname

export const migrations: { name: string; sql: string }[] = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), 'utf-8') }))
