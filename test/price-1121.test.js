import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Traffic plan move 1 (2026-11-21): price-change permalinks, monthly roll-ups, RSS,
// pricing-intent titles for non-giant tools, signup + RSS on price pages, and honest /best claims.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const GIANTS = new Set(['chatgpt', 'claude', 'gemini', 'github-copilot', 'microsoft-copilot', 'midjourney', 'perplexity', 'grok', 'meta-ai', 'cursor', 'elevenlabs', 'runway', 'nano-banana', 'chatgpt-images', 'openai-codex', 'claude-code', 'notebooklm', 'canva', 'notion-ai', 'deepl-translator'])
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MON[m - 1]} ${d}, ${y}` }
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text(), headers: res.headers }
}

test('each price change has a permalink, a monthly roll-up, and a link from the index', async () => {
  const { status, html } = await get('/price-changes/deepseek-2026-11-18')
  assert.equal(status, 200)
  const title = decode(html.match(/<title>([^<]+)<\/title>/)[1])
  assert.equal(title, 'DeepSeek price change: API: web search and web fetch calls the model makes during a request, Nov 18, 2026 | BuildStack')
  assert.match(html, /<h1>DeepSeek price change: API: web search and web fetch calls the model makes during a request, Nov 18, 2026<\/h1>/)
  const text = visible(html)
  assert.ok(text.includes('$0.75 per 1,000 searches and $0.75 per 1,000 fetches'))
  assert.ok(text.includes('No per-call fee; the results count as model tokens'))
  assert.ok(text.includes('Nov 18, 2026'))
  assert.ok(html.includes('href="https://api-docs.deepseek.com/quick_start/pricing/"'))
  assert.ok(html.includes('href="/tool/deepseek"'))
  assert.ok(html.includes('Weekly AI price changes'))
  assert.ok(html.includes('href="/price-changes/rss.xml"'))
  assert.equal(html.includes('\u2014'), false)

  const month = await get('/price-changes/2026-11')
  assert.equal(month.status, 200)
  assert.ok(month.html.includes('AI price changes in November 2026'))
  assert.ok(month.html.includes('href="/price-changes/deepseek-2026-11-18"'))
  assert.ok(month.html.includes('Weekly AI price changes'))

  const idx = await get('/price-changes')
  assert.ok(idx.html.includes('href="/price-changes/deepseek-2026-11-18"'))
  assert.ok(idx.html.includes('href="/price-changes/2026-11"'))
  assert.ok(idx.html.includes('Weekly AI price changes'))
  assert.equal((await get('/price-changes/missing-tool-2026-11-18')).status, 404)
  assert.equal((await get('/price-changes/2099-01')).status, 404)
})

test('RSS feed lists each change, has autodiscovery, and /feed.xml redirects to it', async () => {
  const { status, html, headers } = await get('/price-changes/rss.xml')
  assert.equal(status, 200)
  assert.match(String(headers.get('content-type') || ''), /rss|xml/)
  assert.ok(html.includes('<rss version="2.0">'))
  assert.ok(html.includes('<title>BuildStack: weekly AI price changes</title>'))
  assert.ok(html.includes('<link>https://buildstack.tier11.com/price-changes/deepseek-2026-11-18</link>'))
  assert.ok(html.includes('<pubDate>Wed, 18 Nov 2026 00:00:00 GMT</pubDate>'))
  assert.equal(html.includes('\u2014'), false)
  const app = (await import('../src/index.js')).default
  const res = await app.request('http://local/feed.xml')
  assert.equal(res.status, 301)
  assert.equal(new URL(res.headers.get('location'), 'http://local').pathname, '/price-changes/rss.xml')
  const home = (await get('/')).html
  assert.ok(home.includes('type="application/rss+xml"'))
  assert.ok(home.includes('href="/price-changes/rss.xml"'))
  assert.ok(home.includes('Weekly AI price changes'))
  const sm = (await get('/sitemap.xml')).html
  for (const p of ['/price-changes', '/price-changes/rss.xml', '/price-changes/2026-11', '/price-changes/deepseek-2026-11-18']) {
    assert.ok(sm.includes(`<loc>https://buildstack.tier11.com${p}</loc>`), p)
  }
  assert.ok((await get('/llms.txt')).html.includes('https://buildstack.tier11.com/price-changes/rss.xml'))
})

