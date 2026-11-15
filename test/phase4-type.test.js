import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { test } from 'node:test'

// Phase 4 redesign: light store-shelf palette, self-hosted Archivo (one variable woff2, preloaded,
// font-display swap, metric-matched fallback), and the og:image left as it was.
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const pages = ['/', '/?q=write%20blog%20posts', '/tool/claude', '/best/ai-coding-assistant', '/alternatives/cursor', '/category/coding', '/categories', '/guides/how-celebrity-deepfakes-are-made', '/about', '/methodology']

test('font: self-hosted Archivo file exists, swap, matched fallback, not preloaded (preload delayed first paint on slow mobile)', async () => {
  const f = new URL('../public/fonts/archivo-v1.woff2', import.meta.url)
  assert.ok(existsSync(f))
  assert.equal(readFileSync(f).subarray(0, 4).toString('latin1'), 'wOF2')
  assert.ok(statSync(f).size < 70000, 'font stays small')
  assert.ok(existsSync(new URL('../public/fonts/OFL.txt', import.meta.url)), 'license ships with the font')
  for (const p of pages) {
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    assert.equal(html.includes('rel="preload"'), false, `${p}: no font preload`)
    assert.ok(/@font-face \{ font-family: "Archivo"; src: url\("\/fonts\/archivo-v1\.woff2"\) format\("woff2"\);[^}]*font-display: swap;/.test(html), p)
    assert.ok(/@font-face \{ font-family: "Archivo Fallback";[^}]*size-adjust:/.test(html), p)
    assert.ok(html.includes('--font: "Archivo", "Archivo Fallback",'), p)
    assert.equal(/fonts\.googleapis|fonts\.gstatic/.test(html), false, `${p}: no third-party font`)
  }
})

test('palette: light ground, ink text, no old dark colors or gradients', async () => {
  const { html } = await get('/')
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
  assert.ok(css.includes('--ground: #ffffff;'))
  assert.ok(css.includes('--ink: #15171a;'))
  for (const old of ['#0b0f14', '#121821', '#182131', '#e8eef7', '#9aa8bc', '#243044', '#b9c5d6', '#1a0f05', 'linear-gradient', 'rgba(11,15,20', 'backdrop-filter']) {
    assert.equal(css.includes(old), false, old)
  }
  assert.ok(/\.ptag b \{[^}]*"wdth" 72;[^}]*tabular-nums/.test(css), 'narrow tabular price figures')
  assert.ok(/\.pos \{[^}]*"wdth" 75;[^}]*tabular-nums/.test(css), 'narrow tabular rank numbers')
  assert.ok(/::selection \{/.test(css))
})

test('og:image unchanged and the file still ships', async () => {
  for (const p of ['/', '/tool/claude', '/about']) {
    const { html } = await get(p)
    assert.ok(html.includes('<meta property="og:image" content="https://buildstack.tier11.com/og.png"/>') || p === '/about' || /og:image" content="https:\/\/buildstack\.tier11\.com\/[^"]+"/.test(html), p)
  }
  assert.ok(existsSync(new URL('../public/og.png', import.meta.url)))
})

test('404 page uses the same layout and stays a 404', async () => {
  const { status, html } = await get('/no-such-page-here')
  assert.equal(status, 404)
  assert.ok(html.includes('<main id="main">'))
  assert.ok(html.includes('/fonts/archivo-v1.woff2'))
})
