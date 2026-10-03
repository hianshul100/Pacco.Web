/**
 * Static analysis over the checked-out sources.
 *
 * A dozen rows in the CSV are not browser tests at all: they ask what is
 * written in the repository. "Exactly one module declares a backend base
 * address." "No console call site can receive a token." "The gateway's routes
 * are byte-identical to the previous revision." Those are answered by reading
 * files, so they live here and run in the `static-analysis` project with no
 * browser at all.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'coverage',
  'reports',
  'test-results',
  'playwright-report',
  '.playwright',
])

export interface SourceFile {
  /** Absolute path on disk. */
  readonly path: string
  /** Path relative to the scan root, with forward slashes. */
  readonly relativePath: string
  readonly text: string
}

export interface ScanOptions {
  /** Extensions to include, with the dot. Defaults to the TypeScript sources. */
  readonly extensions?: readonly string[]
  /** Relative directories to skip, in addition to the defaults. */
  readonly skipDirectories?: readonly string[]
  /** Relative path fragments to skip, e.g. this suite's own directory. */
  readonly skipFragments?: readonly string[]
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const

function walk(root: string, current: string, options: ScanOptions, output: string[]): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }
      if ((options.skipDirectories ?? []).includes(entry.name)) {
        continue
      }
      walk(root, absolute, options, output)
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const extensions = options.extensions ?? DEFAULT_EXTENSIONS
    if (!extensions.includes(extname(entry.name))) {
      continue
    }
    const relativePath = relative(root, absolute).split(sep).join('/')
    if ((options.skipFragments ?? []).some((fragment) => relativePath.includes(fragment))) {
      continue
    }
    output.push(absolute)
  }
}

/** Reads every matching file under `root`, sorted for deterministic reporting. */
export function readSourceFiles(root: string, options: ScanOptions = {}): readonly SourceFile[] {
  if (!existsSync(root)) {
    return []
  }
  const paths: string[] = []
  walk(root, root, options, paths)
  return paths.sort().map((path) => ({
    path,
    relativePath: relative(root, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
  }))
}

export interface ScanHit {
  readonly relativePath: string
  readonly line: number
  readonly text: string
  readonly match: string
}

/** Every line in every file that matches `pattern`. */
export function findInSources(files: readonly SourceFile[], pattern: RegExp): readonly ScanHit[] {
  const hits: ScanHit[] = []
  for (const file of files) {
    const lines = file.text.split('\n')
    lines.forEach((text, index) => {
      // A fresh regex per line: a global pattern otherwise carries lastIndex.
      const matcher = new RegExp(pattern.source, pattern.flags.replace('g', ''))
      const found = matcher.exec(text)
      if (found !== null) {
        hits.push({
          relativePath: file.relativePath,
          line: index + 1,
          text: text.trim(),
          match: found[0],
        })
      }
    })
  }
  return hits
}

/** Formats hits so a failure names files and lines, not just a count. */
export function describeScanHits(hits: readonly ScanHit[]): string {
  return hits.map((hit) => `${hit.relativePath}:${hit.line}  ${hit.text}`).join('\n')
}

/** The client's hand-written sources, excluding tests and this suite. */
export function clientSourceFiles(clientRepoDir: string): readonly SourceFile[] {
  return readSourceFiles(join(clientRepoDir, 'src'))
}

/** The built bundle, when `npm run build` has been run. */
export function builtBundleFiles(clientRepoDir: string): readonly SourceFile[] {
  return readSourceFiles(join(clientRepoDir, 'dist'), {
    extensions: ['.js', '.mjs', '.cjs', '.html', '.css', '.map'],
  })
}

/** Everything in the client checkout a secret scanner should look at. */
export function clientScannableFiles(clientRepoDir: string): readonly SourceFile[] {
  return readSourceFiles(clientRepoDir, {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.env'],
    skipDirectories: ['dist'],
    skipFragments: ['tests/automation/', 'tests/cases/'],
  })
}

/** Reads one gateway configuration file, or `null` when the checkout is absent. */
export function readGatewayConfig(configDir: string | null, fileName: string): string | null {
  if (configDir === null) {
    return null
  }
  const path = join(configDir, fileName)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/**
 * Reads a file as it stood at `revision`, straight from git. Returns `null`
 * when the revision or the path is unknown, which is how the regression rows
 * skip cleanly in a shallow checkout.
 */
export function readAtRevision(
  repoDir: string,
  revision: string,
  relativePath: string,
): string | null {
  try {
    return execFileSync('git', ['-C', repoDir, 'show', `${revision}:${relativePath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

/** The repository root a path belongs to, or `null` when it is not in one. */
export function gitRootOf(path: string): string | null {
  try {
    return execFileSync('git', ['-C', path, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/** True when a directory exists and holds at least one entry. */
export function directoryHasContent(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0
}

// ---------------------------------------------------------------------------
// Shared patterns
// ---------------------------------------------------------------------------

/** Anything that looks like a committed secret. Used by TC-021 and TC-022. */
export const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  {
    name: 'assigned password',
    pattern: /\b(password|passwd|pwd|passphrase)\s*[:=]\s*['"][^'"]{4,}['"]/i,
  },
  {
    name: 'assigned api key',
    pattern: /\b(api[_-]?key|apikey|secret|client[_-]?secret)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
  { name: 'bearer literal', pattern: /['"]Bearer\s+[A-Za-z0-9._~+/-]{10,}=*['"]/ },
  { name: 'json web token literal', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./ },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'aws access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'connection string with credentials',
    pattern: /\b[a-z+]{3,}:\/\/[^\s'":/]+:[^\s'"@/]+@/i,
  },
]

/** Any absolute http(s) address literal. Used by TC-020 and TC-022. */
export const ABSOLUTE_ADDRESS_PATTERN = /https?:\/\/[A-Za-z0-9._-]+(?::\d+)?/g

/** Console and telemetry call sites, for TC-043. */
export const DIAGNOSTIC_CALL_PATTERN = /\b(?:console\.[a-z]+|emit|noteFailure|track|logEvent)\s*\(/
