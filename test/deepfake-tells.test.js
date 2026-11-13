import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PATH = '/guides/how-celebrity-deepfakes-are-made'

test('deepfake guide shows the five-tells figure right after the 6 checks box', async () => {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request(`http://local${PATH}`)).text()
  assert.equal(html.includes('\u2014') || html.includes('\u2013'), false)
  const checks = html.indexOf('<h2>6 checks before you share</h2>')
  const fig = html.indexOf('<figure class="tells" id="tells">')
  const routes = html.indexOf('<h2>Four common routes, in plain terms</h2>')
  assert.ok(checks > 0 && fig > checks && routes > fig, 'figure sits between the checks box and the next section')
  const block = html.slice(fig, html.indexOf('</figure>', fig))
  assert.match(block, /<source type="image\/webp" srcset="\/guides\/deepfake-tells\.webp"\/>/)
  assert.match(block, /src="\/guides\/deepfake-tells\.jpg" width="1600" height="900" loading="lazy"/)
  for (const tell of ['Hairline', 'Blinking', 'Lighting', 'Teeth', 'Edges']) assert.match(block, new RegExp(`alt="[^"]*${tell}`))
  assert.match(block, /<figcaption>Five common tells\. Illustration of an invented person, not a real individual\.<\/figcaption>/)
  assert.match(html, /\.tells img \{[^}]*max-width: 100%[^}]*height: auto/)
  // hero and share image unchanged
  assert.match(html, /src="\/guides\/deepfake-hero\.jpg" width="1280" height="720"/)
  assert.match(html, /<meta property="og:image" content="https:\/\/buildstack\.tier11\.com\/guides\/deepfake-og\.jpg"\/>/)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])
  const article = ld['@graph'].find((n) => n['@type'] === 'Article')
  assert.deepEqual(article.image.map((i) => i.url), [
    'https://buildstack.tier11.com/guides/deepfake-og.jpg',
    'https://buildstack.tier11.com/guides/deepfake-tells.jpg',
  ])
  assert.equal(article.image[1].width, 1600)
  assert.equal(article.image[1].height, 900)
})

test('five-tells image files are present, small, and the right format', () => {
  const dir = fileURLToPath(new URL('../public/guides/', import.meta.url))
  const webp = readFileSync(dir + 'deepfake-tells.webp')
  const jpg = readFileSync(dir + 'deepfake-tells.jpg')
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF')
  assert.equal(webp.subarray(8, 12).toString(), 'WEBP')
  assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8)
  assert.ok(webp.length > 1000 && webp.length <= 200 * 1024, `webp ${webp.length}`)
  assert.ok(jpg.length > 1000 && jpg.length <= 200 * 1024, `jpg ${jpg.length}`)
})
