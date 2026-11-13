import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

const SITE = 'https://buildstack.tier11.com'

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

function graphOf(html) {
  return JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])['@graph']
}

test('about page is a human page with a photo, first person copy, and chatbot facts lower down', async () => {
  const { status, html } = await get('/about')
  assert.equal(status, 200)
  assert.match(html, /<h1>About BuildStack<\/h1>/)
  assert.match(html, /<source type="image\/webp" srcset="\/about\/sampson\.webp"\/>/)
  assert.match(html, /<img src="\/about\/sampson\.jpg" width="480" height="480" alt="Sampson Brueher"/)
  assert.match(html, /I'm Sampson Brueher, and I edit BuildStack\./)
  assert.match(html, /<a href="https:\/\/tier11\.com">tier11<\/a>, an IT consulting company that helps businesses pick AI tools and roll them out safely\./)
  assert.match(html, /Ranks are never for sale, and paid placements aren't offered\./)
  assert.match(html, /disclosed and flagged/)
  assert.match(html, /I use AI agents to research listings and track releases and prices daily\. I review the rankings, and the calls are mine\./)
  assert.match(html, /<a href="\/methodology">How we rank<\/a>/)
  assert.match(html, /mailto:buildstack@tier11\.com/)
  assert.match(html, /href="https:\/\/itsbuildstack\.substack\.com"/)
  assert.match(html, /href="https:\/\/x\.com\/itsbuildstack"/)
  const human = html.indexOf('How tools get ranked')
  const bots = html.indexOf('id="chatbots"')
  assert.ok(human > 0 && bots > human)
  assert.equal(/[\u2014\u2013]/.test(html), false)
  assert.equal(/real AI tools/i.test(html), false)
})

test('about page has Person JSON-LD and the guide cites it as author', async () => {
  const { html } = await get('/about')
  const graph = graphOf(html)
  const person = graph.find((n) => n['@type'] === 'Person')
  assert.ok(person)
  assert.equal(person['@id'], `${SITE}/about#sampson`)
  assert.equal(person.name, 'Sampson Brueher')
  assert.equal(person.url, `${SITE}/about`)
  assert.equal(person.image, `${SITE}/about/sampson.jpg`)
  assert.equal(person.worksFor.name, 'tier11')
  assert.equal(person.worksFor.url, 'https://tier11.com')
  assert.deepEqual(person.sameAs, ['https://x.com/itsbuildstack', 'https://itsbuildstack.substack.com'])
  const page = graph.find((n) => n['@type'] === 'AboutPage')
  assert.equal(page.mainEntity['@id'], person['@id'])

  const guide = await get('/guides/how-celebrity-deepfakes-are-made')
  const article = graphOf(guide.html).find((n) => n['@type'] === 'Article')
  assert.equal(article.author['@id'], `${SITE}/about#sampson`)
  assert.equal(article.author.url, `${SITE}/about`)
  assert.match(guide.html, /By <a href="\/about">Sampson Brueher, editor<\/a>/)
  assert.match(guide.html, /edited by <a href="\/about">Sampson Brueher<\/a>/)
  assert.equal(/Sampson Brueher, editor<\/p>/.test(guide.html), false)
})

test('headshot files are present and small', () => {
  for (const name of ['sampson.webp', 'sampson.jpg']) {
    const info = statSync(new URL(`../public/about/${name}`, import.meta.url))
    assert.ok(info.size > 1000 && info.size <= 120 * 1024, `${name} ${info.size}`)
  }
  const jpg = readFileSync(new URL('../public/about/sampson.jpg', import.meta.url))
  assert.equal(jpg[0], 0xff)
  assert.equal(jpg[1], 0xd8)
  const webp = readFileSync(new URL('../public/about/sampson.webp', import.meta.url))
  assert.equal(webp.subarray(8, 12).toString('latin1'), 'WEBP')
})