test('non-giant tool pages use a pricing-intent title and a two-line answer; giants keep name and tagline', async () => {
  for (const slug of GIANTS) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    const { status, html } = await get(`/tool/${slug}`)
    assert.equal(status, 200, slug)
    const title = decode(html.match(/<title>([^<]+)<\/title>/)[1])
    assert.equal(title, `${t.name}: ${t.tagline} | BuildStack`, slug)
    assert.equal(html.includes('class="price-lead"'), false, slug)
    assert.match(html, new RegExp(`<h1>${t.name.replace(/[()]/g, '\\$&')}</h1>`))
  }
  const samples = tools.filter((t) => !GIANTS.has(t.slug)).slice(0, 12)
  samples.push(tools.find((t) => t.slug === 'lovable'), tools.find((t) => t.slug === 'deepseek'), tools.find((t) => t.slug === 'chatbase'))
  for (const t of samples) {
    const { html } = await get(`/tool/${t.slug}`)
    const title = decode(html.match(/<title>([^<]+)<\/title>/)[1])
    const checked = t.priceChecked ? `checked ${fmt(t.priceChecked)}` : 'not yet checked'
    assert.equal(title, `${t.name} pricing: free plan, starting price, ${checked} | BuildStack`, t.slug)
    assert.match(html, new RegExp(`<h1>${t.name.replace(/[()]/g, '\\$&')}</h1>`))
    assert.ok(html.includes('class="price-lead"'), t.slug)
    assert.ok(html.includes('Free plan:'), t.slug)
    assert.ok(html.includes('Starting price:'), t.slug)
    assert.ok(html.includes('Weekly AI price changes'), t.slug)
    assert.ok(html.includes('href="/price-changes/rss.xml"'), t.slug)
    if (t.pricingUrl) assert.ok(html.includes(t.pricingUrl), t.slug)
  }
})

test('/best guides only claim tools with a priceChecked date, generated from the tools on the page', async () => {
  const paths = [
    '/best/ai-coding-agent-for-beginners',
    '/best/ai-research-assistant',
    '/best/free-ai-tools',
    '/best/ai-voice-generator',
    '/best/ai-coding-assistant',
    '/best/ai-agent-builder',
    '/best/ai-tools-for-small-business',
    '/best/ai-transcription-tool',
    '/best/ai-writing-tool',
    '/best/ai-image-generator',
    '/best/ai-video-editor-for-youtube',
    '/best/ai-video-generator',
  ]
  for (const p of paths) {
    const text = visible((await get(p)).html)
    assert.equal(/pricing notes were checked on each official pricing page/i.test(text), false, p)
    assert.equal(/Prices come from each official pricing page/.test(text), false, p)
    assert.equal(/Prices were checked against each official pricing page/.test(text), false, p)
    assert.equal(/Free plans were checked against each official pricing page/.test(text), false, p)
    assert.ok(/Pricing for /.test(text) || /have not yet been matched/.test(text), p)
    assert.equal(/[\u2013\u2014]/.test(text), false, p)
  }
})

test('subscribe forms post to /api/subscribe and never promise a send date that is not approved', async () => {
  for (const p of ['/', '/price-changes', '/price-changes/deepseek-2026-11-18', '/price-changes/2026-11', '/tool/lovable', '/tool/cursor']) {
    const { html } = await get(p)
    assert.ok(html.includes("fetch('/api/subscribe'"), p)
    assert.ok(html.includes('onsubmit="subscribe(event)"'), p)
    assert.ok(html.includes('Weekly AI price changes'), p)
    assert.ok(html.includes('Nothing has been sent yet.'), p)
  }
})
