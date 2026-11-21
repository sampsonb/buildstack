import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))

function lead(query, count = 3) {
  return rankTools(tools, query).slice(0, count)
}

function slugs(query, count = 3) {
  return lead(query, count).map((tool) => tool.slug)
}

function names(query, count = 3) {
  return lead(query, count).map((tool) => tool.name)
}

test('ai for writing blog posts matches write blog posts, not most of the catalog', () => {
  const wide = rankTools(tools, 'ai for writing blog posts')
  const tight = rankTools(tools, 'write blog posts')
  assert.deepEqual(slugs('ai for writing blog posts'), slugs('write blog posts'))
  assert.ok(wide.length < tools.length / 2, wide.length)
  assert.deepEqual(tight.slice(0, 2).map((t) => t.slug), ['claude', 'grammarly'])
  assert.ok(['chatgpt', 'quillbot'].includes(tight[2].slug), tight.map((t) => t.slug).join(', '))
  assert.ok(wide.slice(0, 3).every((tool) => tool.category === 'writing'))
})

test('transcribe meetings leads with consumer notetakers, not a developer model', () => {
  const top = lead('transcribe meetings')
  assert.ok(top.every((tool) => tool.category === 'voice'))
  assert.ok(top.every((tool) => ['otter', 'fireflies', 'granola', 'fathom'].includes(tool.slug)), names('transcribe meetings').join(', '))
  assert.ok(!slugs('transcribe meetings', 6).includes('nvidia-nemotron-transcribe'))
  const dev = rankTools(tools, 'open-weight transcription model')
  assert.ok(dev.length)
  assert.equal(dev[0].slug, 'nvidia-nemotron-transcribe')
})

test('ai browser leads with browser agents, not a photo upscaler', () => {
  const top = lead('ai browser')
  assert.ok(top.some((tool) => tool.slug === 'perplexity-comet'), names('ai browser').join(', '))
  assert.ok(!slugs('ai browser', 6).includes('topaz-labs'))
  assert.ok(!slugs('ai browser', 6).includes('reso-ai'))
  assert.ok(rankTools(tools, 'ai browser').length < tools.length / 4)
})

test('make a logo includes Canva with the other logo tools', () => {
  const top = slugs('make a logo', 8)
  assert.ok(top.includes('canva'), top.join(','))
  assert.ok(top.includes('ideogram') || top.includes('recraft'), top.join(','))
  assert.equal(slugs('make a logo', 3).includes('make'), false)
})

test('cheapest coding assistant favors free-tier coding tools', () => {
  const top = lead('cheapest coding assistant')
  assert.ok(top.every((tool) => tool.category === 'coding'), names('cheapest coding assistant').join(', '))
  assert.ok(top.every((tool) => tool.freeTier === true), names('cheapest coding assistant').join(', '))
  assert.ok(!slugs('cheapest coding assistant', 3).includes('claude-code'))
  assert.ok(slugs('cheapest coding assistant', 8).includes('github-copilot') || slugs('cheapest coding assistant', 8).some((s) => ['opencode', 'qwen-code', 'cline', 'github-copilot'].includes(s)))
})

test('phone calls leads with phone agents, not meeting notetakers', () => {
  const top = slugs('phone calls', 6)
  assert.ok(top.includes('call-e'), top.join(','))
  assert.ok(top.includes('vapi'), top.join(','))
  assert.ok(!top.includes('granola'))
  assert.ok(!top.includes('fireflies'))
  assert.ok(!slugs('phone calls', 3).includes('phonic-1'))
})

test('edit a podcast leads with podcast editors and does not leak image models', () => {
  const top = slugs('edit a podcast', 3)
  assert.ok(top.includes('descript'), top.join(','))
  assert.ok(top.includes('riverside'), top.join(','))
  assert.ok(!slugs('edit a podcast', 6).includes('nano-banana'))
  assert.ok(lead('edit a podcast').every((tool) => tool.category === 'video' || tool.category === 'voice'))
})

test('make a presentation does not let Make win on its name, and includes Gamma', () => {
  const top = slugs('make a presentation', 6)
  assert.ok(top.includes('gamma'), top.join(','))
  assert.ok(top.includes('canva'), top.join(','))
  assert.equal(slugs('make a presentation', 3)[0] === 'make' || slugs('make a presentation', 3).includes('make'), false, top.join(','))
  assert.equal(rankTools(tools, 'Make')[0].slug, 'make')
})

test('summarize a pdf includes general assistants and NotebookLM, not only paper tools', () => {
  const top = slugs('summarize a pdf', 8)
  assert.ok(top.includes('notebooklm') || top.includes('claude') || top.includes('chatgpt') || top.includes('gemini'), top.join(','))
  assert.ok(lead('summarize a pdf', 3).length === 3)
})

test('remove background from a photo leads with photo apps, not a model whose API is not live', () => {
  const top = slugs('remove background from a photo', 3)
  assert.ok(top.includes('photoroom'), top.join(','))
  assert.ok(top.includes('canva'), top.join(','))
  assert.ok(!top.includes('seedream-5-5'))
})

