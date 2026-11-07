import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)

function names(query) {
  return rankTools(tools, query).map((tool) => tool.name)
}

function wordsOf(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) || []
}

function mentions(tool, word) {
  const tokens = wordsOf([tool.name, ...(tool.bestFor || [])].join(' '))
  return tokens.includes(word)
}

function lead(query, count = 3) {
  return rankTools(tools, query).slice(0, count)
}

test('blog paraphrases lead with writing tools', () => {
  for (const query of ['write a blog post', 'blog writing', 'write blog posts']) {
    const top = lead(query)
    assert.equal(top.length, 3, query)
    assert.ok(top.every((tool) => tool.category === 'writing'), `${query}: ${top.map((tool) => tool.name).join(', ')}`)
    assert.equal(top.some((tool) => tool.slug === 'consensus' || tool.slug === 'cursor' || tool.slug === 'canva'), false, query)
  }
  assert.ok(rankTools(tools, 'write a blog post').length < tools.length / 2)
})

test('draft a blog leads with writing tools', () => {
  const top = lead('draft a blog')
  assert.ok(top.every((tool) => tool.category === 'writing'), top.map((tool) => tool.name).join(', '))
  const slugs = rankTools(tools, 'draft a blog').slice(0, 3).map((tool) => tool.slug)
  assert.equal(slugs.includes('ideogram'), false)
  assert.equal(slugs.includes('pika-h3-flex'), false)
})

test('closed-class query a returns the directory in rank order', () => {
  const results = rankTools(tools, 'a')
  assert.deepEqual(results.map((tool) => tool.slug), byRank.map((tool) => tool.slug))
})

test('empty query returns the directory in rank order', () => {
  const results = rankTools(tools, '')
  assert.equal(results.length, tools.length)
  assert.equal(results[0].slug, byRank[0].slug)
  assert.deepEqual(results.map((tool) => tool.rank), byRank.map((tool) => tool.rank))
})

test('a query that matches nothing returns no tools', () => {
  assert.deepEqual(names('zzzz-no-such-tool-qqq'), [])
})

test('poster finds Ideogram and the word post does not', () => {
  assert.deepEqual(names('poster'), ['Ideogram'])
  assert.equal(names('post').includes('Ideogram'), false)
})

test('dotted and hyphenated names stay exact', () => {
  assert.deepEqual(names('bolt.new'), ['Bolt.new'])
  assert.deepEqual(names('otter.ai'), ['Otter.ai'])
  const phrase = rankTools(tools, 'text-to-speech')
  assert.ok(phrase.length > 0)
  assert.ok(phrase.slice(0, 3).every((tool) => tool.category === 'voice'))
  assert.ok(phrase.every((tool) => [tool.name, tool.tagline, tool.description, ...(tool.bestFor || [])].join(' ').toLowerCase().includes('text-to-speech')))
  assert.match(names('gpt-6.1')[0], /GPT-6\.1/)
})

test('every exact tool name leads its own lookup', () => {
  for (const tool of tools) {
    const first = rankTools(tools, tool.name)[0]
    assert.equal(first.slug, tool.slug, tool.name)
  }
})

test('code and codex stay different words, and OpenCode is findable', () => {
  assert.equal(rankTools(tools, 'codex')[0].slug, 'openai-codex')
  assert.equal(rankTools(tools, 'opencode')[0].slug, 'opencode')
  assert.equal(rankTools(tools, 'open code')[0].slug, 'opencode')
  const codeLead = lead('code')
  assert.ok(codeLead.every((tool) => tool.category === 'coding' || mentions(tool, 'code')))
  assert.notEqual(codeLead[0].slug, 'openai-codex')
  assert.ok(rankTools(tools, 'code').some((tool) => tool.slug === 'opencode'))
})

