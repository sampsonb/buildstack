import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

test('src and data tools.json stay identical after the methodology review', () => {
  assert.equal(
    readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'),
    readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8'),
  )
  assert.equal(tools.length, 174)
})

test('Wix Studio Two, Qwen Code, and Junie sit below generally available coding tools and left the top 30', () => {
  const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
  const expo = by['expo-simulators']
  assert.equal(expo.rank, 30)
  assert.equal(by['wix-studio-two'].rank, 31)
  assert.equal(by['qwen-code'].rank, 32)
  assert.equal(by['junie'].rank, 33)
  assert.equal(by['wix-studio-two'].rankReason, undefined)
  assert.equal(by['qwen-code'].rankReason, undefined)
  assert.equal(by['junie'].rankReason, undefined)
  assert.ok(expo.rankReason)
  assert.ok(by['chatgpt-work'].rankReason)
  assert.ok(by['replit-agent'].rankReason)
  const withReason = tools.filter((t) => t.rankReason)
  assert.equal(withReason.length, 30)
  assert.ok(withReason.every((t) => t.rank <= 30))
})

test('Junie is marked retiring, Codex has a free tier, and Perplexity has an official pricing link', () => {
  const by = Object.fromEntries(tools.map((t) => [t.slug, t]))
  assert.equal(by.junie.status, 'retiring')
  assert.match(by.junie.watchOut, /Dec 3, 2026/)
  assert.equal(by['openai-codex'].freeTier, true)
  assert.equal(by.perplexity.pricingUrl, 'https://www.perplexity.ai/pro')
  assert.equal(by.perplexity.priceChecked, '2026-11-21')
  assert.equal(by.opencode.pricingUrl, 'https://opencode.ai/console/go')
})

test('methodology uses the tightened criteria, a tie-break order, and an honest AI-help line', async () => {
  const text = visible((await get('/methodology')).html)
  assert.ok(text.includes("How well it does its main job for a typical person. We go by the maker's docs and plans, public reviews, and hands-on use where we have it."))
  assert.ok(text.includes('Tools anyone can sign up for and use now rank above waitlists, invite-only rollouts, previews, and APIs that are not live.'))
  assert.ok(text.includes('Tools that serve many people and jobs rank above single-purpose ones, unless the narrow tool is clearly better at its one job.'))
  assert.ok(text.includes('A usable free plan, prices published on the maker\'s site, and stated usage limits all help. The main cost or limit goes in the watch-out.'))
  assert.ok(text.includes('Tools with regular updates and current docs and prices rank higher. Discontinued or retiring tools are marked, and discontinued ones are left out of search.'))
  assert.ok(text.includes('When criteria pull in different directions, The job wins, then Available today, then Access and price, then Range, then Upkeep.'))
  assert.ok(text.includes("Write-ups and price checks are drafted with AI help and checked against the maker's pages"))
})

test('rank changelog logs each available-today move', async () => {
  const text = visible((await get('/rank-changelog')).html)
  assert.ok(text.includes('Three tools left the top 30 under the Available today rule'))
  assert.ok(text.includes('Wix Studio Two: parts of it are still in beta or coming soon.'))
  assert.ok(text.includes('Qwen Code: it is a 1.0 preview.'))
  assert.ok(text.includes('Junie: JetBrains is retiring the standalone plugin, which stops working Dec 3, 2026.'))
  assert.ok(text.includes('now #31'))
  assert.ok(text.includes('now #32'))
  assert.ok(text.includes('now #33'))
})

test('top 30 rank reasons are modest sentences with no dashes', () => {
  const top = tools.filter((t) => t.rank <= 30).sort((a, b) => a.rank - b.rank)
  assert.equal(top.length, 30)
  for (const t of top) {
    const r = t.rankReason
    assert.ok(r, t.slug)
    assert.ok(r.length >= 21 && r.length <= 170, `${t.slug} length ${r.length}`)
    assert.match(r, /^[A-Z]/)
    assert.ok(r.endsWith('.'))
    assert.equal(/[\u2013\u2014]/.test(r), false, t.slug)
  }
})

test('index.js and tools.json have no em or en dashes', () => {
  const index = readFileSync(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8')
  const json = readFileSync(fileURLToPath(new URL('../src/tools.json', import.meta.url)), 'utf8')
  assert.equal(/[\u2013\u2014]/.test(index), false)
  assert.equal(/[\u2013\u2014]/.test(json), false)
})
