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
const by = Object.fromEntries(tools.map((t) => [t.slug, t]))

test('src and data tools.json stay identical', () => {
  assert.equal(
    readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'),
    readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8'),
  )
})

test('The job hands-on wording is unchanged', async () => {
  const text = visible((await get('/methodology')).html)
  assert.ok(text.includes("How well it does its main job for a typical person. We go by the maker's docs and plans, public reviews, and hands-on use where we have it."))
})

test('Cline lists JetBrains, Cursor, Windsurf, the CLI, and desktop', () => {
  const t = by.cline
  for (const w of ['JetBrains', 'Cursor', 'Windsurf', 'CLI', 'desktop']) {
    assert.ok(t.description.includes(w) || t.tagline.includes(w) || t.tagline.includes('desktop'), w)
  }
})

test('Gemini is in Writing with Claude and ChatGPT, still #4, and the note distinguishes Plus and Pro', () => {
  assert.equal(by.gemini.category, 'writing')
  assert.equal(by.claude.category, 'writing')
  assert.equal(by.chatgpt.category, 'writing')
  assert.equal(by.gemini.rank, 4)
  assert.match(by.gemini.pricingNote, /Gmail help starts on Google AI Plus/)
  assert.match(by.gemini.pricingNote, /Docs help needs Google AI Pro/)
})

test('methodology adds coding-mix, recent additions, and sponsors-and-rank sections', async () => {
  const text = visible((await get('/methodology')).html)
  assert.ok(text.includes('Why the top 30 leans toward coding'))
  assert.ok(text.includes('Range still compares a tool\'s breadth across the whole catalog, not only inside one category.'))
  assert.ok(text.includes('The catalog grew fast in November as we filled gaps.'))
  assert.ok(text.includes('Sponsorship and affiliate links never change a tool\'s rank or its place in search.'))
  assert.ok(text.includes('If a sponsor\'s tool moves, the reason is logged on the'))
  assert.ok((await get('/methodology')).html.includes('href="/money"'))
})

test('rank changelog logs the Gemini category move without changing its overall rank', async () => {
  const html = (await get('/rank-changelog')).html
  const text = visible(html)
  assert.ok(text.includes('Gemini moved to the Writing category'))
  assert.ok(text.includes('Its overall rank is unchanged at #4.'))
  assert.ok(text.includes('now #4'))
})

test('confirmed price checks today have official links and dates', () => {
  assert.equal(by.grok.pricingUrl, 'https://x.ai/pricing')
  assert.ok(by.grok.priceChecked >= '2026-11-23')
  assert.equal(by['microsoft-copilot'].pricingUrl, 'https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products')
  assert.ok(by['microsoft-copilot'].priceChecked >= '2026-11-23')
  assert.ok(by['github-copilot'].priceChecked >= '2026-11-21')
  assert.equal(by.perplexity.pricingUrl, 'https://www.perplexity.ai/pro')
  assert.ok(by.perplexity.priceChecked >= '2026-11-21')
  assert.ok(by.chatgpt.priceChecked >= '2026-11-21')
  assert.equal(by['meta-ai'].pricingUrl, 'https://www.meta.com/meta-one-plans/')
  assert.ok(by['meta-ai'].priceChecked >= '2026-11-21')
  assert.equal(by['wix-studio-two'].pricingUrl, 'https://www.wix.com/studio/plans')
  assert.ok(by['wix-studio-two'].priceChecked >= '2026-11-21')
  const checked = tools.filter((t) => t.priceChecked && t.pricingUrl).length
  assert.equal(checked, 129)
  assert.equal(tools.length, 216)
})

test('index.js and tools.json have no em or en dashes', () => {
  const index = readFileSync(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8')
  const json = readFileSync(fileURLToPath(new URL('../src/tools.json', import.meta.url)), 'utf8')
  assert.equal(/[\u2013\u2014]/.test(index), false)
  assert.equal(/[\u2013\u2014]/.test(json), false)
})