test('plurals agree and a short prefix is not a different word', () => {
  assert.deepEqual(names('post'), names('posts'))
  assert.equal(names('post').includes('Ideogram'), false)
  assert.equal(rankTools(tools, 'image')[0].category, 'images')
  assert.equal(rankTools(tools, 'images')[0].category, 'images')
  assert.equal(rankTools(tools, 'paper')[0].slug, rankTools(tools, 'papers')[0].slug)
  const voiceLead = lead('voice')
  assert.ok(voiceLead.every((tool) => tool.category === 'voice'), voiceLead.map((tool) => tool.name).join(', '))
  const agentLead = lead('agent', 5)
  assert.ok(agentLead.every((tool) => tool.category === 'agents'), agentLead.map((tool) => tool.name).join(', '))
  assert.equal(agentLead.some((tool) => tool.slug === 'kino'), false)
})

test('representative intents keep a relevant lead', () => {
  assert.ok(lead('coding IDE agent refactor').every((tool) => tool.category === 'coding'))
  assert.ok(lead('coding').every((tool) => tool.category === 'coding'))
  assert.ok(lead('write code').every((tool) => tool.category === 'coding' || mentions(tool, 'code')))
  assert.equal(names('images art midjourney flux')[0], 'Midjourney')
  assert.ok(lead('generate images').every((tool) => tool.category === 'images'))
  assert.deepEqual(names('video runway kling sora').slice(0, 3).sort(), ['Kling AI', 'Runway', 'Sora'])
  assert.ok(lead('video editing').every((tool) => tool.category === 'video'))
  assert.equal(names('voice speech elevenlabs')[0], 'ElevenLabs')
  assert.equal(rankTools(tools, 'voiceover for a podcast')[0].slug, 'elevenlabs')
  assert.match(names('transcribe a meeting')[0], /Transcribe/)
  assert.equal(rankTools(tools, 'transcribe a meeting')[0].category, 'voice')
  assert.ok(rankTools(tools, 'transcription').every((tool) => tool.category === 'voice'))
  assert.ok(lead('research search citations papers').every((tool) => tool.category === 'research'))
  assert.equal(names('research search citations papers')[0], 'SciSpace')
  assert.ok(lead('summarize research papers').every((tool) => tool.category === 'research'))
  const copyLead = rankTools(tools, 'write marketing copy')[0]
  assert.equal(copyLead.category, 'writing')
  assert.ok(mentions(copyLead, 'copy'))
})

test('write a React app leads with coding tools that mention an app or React', () => {
  const top = lead('write a React app')
  assert.ok(top.every((tool) => tool.category === 'coding'), top.map((tool) => `${tool.name} ${tool.category}`).join(', '))
  assert.ok(top.every((tool) => mentions(tool, 'react') || mentions(tool, 'app')), top.map((tool) => tool.name).join(', '))
  assert.equal(top.some((tool) => tool.slug === 'claude' || tool.slug === 'grammarly'), false)
})

test('edit a youtube video leads with video tools', () => {
  const top = lead('edit a youtube video')
  assert.ok(top.every((tool) => tool.category === 'video'), top.map((tool) => tool.name).join(', '))
  assert.ok(rankTools(tools, 'edit a youtube video').length < tools.length)
})

test('homepage best-fit order follows rankTools', async () => {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request('http://local/?q=write%20a%20blog%20post')).text()
  const grid = html.match(/Best fit for[\s\S]*?<div class="grid">([\s\S]*?)<\/div>\s*<\/section>/)
  const slugs = [...grid[1].matchAll(/href="\/tool\/([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(slugs, rankTools(tools, 'write a blog post').map((tool) => tool.slug))
  assert.equal(html.includes('async function subscribe'), true)
})

test('homepage top ranked section stays in editorial rank order', async () => {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request('http://local/')).text()
  const start = html.indexOf('<h2>Top ranked</h2>')
  const end = html.indexOf('Browse all categories', start)
  const slugs = [...html.slice(start, end).matchAll(/href="\/tool\/([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(slugs, byRank.slice(0, 12).map((tool) => tool.slug))
  assert.equal(html.includes('FAQPage'), true)
})
