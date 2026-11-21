import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

// Trust fixes before the Dec 1 Show HN (2026-11-21): every count and date comes from tools.json,
// the price-check number is the real one, ranks have reasons, Sponsor replaces Featured, and the
// money and license pages say what is true today.
const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const dataCopy = readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8')
assert.equal(dataCopy, readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'), 'data/tools.json matches src/tools.json')
const byRank = [...tools].sort((a, b) => a.rank - b.rank)
const N = tools.length
const CHECKED = tools.filter((t) => t.priceChecked && t.pricingUrl).length
const UPDATED = tools.reduce((m, t) => (t.updated && t.updated > m ? t.updated : m), '2026-11-13')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MON[m - 1]} ${d}, ${y}` }
const COVER = `${CHECKED} of ${N} prices checked against the vendor's page`
async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text(), headers: res.headers }
}
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')

test('counts and dates agree on every page that states them', async () => {
  const home = (await get('/')).html
  const meth = (await get('/methodology')).html
  const about = (await get('/about')).html
  const llms = (await get('/llms.txt')).html
  const full = (await get('/llms-full.txt')).html
  const json = JSON.parse((await get('/tools.json')).html)
  assert.ok(home.includes(`${N} AI tools`), 'home count')
  assert.ok(home.includes(`From #1 to #${N}`), 'home rank range')
  assert.ok(home.includes(COVER), 'home coverage')
  assert.ok(meth.includes(`Last updated: ${fmt(UPDATED)} · ${N} tools`), 'methodology header')
  assert.ok(meth.includes(`#1 to #${N}`), 'methodology range')
  assert.ok(meth.includes(COVER), 'methodology coverage')
  assert.ok(about.includes(`${N} tools as of ${fmt(UPDATED)}`), 'about count and date')
  assert.ok(about.includes(COVER), 'about coverage')
  assert.ok(llms.includes(`Tools: ${N}`) && llms.includes(`Updated: ${UPDATED}`) && llms.includes(COVER), 'llms.txt')
  assert.ok(full.includes(`Tools: ${N}`) && full.includes(`Updated: ${UPDATED}`) && full.includes(COVER), 'llms-full.txt')
  assert.equal(json.count, N)
  assert.equal(json.tools.length, N)
  assert.equal(json.updated, UPDATED)
  assert.equal(json.priceCheckedCount, CHECKED)
  assert.equal(json.tools.filter((t) => t.priceChecked && t.pricingUrl).length, CHECKED)
  // no page states a different "N of M prices" or "#1 to #M" or "M tools ranked"
  for (const [name, html] of [['home', home], ['methodology', meth], ['about', about], ['llms', llms], ['full', full]]) {
    for (const m of visible(html).matchAll(/(\d+) of (\d+) prices/g)) assert.equal(`${m[1]} of ${m[2]}`, `${CHECKED} of ${N}`, name)
    for (const m of visible(html).matchAll(/#1 to #(\d+)/g)) assert.equal(Number(m[1]), N, name)
  }
  assert.ok(CHECKED < N, 'not every tool is checked, and the site never claims it')
})

test('checked means a date and an official pricing link, and the top-50 checks stay verified', () => {
  for (const t of tools) {
    if (t.priceChecked) assert.ok(t.pricingUrl, `${t.slug} has a check date but no pricing link`)
    if (t.priceChecked) assert.match(t.priceChecked, /^2026-\d\d-\d\d$/, t.slug)
  }
  const top50 = byRank.slice(0, 50).filter((t) => t.priceChecked && t.pricingUrl).length
  assert.ok(top50 >= 34, `top 50 checked: ${top50}`)
})

test('Sponsor replaces Featured in all copy', async () => {
  const sm = (await get('/sitemap.xml')).html
  const paths = [...sm.matchAll(/<loc>https:\/\/buildstack\.tier11\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/')
  assert.ok(paths.length > 100)
  for (const p of paths) {
    if (p.startsWith('/tool/')) continue
    if (p === '/tools.json') continue // the JSON key `featured` is a data field that consumers read, not copy
    const { status, html } = await get(p)
    assert.equal(status, 200, p)
    assert.equal(/featured/i.test(visible(html)), false, `${p} still says Featured`)
  }
  for (const f of ['/llms.txt', '/llms-full.txt']) assert.equal(/featured/i.test((await get(f)).html), false, f)
  const home = (await get('/')).html
  assert.ok(home.includes('Rank and search position are never sold.'))
})

test('/get-featured is a permanent redirect to /submit, and the sitemap lists the new pages', async () => {
  const app = (await import('../src/index.js')).default
  const res = await app.request('http://local/get-featured')
  assert.equal(res.status, 301)
  assert.equal(new URL(res.headers.get('location'), 'http://local').pathname, '/submit')
  const sm = (await get('/sitemap.xml')).html
  for (const p of ['/submit', '/money', '/rank-changelog']) assert.ok(sm.includes(`<loc>https://buildstack.tier11.com${p}</loc>`), p)
  assert.equal(sm.includes('get-featured'), false)
  assert.ok((await get('/llms.txt')).html.includes('List your tool (free): https://buildstack.tier11.com/submit'))
  for (const p of ['/', '/tool/claude', '/methodology']) {
    const html = (await get(p)).html
    assert.ok(html.includes('<a href="/submit">List your tool</a>'), p)
    assert.equal(html.includes('/get-featured'), false, p)
  }
  const sub = await get('/submit')
  assert.equal(sub.status, 200)
  assert.ok(sub.html.includes('Submitting is free'))
  assert.equal(/\$\d|pricing plan|pay to/i.test(visible(sub.html).replace('no listing fees', '')), false)
})

test('top 30 have one-line reasons on the tool page, in tools.json, and on /methodology', async () => {
  const withReason = tools.filter((t) => t.rankReason)
  assert.deepEqual(withReason.map((t) => t.slug).sort(), byRank.slice(0, 30).map((t) => t.slug).sort())
  const meth = (await get('/methodology')).html
  const json = JSON.parse((await get('/tools.json')).html)
  for (const t of byRank.slice(0, 30)) {
    assert.ok(t.rankReason.length > 20 && t.rankReason.length <= 170, `${t.slug} length ${t.rankReason.length}`)
    assert.ok(!/[\u2013\u2014]/.test(t.rankReason), `${t.slug} dash`)
    assert.ok(/^[A-Z].*[.]$/.test(t.rankReason), `${t.slug} sentence`)
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const { html } = await get(`/tool/${t.slug}`)
    assert.equal((html.match(/<p class="reason">/g) || []).length, 1, t.slug)
    assert.ok(html.includes(`<strong>Why #${t.rank} overall:</strong> ${esc(t.rankReason)}`), t.slug)
    assert.ok(meth.includes(esc(t.rankReason)), `${t.slug} on methodology`)
    assert.equal(json.tools.find((x) => x.slug === t.slug).rankReason, t.rankReason)
  }
  const t31 = byRank[30]
  assert.equal((await get(`/tool/${t31.slug}`)).html.includes('<p class="reason">'), false)
  assert.equal(json.tools.find((x) => x.slug === t31.slug).rankReason, null)
})

test('methodology states criteria, who does what, affiliate labeling, license, and links /money', async () => {
  const html = (await get('/methodology')).html
  const text = visible(html)
  assert.ok(html.includes('id="criteria"') && text.includes('Ranking criteria'))
  assert.ok(text.includes('Sampson sets each rank by hand'))
  assert.ok(text.includes('Sampson Brueher sets every rank. Write-ups and price checks are drafted with AI help and checked against the maker\'s pages, and Sampson reviews them.'))
  assert.ok(text.includes('visible "Affiliate link" label') && text.includes('affiliate flag'))
  assert.ok(text.includes('No affiliate links are live today'))
  assert.ok(text.includes('CC BY 4.0'))
  assert.ok(html.includes('href="/money"') && html.includes('href="/rank-changelog"'))
  assert.ok(text.includes('Rank and search position are never sold'))
})

test('license is stated in llms.txt, llms-full.txt, tools.json (wrapper only), the footer, and about', async () => {
  const llms = (await get('/llms.txt')).html
  assert.ok(llms.includes('License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'))
  assert.ok((await get('/llms-full.txt')).html.includes('License: CC BY 4.0'))
  const res = await get('/tools.json')
  const json = JSON.parse(res.html)
  assert.equal(json.license, 'CC BY 4.0')
  assert.equal(json.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/')
  assert.ok(Array.isArray(json.tools), 'consumers of json.tools keep working')
  for (const k of ['slug', 'name', 'rank', 'featured', 'affiliate', 'pricingUrl', 'priceChecked']) assert.ok(k in json.tools[0], k)
  assert.equal('license' in json.tools[0], false, 'license is on the wrapper, not every tool')
  for (const p of ['/', '/tool/claude', '/about']) assert.ok(/<p class="footlic">[^<]*tools\.json and llms\.txt is licensed <a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"[^>]*>CC BY 4\.0<\/a>/.test((await get(p)).html), p)
  assert.ok(visible((await get('/about')).html).includes('CC BY 4.0'))
})

test('affiliate label code exists on cards and tool pages, and no tool is affiliate yet', async () => {
  assert.equal(tools.filter((t) => t.affiliate).length, 0)
  assert.ok(tools.every((t) => typeof t.affiliate === 'boolean'), 'flag stays in tools.json')
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  assert.ok(src.includes(`\${t.affiliate ? '<span class="tag aff">Affiliate link</span>' : ''}`), 'card label')
  assert.ok(src.includes('<span class="tag aff">Affiliate link</span> We may earn a commission'), 'tool page label')
  assert.ok(src.includes(`rel="\${t.affiliate ? 'sponsored ' : ''}noopener noreferrer"`), 'rel sponsored')
  assert.equal(src.includes('affiliate') && /rankTools[\s\S]{0,200}affiliate/.test(readFileSync(new URL('../src/search.js', import.meta.url), 'utf8')), false)
})

test('/money says $0 today, what is planned, and what we never do', async () => {
  const { status, html } = await get('/money')
  assert.equal(status, 200)
  const text = visible(html)
  assert.ok(text.includes('BuildStack earns $0 today.'))
  assert.ok(text.includes('Dec 8, 2026') && text.includes('affiliate'))
  assert.ok(text.includes('Jan 4, 2027') && text.includes('1,000 human visits a month'))
  for (const never of ['Paid rank', 'Listing fees', 'paid fast-track', 'Sponsored comparison pages', 'Sponsors inside ranked lists or search results']) assert.ok(text.toLowerCase().includes(never.toLowerCase()), never)
  assert.ok(html.includes('Last updated') === false && /As of [A-Z][a-z]{2} \d{1,2}, 2026/.test(text))
  assert.ok(/<footer[\s\S]*href="\/money"/.test((await get('/')).html), 'footer link')
  assert.ok(/stripe/i.test(html) === false)
  assert.ok(visible((await get('/about')).html).includes('Sampson Brueher of tier11 sets every rank. An AI agent writes'))
})

test('rank changelog starts with todays catalog add and lists the 12 tools', async () => {
  const { status, html } = await get('/rank-changelog')
  assert.equal(status, 200)
  const text = visible(html)
  assert.ok(text.includes('Nov 21, 2026: Catalog add: 12 tools'))
  assert.ok(text.includes('162 to 174'))
  for (const s of ['acrobat-ai-assistant', 'chatpdf', 'adobe-express', 'dia', 'opera-neon', 'retell-ai', 'bland-ai', 'chatbase', 'tidio', 'zendesk-ai', 'voiceflow', 'google-translate']) {
    const t = tools.find((x) => x.slug === s)
    assert.ok(html.includes(`<a href="/tool/${s}">${t.name}</a>, now #${t.rank} overall`), s)
  }
})

test('related searches for support chatbot, phone calls, and ai browser follow the top result and are on topic', async () => {
  const want = {
    'support chatbot': ['customer support chatbot', 'ai helpdesk'],
    'phone calls': ['answer phone calls', 'ai phone agent'],
    'ai browser': ['ai web browser', 'browser agent'],
  }
  for (const [q, must] of Object.entries(want)) {
    const { html } = await get(`/?q=${encodeURIComponent(q)}`)
    const rel = html.slice(html.indexOf('id="related"'), html.indexOf('</section>', html.indexOf('id="related"')))
    const links = [...rel.matchAll(/href="\/\?q=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]))
    assert.equal(links.length, 3, q)
    const cat = rankTools(tools, q)[0].category
    for (const r of links) assert.equal(rankTools(tools, r)[0].category, cat, `${q} -> ${r}`)
    for (const m of must) assert.ok(links.includes(m), `${q} should suggest ${m}: ${links.join(', ')}`)
    assert.equal(links.includes('automate workflows') || links.includes('build an ai agent'), false, `${q}: generic agent suggestions`)
  }
})

test('no em or en dashes in the new pages and files', async () => {
  for (const p of ['/money', '/submit', '/rank-changelog', '/methodology', '/about', '/', '/llms.txt', '/llms-full.txt', '/tools.json']) {
    assert.equal(/[\u2013\u2014]/.test((await get(p)).html), false, p)
  }
})
