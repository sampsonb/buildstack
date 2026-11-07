import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const byRank = [...tools].sort((a, b) => a.rank - b.rank)

function names(query) {
  return rankTools(tools, query).map((tool) => tool.name)
}

const taggedWritingTools = byRank.filter((tool) => (
  tool.category === 'writing'
  && (tool.bestFor || []).some((tag) => /\bwriting\b/i.test(tag))
))

test('write a blog post leads with writing tools and drops poster false friends', () => {
  const results = rankTools(tools, 'write a blog post')
  assert.deepEqual(
    results.slice(0, taggedWritingTools.length).map((tool) => tool.slug),
    taggedWritingTools.map((tool) => tool.slug),
  )
  assert.ok(results.length < tools.length, 'the letter a must not match the whole catalog')
  assert.ok(results.length < tools.length / 2)
  assert.equal(results.slice(0, 5).some((tool) => tool.slug === 'ideogram'), false)
  assert.equal(results[0].slug === 'pagerduty-sre-agent', false)
})

test('blog writing paraphrases keep the same writing leaders first', () => {
  for (const query of ['write blog posts', 'blog writing']) {
    const results = rankTools(tools, query)
    assert.equal(results[0].category, 'writing', query)
    assert.deepEqual(
      results.slice(0, taggedWritingTools.length).map((tool) => tool.slug),
      taggedWritingTools.map((tool) => tool.slug),
      query,
    )
  }
})

test('draft a blog does not lead with a poster tool', () => {
  const results = rankTools(tools, 'draft a blog')
  assert.notEqual(results[0].slug, 'ideogram')
  assert.equal(results[0].category, 'writing')
  assert.ok(results.length < tools.length)
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
  assert.deepEqual(names('gpt-6.1'), ['GPT-6.1 Terra', 'OpenAI Codex'])
  assert.deepEqual(names('text-to-speech').slice(0, 3), ['Mistral Voxtral 3', 'ElevenLabs', 'HeyGen'])
})

test('the word voice keeps ElevenLabs first', () => {
  assert.equal(names('voice')[0], 'ElevenLabs')
})

test('representative intents keep their catalog winners', () => {
  assert.equal(names('coding IDE agent refactor')[0], 'Claude Code')
  assert.equal(rankTools(tools, 'coding')[0].category, 'coding')
  assert.equal(names('write code')[0], 'Claude Code')
  assert.equal(names('images art midjourney flux')[0], 'Midjourney')
  assert.equal(rankTools(tools, 'generate images')[0].category, 'images')
  assert.equal(names('video runway kling sora')[0], 'Runway')
  assert.ok(names('video runway kling sora').slice(0, 3).includes('Kling AI'))
  assert.ok(names('video runway kling sora').slice(0, 3).includes('Sora'))
  assert.equal(rankTools(tools, 'video editing')[0].category, 'video')
  assert.equal(names('voice speech elevenlabs')[0], 'ElevenLabs')
  assert.equal(names('voiceover for a podcast')[0], 'ElevenLabs')
  assert.equal(rankTools(tools, 'transcribe a meeting')[0].category, 'voice')
  assert.match(names('transcribe a meeting')[0], /Transcribe/)
  const transcription = rankTools(tools, 'transcription')
  assert.ok(transcription.every((tool) => tool.category === 'voice'))
  assert.ok(transcription.some((tool) => tool.slug === 'otter'))
  assert.equal(names('research search citations papers')[0], 'SciSpace')
  assert.equal(names('research search citations papers')[1], 'Perplexity')
  assert.equal(names('summarize research papers')[0], 'SciSpace')
  assert.equal(names('write marketing copy')[0], 'Jasper')
})

test('write a React app still surfaces app builders and does not match every tool', () => {
  const results = rankTools(tools, 'write a React app')
  assert.ok(results.length < tools.length)
  const top = results.slice(0, 10)
  assert.ok(top.some((tool) => tool.slug === 'v0' || tool.slug === 'lovable' || tool.slug === 'bolt'))
  assert.ok(top.some((tool) => tool.category === 'coding'))
})

test('edit a youtube video stays in video and does not match every tool', () => {
  const results = rankTools(tools, 'edit a youtube video')
  assert.equal(results[0].category, 'video')
  assert.ok(results.length < tools.length)
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
