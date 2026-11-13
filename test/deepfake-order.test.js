import assert from 'node:assert/strict'
import { test } from 'node:test'

const PATH = '/guides/how-celebrity-deepfakes-are-made'

async function page() {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request(`http://local${PATH}`)).text()
  return html.slice(html.indexOf('<body'))
}

test('deepfake guide leads with how fakes get made, then how to catch one', async () => {
  const body = await page()
  const at = (needle) => {
    const i = body.indexOf(needle)
    assert.ok(i > 0, `missing: ${needle}`)
    return i
  }
  const order = [
    '<p class="byline-note">BuildStack is a free ranked directory of AI tools.',
    '<figure class="hero-art capped">',
    'did not come out of a film studio',
    '<h2>Four ways the fakes get made</h2>',
    '<strong>Face-swap',
    '<strong>Image-to-video',
    '<strong>Voice cloning and lip-sync',
    '<strong>Hosted video apps',
    'id="likeness-rules"',
    '<h2>Now the useful part: how to catch one</h2>',
    'mid-50s and mid-70s',
    '<h2>6 checks before you share</h2>',
    '<figure class="tells" id="tells">',
    'What are you trying to make? Type the job.',
    '<h2>FAQ</h2>',
    '<details class="sources">',
    'This guide is not a how-to.',
  ]
  const idx = order.map(at)
  for (let k = 1; k < idx.length; k++) assert.ok(idx[k] > idx[k - 1], `${order[k]} should come after ${order[k - 1]}`)
  assert.ok(at('<h2>Four ways the fakes get made</h2>') < at('<div class="checks" id="checks">'), 'how-made section precedes the 6 checks box')
})

test('deepfake guide stays an explainer and names no face-swap apps', async () => {
  const body = await page()
  for (const name of [/DeepFaceLab/i, /FaceFusion/i, /\bRope\b/]) assert.equal(name.test(body), false, String(name))
  assert.equal(body.includes('\u2014') || body.includes('\u2013'), false)
  assert.equal((body.match(/not a how-to/gi) || []).length, 1)
})