test('build a website without code surfaces Lovable, Bolt.new, v0 and Wix', () => {
  const top = slugs('build a website without code', 8)
  for (const slug of ['lovable', 'bolt', 'v0', 'wix-studio-two']) {
    assert.ok(top.includes(slug), `${slug} missing from ${top.join(',')}`)
  }
  assert.ok(!slugs('build a website without code', 3).includes('inkling-2-small'))
  assert.ok(!slugs('build a website without code', 3).includes('alpie-seed'))
})

test('make a video from text keeps a sensible video lead and drops discontinued Sora', () => {
  const top = lead('make a video from text')
  assert.ok(top.every((tool) => tool.category === 'video'), names('make a video from text').join(', '))
  assert.ok(slugs('make a video from text').includes('runway'))
  assert.ok(!rankTools(tools, 'make a video from text').some((tool) => tool.slug === 'sora'))
  assert.equal(rankTools(tools, 'Sora')[0].slug, 'sora')
})

test('write emails leads with writing tools, not a novel app', () => {
  const top = lead('write emails')
  assert.ok(top.every((tool) => tool.category === 'writing'), names('write emails').join(', '))
  assert.ok(!slugs('write emails', 3).includes('kudonovel'))
})

test('translate a document leads with DeepL Translator, not video dubbing tools', () => {
  assert.equal(slugs('translate a document')[0], 'deepl-translator')
  assert.ok(!slugs('translate a document', 3).includes('heygen'))
  assert.ok(!slugs('translate a document', 3).includes('synthesia'))
})

test('customer support chatbot for my website finds Intercom Fin, not voice notetakers', () => {
  const top = slugs('customer support chatbot for my website', 6)
  assert.ok(top.includes('intercom-fin'), top.join(','))
  assert.equal(slugs('customer support chatbot for my website')[0], 'intercom-fin')
  assert.ok(!top.includes('phonic-1'))
  assert.ok(!top.includes('fireflies'))
  assert.ok(!top.includes('deepl-voice'))
})

test('weekly inbox summary still surfaces Lumo', () => {
  assert.equal(slugs('weekly inbox summary')[0], 'lumo-desktop')
})

test('exact tool names still lead, including short names and discontinued tools', () => {
  for (const name of ['Make', 'Sora', 'Fathom', 'Vapi', 'QuillBot', 'Canva', 'Cursor']) {
    const first = rankTools(tools, name)[0]
    assert.ok(first, name)
    assert.equal(first.name, tools.find((t) => t.name === name || t.slug === name.toLowerCase()) ? first.name : first.name)
    assert.equal(first.name.toLowerCase().replace(/[^a-z0-9]+/g, ''), name.toLowerCase().replace(/[^a-z0-9]+/g, ''), name)
  }
})

const ADDED = [
  ['higgsfield', 'video', 'higgsfield', 'ai video in one place'],
  ['genspark', 'agents', 'genspark', 'all-in-one agent for slides'],
  ['vapi', 'agents', 'vapi', 'building AI phone agents'],
  ['intercom-fin', 'agents', 'intercom fin', 'customer support chatbot for my website'],
  ['fathom', 'voice', 'fathom', 'transcribe meetings'],
  ['deepl-translator', 'writing', 'deepl translator', 'translate a document'],
  ['quillbot', 'writing', 'quillbot', 'paraphrase my writing'],
]

test('2026-11-20 coverage tools exist with full fields and consecutive ranks', () => {
  assert.ok(tools.every((t, i) => t.rank === i + 1))
  assert.ok(tools.length >= 157)
  for (const [slug, cat] of ADDED) {
    const t = tools.find((x) => x.slug === slug)
    assert.ok(t, slug)
    assert.equal(t.category, cat)
    assert.equal(t.affiliate, false)
    assert.equal(t.featured, false)
    assert.equal(t.added, '2026-11-20')
    for (const k of ['name', 'url', 'tagline', 'description', 'pricingNote', 'strength', 'watchOut', 'priceFrom']) {
      assert.ok(String(t[k] || '').trim(), `${slug}.${k}`)
    }
    assert.equal(t.bestFor.length, 3)
    assert.equal(typeof t.freeTier, 'boolean')
    assert.ok(!JSON.stringify(t).includes('\u2014'))
  }
  assert.ok(!tools.some((t) => t.slug === 'chatgpt-atlas'))
})

test('2026-11-20 coverage tools are found by name and use case', () => {
  for (const [slug, , nameQ, useQ] of ADDED) {
    assert.equal(rankTools(tools, nameQ)[0].slug, slug, nameQ)
    assert.ok(rankTools(tools, useQ).slice(0, 8).some((t) => t.slug === slug), useQ)
  }
})

test('2026-11-20 coverage tool pages return 200 and site-wide date is honest', async () => {
  const app = (await import('../src/index.js')).default
  for (const [slug] of ADDED) assert.equal((await app.request(`http://local/tool/${slug}`)).status, 200, slug)
  const json = await (await app.request('http://local/tools.json')).json()
  assert.equal(json.count, tools.length)
  const latest = tools.reduce((m, t) => (t.updated > m ? t.updated : m), '')
  assert.ok(latest >= '2026-11-20')
  assert.equal(json.updated, latest)
  const llms = await (await app.request('http://local/llms.txt')).text()
  assert.ok(llms.includes(`Updated: ${latest}`))
  assert.ok(llms.includes(`Tools: ${tools.length}`))
})
