/**
 * Source-scanning helpers for the negative anchors.
 *
 * Several §L.6.A.4 anchors are "a source check" rather than a behavioural
 * case: a rule such as "the role decision is never written as `role !== 'user'`"
 * cannot be observed from the outside, because a wrong implementation and a
 * right one agree on every input a test can supply today and diverge only when
 * a new role value appears. Scanning the source is the only way to hold those
 * rules.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const SRC_ROOT = join(__dirname, '..', '..', 'src')

/** Every `.ts`/`.tsx` file under `src/`, recursively. */
export function sourceFiles(directory: string = SRC_ROOT): string[] {
  return readdirSync(directory).flatMap((entry: string) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

/** Source with comments stripped, so prose about a rule is not mistaken for code. */
export function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}
