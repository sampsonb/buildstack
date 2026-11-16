import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// SEO item 3 part 2 (2026-11-16): every tool page carries one "Why Nth in Category" line built only
// from tools.json (the tool's strength line and its real neighbours in the category). No scores.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const LABEL = { coding: 'Coding', writing: 'Writing', images: 'Images', video: 'Video', agents: 'Agents', research: 'Research', voice: 'Voice' }
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

test('each tool page has exactly one rank reason that matches its category place and neighbours', async () => {
  for (const t of tools) {
    const { status, html } = await get(`/tool/${t.slug}`)
    assert.equal(status, 200, t.slug)
    const m = [...html.matchAll(/<p class="why">([\s\S]*?)<\/p>/g)]
    assert.equal(m.length, 1, t.slug)
    const line = m[0][1]
    const list = byRank.filter((x) => x.category === t.category)
    const i = list.findIndex((x) => x.slug === t.slug)
    assert.ok(line.startsWith(`<strong>Why ${ord(i + 1)} in ${LABEL[t.category]}:</strong> `), t.slug)
    assert.ok(line.includes(esc(t.strength.replace(/[.!?]$/, ''))), `${t.slug}: strength text`)
    const up = list[i - 1], down = list[i + 1]
    if (up) assert.ok(line.includes(`below <a href="/tool/${up.slug}">${esc(up.name)}</a>`), `${t.slug}: above neighbour`)
    if (down) assert.ok(line.includes(`above <a href="/tool/${down.slug}">${esc(down.name)}</a>`), `${t.slug}: below neighbour`)
    assert.ok(!/score|tested|benchmark/i.test(line.replace(esc(t.strength), '')), `${t.slug}: no invented basis`)
    assert.ok(!/[\u2013\u2014]/.test(line), `${t.slug}: no dashes`)
    // sits inside the header, after the rank row
    assert.ok(html.indexOf('<p class="why">') > html.indexOf('class="rankrow"'), t.slug)
  }
})

test('rank reason stays off other pages and out of JSON-LD', async () => {
  for (const p of ['/', '/categories', '/category/coding', '/best/ai-coding-assistant', '/methodology', '/about', '/?q=write+blog+posts']) {
    const { html } = await get(p)
    assert.ok(!html.includes('<p class="why">'), p)
  }
  const { html } = await get('/tool/cursor')
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  assert.ok(!ld.includes('Why 1st'), 'json-ld untouched')
})
