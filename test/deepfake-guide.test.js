import assert from 'node:assert/strict'
import { test } from 'node:test'

const PATH = '/guides/how-celebrity-deepfakes-are-made'
const H1 = 'How viral celebrity deepfakes get made, and how to spot one'
const DESC = 'A plain-language look at how viral celebrity deepfakes are usually assembled, how to spot one, and where BuildStack draws the line. Not a how-to.'

test('deepfake explainer is published with metadata, FAQ, sources, and listings', async () => {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${PATH}`)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.equal(html.includes('\u2014') || html.includes('\u2013'), false)
  assert.match(html, /<h1>How viral celebrity deepfakes get made, and how to spot one<\/h1>/)
  assert.match(html, /<meta name="description" content="A plain-language look at how viral celebrity deepfakes are usually assembled, how to spot one, and where BuildStack draws the line. Not a how-to."\/>/)
  assert.match(html, /By <a href="\/about">Sampson Brueher, editor<\/a>/)
  assert.match(html, /Nov 13, 2026 · 7 min read/)
  assert.match(html, /<h2>FAQ<\/h2>/)
  assert.equal(html.includes('Is ComfyUI a deepfake tool?'), false)
  assert.match(html, /<summary>Sources \(24\)<\/summary>/)
  assert.match(html, /TAKE IT DOWN Act/)
  assert.match(html, /This guide is not a how-to/)
  assert.equal(html.includes('DRAFT ONLY'), false)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])
  const types = (ld['@graph'] || []).map((n) => n['@type'])
  assert.equal(types.includes('Article'), true)
  assert.equal(types.includes('FAQPage'), true)
  const article = ld['@graph'].find((n) => n['@type'] === 'Article')
  assert.equal(article.headline, H1)
  assert.equal(article.description, DESC)
  assert.equal(article.datePublished, '2026-11-13')
  assert.equal(article.dateModified, '2026-11-13')
  assert.equal(article.author.name, 'Sampson Brueher')
  assert.equal(article.author.jobTitle, 'editor')
  const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage')
  assert.equal(faq.mainEntity.length, 3)
  assert.equal(faq.mainEntity[0]['@type'], 'Question')

  const map = await (await app.request('http://local/sitemap.xml')).text()
  assert.match(map, /<loc>https:\/\/buildstack\.tier11\.com\/guides\/how-celebrity-deepfakes-are-made<\/loc><lastmod>2026-11-13<\/lastmod>/)

  const llms = await (await app.request('http://local/llms.txt')).text()
  assert.match(llms, /https:\/\/buildstack\.tier11\.com\/guides\/how-celebrity-deepfakes-are-made/)
  const full = await (await app.request('http://local/llms-full.txt')).text()
  assert.match(full, /https:\/\/buildstack\.tier11\.com\/guides\/how-celebrity-deepfakes-are-made/)

  const video = await (await app.request('http://local/category/video')).text()
  assert.match(video, /href="\/guides\/how-celebrity-deepfakes-are-made"/)
  const videogen = await (await app.request('http://local/best/ai-video-generator')).text()
  assert.match(videogen, /href="\/guides\/how-celebrity-deepfakes-are-made"/)
  const home = await (await app.request('http://local/')).text()
  const guides = home.match(/id="guides"[\s\S]*?<\/section>/)[0]
  assert.match(guides, /href="\/guides\/how-celebrity-deepfakes-are-made"/)

  assert.match(html, /<figure class="hero-art capped">/)
  assert.match(html, /<source type="image\/webp" srcset="\/guides\/deepfake-hero\.webp"\/>/)
  assert.match(html, /src="\/guides\/deepfake-hero\.jpg"/)
  assert.match(html, /width="1280"/)
  assert.match(html, /height="720"/)
  assert.match(html, /fetchpriority="high"/)
  assert.match(html, /alt="Illustration: an invented face, half photographic and half digital wireframe"/)
  assert.match(html, /<figcaption>AI-generated illustration\. Not a real person\.<\/figcaption>/)
  assert.match(html, /<meta property="og:image" content="https:\/\/buildstack\.tier11\.com\/guides\/deepfake-og\.jpg"\/>/)
  assert.match(html, /<meta property="og:image:type" content="image\/jpeg"\/>/)
  assert.match(html, /<meta property="og:image:width" content="1200"\/>/)
  assert.match(html, /<meta property="og:image:height" content="630"\/>/)
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"\/>/)
  assert.match(html, /<meta name="twitter:image" content="https:\/\/buildstack\.tier11\.com\/guides\/deepfake-og\.jpg"\/>/)
  assert.equal(article.image[0].url, 'https://buildstack.tier11.com/guides/deepfake-og.jpg')
  assert.equal(article.image[0].width, 1200)
  assert.equal(article.image[0].height, 630)

  const { statSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const dir = fileURLToPath(new URL('../public/guides/', import.meta.url))
  for (const name of ['deepfake-hero.jpg', 'deepfake-hero.webp', 'deepfake-og.jpg']) {
    const info = statSync(dir + name)
    assert.ok(info.size > 1000, name)
    assert.ok(info.size <= 200 * 1024, `${name} is ${info.size}`)
  }

  assert.match(home, /data-source="home"/)
  assert.match(home, /onsubmit="subscribe\(event\)"/)
  assert.match(home, /<a href="https:\/\/itsbuildstack\.substack\.com">Weekly write-up on Substack<\/a>/)
  const org = (JSON.parse(home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1])['@graph'] || []).find((n) => n['@type'] === 'Organization')
  assert.ok(org)
  assert.equal(org.sameAs.includes('https://itsbuildstack.substack.com'), true)
  assert.match(llms, /Weekly write-up on Substack: https:\/\/itsbuildstack\.substack\.com/)
})
