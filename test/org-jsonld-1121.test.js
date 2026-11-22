import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SITE = 'https://buildstack.tier11.com'
const SAME_AS = [
  'https://x.com/itsbuildstack',
  'https://github.com/sampsonb/buildstack',
  'https://itsbuildstack.substack.com',
]

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

function ldOf(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => {
    const data = JSON.parse(m[1])
    return data
  })
  assert.ok(blocks.length >= 1, 'expected JSON-LD')
  return blocks
}

function graphOf(html) {
  const data = ldOf(html)[0]
  return data['@graph'] || [data]
}

function orgsOf(html) {
  return graphOf(html).filter((n) => n['@type'] === 'Organization')
}

function checkOrg(org, where) {
  assert.equal(org['@type'], 'Organization', where)
  assert.equal(org['@id'], `${SITE}/#organization`, where)
  assert.equal(org.name, 'BuildStack', where)
  assert.equal(org.url, `${SITE}/`, where)
  assert.equal(org.description, 'Free ranked directory of AI tools. Type a use case, get best-fit tools. Rank and search position are never sold.', where)
  const logoUrl = typeof org.logo === 'string' ? org.logo : org.logo && org.logo.url
  assert.ok(/^https:\/\/buildstack\.tier11\.com\//.test(logoUrl), `${where} logo`)
  if (org.logo && typeof org.logo === 'object') assert.equal(org.logo['@type'], 'ImageObject', where)
  assert.deepEqual(org.sameAs, SAME_AS, where)
  assert.equal(org.sameAs.some((u) => /reddit\.com/i.test(u)), false, where)
}

test('homepage has exactly one Organization block, with verified sameAs URLs, and a WebSite node', async () => {
  const { status, html } = await get('/')
  assert.equal(status, 200)
  const orgs = orgsOf(html)
  assert.equal(orgs.length, 1)
  checkOrg(orgs[0], 'home')
  const sites = graphOf(html).filter((n) => n['@type'] === 'WebSite')
  assert.equal(sites.length, 1)
  assert.equal(sites[0].name, 'BuildStack')
  assert.equal(sites[0].url, `${SITE}/`)
  assert.equal(sites[0].publisher['@id'], `${SITE}/#organization`)
})

test('about and methodology include the same Organization node once', async () => {
  for (const path of ['/about', '/methodology']) {
    const { status, html } = await get(path)
    assert.equal(status, 200, path)
    const orgs = orgsOf(html)
    assert.equal(orgs.length, 1, path)
    checkOrg(orgs[0], path)
    assert.equal(JSON.stringify(orgs[0]).includes('\\u2013') || JSON.stringify(orgs[0]).includes('\\u2014'), false, path)
  }
})

test('Organization copy in index.js has no em or en dashes', () => {
  const index = readFileSync(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8')
  assert.equal(/[\u2013\u2014]/.test(index), false)
})
