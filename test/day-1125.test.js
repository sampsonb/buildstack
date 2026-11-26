import assert from 'node:assert/strict'
import { test } from 'node:test'
import tools from '../src/tools.json' with { type: 'json' }

const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('Nov 25 adds: agents coverage and MAGI-2 are placed honestly and never read affiliate', () => {
  assert.equal(by.openclaw.rank, by['hermes-agent'].rank - 1)
  assert.equal(by.dify.rank, by.n8n.rank + 1)
  assert.equal(by.crewai.rank, by.dify.rank + 1)
  assert.equal(by['magi-2'].rank, by['seedance-2-5'].rank + 1)
  for (const s of ['openclaw', 'dify', 'crewai']) {
    assert.equal(by[s].category, 'agents', s)
    assert.equal(by[s].priceChecked, '2026-11-25', s)
    assert.ok(by[s].pricingUrl, s)
    assert.equal(by[s].affiliate, false, s)
    assert.equal(by[s].featured, false, s)
  }
  assert.equal(by['magi-2'].category, 'video')
  assert.equal(by['magi-2'].priceChecked, undefined)
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(tools)))
})

test('rank changelog generates catalog adds from tools.json so it matches the tool count', async () => {
  const { status, html } = await get('/rank-changelog')
  assert.equal(status, 200)
  const t = text(html)
  const n = tools.length
  const added = (d) => tools.filter((x) => x.added === d).length
  const upTo = (d) => tools.filter((x) => x.added && x.added <= d).length
  assert.ok(t.includes(`Catalog add: ${added('2026-11-25')} tools`), 'today entry')
  assert.ok(t.includes(`to ${upTo('2026-11-25')} tools`), 'today count')
  assert.ok(upTo('2026-11-25') <= n)
  assert.ok(t.includes(`from ${upTo('2026-11-22')} to ${upTo('2026-11-23')} tools`), 'Nov 23 entry')
  assert.ok(t.includes(`from ${upTo('2026-11-23')} to ${upTo('2026-11-24')} tools`), 'Nov 24 entry')
  assert.ok(/Last updated: Nov 2[5-9], 2026/.test(t), 'page date follows newest add')
  assert.ok(t.indexOf('Nov 25, 2026: Catalog add') < t.indexOf('Nov 24, 2026: Catalog add'), 'newest first')
  assert.ok(t.indexOf('Nov 23, 2026: Grok moved') < t.indexOf('Nov 22, 2026: Catalog add: 23 tools'))
  for (const s of ['openclaw', 'dify', 'crewai', 'magi-2', 'claude-ship', 'netlify']) assert.ok(html.includes(`href="/tool/${s}"`), s)
  assert.ok(!/[\u2013\u2014]/.test(t))
  assert.ok(!/Featured/.test(t))
})

test('price re-check date and new tool pages render', async () => {
  const pc = text((await get('/price-changes')).html)
  assert.ok(/Nov 2[5-9], 2026/.test(pc), 'recheck date')
  for (const s of ['openclaw', 'dify', 'crewai', 'magi-2']) {
    const { status, html } = await get(`/tool/${s}`)
    assert.equal(status, 200, s)
    assert.ok(!/\u2014/.test(text(html)), s)
  }
})
