/**
 * The design reference is an ASSET of this repository, not a convenience copy.
 *
 * Review raised that the visual result was unverified because the only
 * references lived outside every repository. They are committed now — and this
 * suite is what stops that regressing: a deleted or replaced reference fails a
 * test instead of quietly turning `npm run verify:visual` into a NOT RUN that
 * nobody notices.
 *
 * ⚠️ These are pixels, not tokens. `LOW_LEVEL_SPEC-13652-wave-1.md` §L.12.1
 * records that no Figma file, URL or node id exists for capability `13652`, so
 * there is no live design source to re-query and nothing here can be re-derived
 * from one. `docs/design-reference/README.md` carries the provenance.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const REFERENCE_DIR = join(REPO_ROOT, 'docs', 'design-reference')

/** The size the visual check renders at; a changed size invalidates §4's figures. */
const EXPECTED = {
  '01_pacco-logo-1.png': { width: 1672, height: 941 },
  '02_login-page-ux.png': { width: 1448, height: 1086 },
  '03_welcome-page-ux.png': { width: 1448, height: 1086 },
} as const

/**
 * Reads a PNG's dimensions from its IHDR chunk. Eight bytes of header parsing
 * keeps this repository free of an image-decoding dependency for a guard.
 */
function pngSize(path: string): { width: number; height: number } {
  const header = readFileSync(path).subarray(0, 24)
  expect(header.readUInt32BE(0)).toBe(0x89504e47)
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

describe('committed design references', () => {
  it.each(Object.keys(EXPECTED))('%s is present', (name) => {
    expect(existsSync(join(REFERENCE_DIR, name))).toBe(true)
  })

  it.each(Object.entries(EXPECTED))('%s is a PNG at its supplied size', (name, size) => {
    expect(pngSize(join(REFERENCE_DIR, name))).toEqual(size)
  })

  it('records its own provenance', () => {
    const readme = readFileSync(join(REFERENCE_DIR, 'README.md'), 'utf8')
    // The no-Figma fact is load-bearing: without it a later reader treats the
    // comps as a stand-in for a design system that was never fetched.
    expect(readme).toContain('No Figma file, Figma URL or node id exists')
    for (const name of Object.keys(EXPECTED)) {
      expect(readme).toContain(name)
    }
  })

  it('is what the visual check measures against', () => {
    const script = readFileSync(join(REPO_ROOT, 'scripts', 'visual-fidelity-check.mjs'), 'utf8')
    expect(script).toContain("'docs', 'design-reference', '02_login-page-ux.png'")
  })

  it('has a runnable visual check per screen, each naming its own reference', () => {
    const scripts = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).scripts
    expect(scripts['verify:visual']).toContain('visual-fidelity-check.mjs')
    // 🚫 The landing screen's check is not the login check re-run: it names its
    // own route and its own reference, or it would measure nothing new.
    expect(scripts['verify:visual:welcome']).toContain('--route=/welcome')
    expect(scripts['verify:visual:welcome']).toContain('--reference=03_welcome-page-ux.png')
  })

  it('leaves the background image as the one shipped asset rather than a second copy', () => {
    // `04_backgroud-img.png` is byte-identical to the asset the client renders,
    // so it is committed once, as that asset. The reference directory says so;
    // this asserts the asset it points at is actually there.
    expect(existsSync(join(REPO_ROOT, 'src', 'assets', 'office-background.png'))).toBe(true)
  })

  it('carries the Welcome screen now that the wave which builds it has landed', () => {
    // LOW_LEVEL_SPEC-13652-wave-2.md §L.2.2 assigns `/welcome` and its
    // component tree to wave-2, which is why this comp arrives with it rather
    // than ahead of it.
    expect(existsSync(join(REFERENCE_DIR, '03_welcome-page-ux.png'))).toBe(true)
  })
})
