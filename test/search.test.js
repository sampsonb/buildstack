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
  return tokens.some((token) => token === word || token === `${word}s` || `${token}s` === word)
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

test('blog post and React app lead with the expected top 3', () => {
  assert.deepEqual(lead('blog post').map((tool) => tool.slug), ['claude', 'grammarly', 'chatgpt'])
  assert.deepEqual(lead('React app').map((tool) => tool.slug), ['v0', 'lovable', 'bolt'])
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
  assert.equal(rankTools(tools, 'coding')[0].category, 'coding')
  assert.ok(lead('coding').every((tool) => tool.category === 'coding' || mentions(tool, 'code') || mentions(tool, 'coding')))
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

test('a short word does not steal the category from the job', () => {
  assert.ok(lead('ai writing tool').every((tool) => tool.category === 'writing'))
  assert.ok(lead('best ai for coding').every((tool) => tool.category === 'coding'))
  assert.ok(lead('ai image generator').every((tool) => tool.category === 'images'))
  assert.deepEqual(names('news'), [])
  assert.equal(rankTools(tools, 'debug python')[0].category, 'coding')
})

test('edit a youtube video leads with video tools', () => {
  const top = lead('edit a youtube video')
  assert.ok(top.every((tool) => tool.category === 'video'), top.map((tool) => tool.name).join(', '))
  assert.ok(rankTools(tools, 'edit a youtube video').length < tools.length)
})

test('homepage best-fit order follows rankTools', async () => {
  const app = (await import('../src/index.js')).default
  const html = await (await app.request('http://local/?q=write%20a%20blog%20post')).text()
  assert.deepEqual(bestFitSlugs(html), rankTools(tools, 'write a blog post').map((tool) => tool.slug))
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

// Every tool slug in the search results section, including results behind "Show all N".
function bestFitSlugs(html) {
  const start = html.indexOf('Best fit for')
  assert.ok(start >= 0)
  const end = html.indexOf('</section>', start)
  return [...html.slice(start, end).matchAll(/href="\/tool\/([^"]+)"/g)].map((match) => match[1])
}

function catLabel(tool) {
  return { coding: 'Coding', writing: 'Writing', images: 'Images', video: 'Video', agents: 'Agents', research: 'Research', voice: 'Voice' }[tool.category]
}

function catRankOf(tool) {
  return byRank.filter((item) => item.category === tool.category).findIndex((item) => item.slug === tool.slug) + 1
}

function visible(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cardChunk(html, slug) {
  const needle = `href="/tool/${slug}"`
  let from = 0
  while (true) {
    const hit = html.indexOf(needle, from)
    assert.ok(hit >= 0, slug)
    const open = html.lastIndexOf('<article class="card">', hit)
    const close = html.indexOf('</article>', hit)
    if (open >= 0 && close > open && open < hit && hit < close) {
      return visible(html.slice(open, close + 10))
    }
    from = hit + 1
  }
}

function assertDecisionBlock(html, slug) {
  const card = cardChunk(html, slug)
  const tool = tools.find((item) => item.slug === slug)
  assert.match(card, />Best for<\/dt>/)
  assert.match(card, />Price<\/dt>/)
  assert.match(card, />Strength<\/dt>/)
  assert.match(card, />Watch-out<\/dt>/)
  assert.equal(card.includes(tool.strength), true, slug)
  assert.equal(card.includes(tool.watchOut), true, slug)
  assert.match(card, /Free tier: (yes|no)/)
  assert.equal(card.includes(`#${catRankOf(tool)} in ${catLabel(tool)}`), true, slug)
}

test('search, category, and guide cards show a decision block and ranking is unchanged', async () => {
  const blog = 'blog post'
  const writeBlog = 'write a blog post'
  const stripped = tools.map((tool) => {
    const { strength, watchOut, freeTier, priceFrom, affiliate, ...rest } = tool
    return rest
  })
  assert.deepEqual(
    rankTools(tools, blog).map((tool) => tool.slug),
    rankTools(stripped, blog).map((tool) => tool.slug),
  )
  assert.deepEqual(
    rankTools(tools, writeBlog).map((tool) => tool.slug),
    rankTools(stripped, writeBlog).map((tool) => tool.slug),
  )
  assert.deepEqual(
    rankTools(tools, '').map((tool) => tool.slug),
    byRank.map((tool) => tool.slug),
  )
  const source = readFileSync(new URL('../src/search.js', import.meta.url), 'utf8')
  assert.equal(source.includes('strength'), false)
  assert.equal(source.includes('watchOut'), false)
  assert.equal(source.includes('freeTier'), false)
  assert.equal(source.includes('priceFrom'), false)
  assert.equal(source.includes('affiliate'), false)

  const app = (await import('../src/index.js')).default
  const searchHtml = await (await app.request('http://local/?q=blog%20post')).text()
  const searchSlugs = bestFitSlugs(searchHtml)
  assert.deepEqual(searchSlugs, rankTools(tools, blog).map((tool) => tool.slug))
  for (const slug of searchSlugs.slice(0, 8)) assertDecisionBlock(searchHtml, slug)

  const catHtml = await (await app.request('http://local/category/writing')).text()
  const writing = tools.filter((tool) => tool.category === 'writing').sort((a, b) => a.rank - b.rank)
  const catSlugs = [...catHtml.matchAll(/<article class="card">[\s\S]*?href="\/tool\/([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(catSlugs, writing.map((tool) => tool.slug))
  for (const tool of writing) assertDecisionBlock(catHtml, tool.slug)

  const bestHtml = await (await app.request('http://local/best/ai-writing-tool')).text()
  assert.equal(bestHtml.includes('Compare at a glance'), true)
  assert.equal(bestHtml.includes('>Best for</dt>'), true)
  const glance = bestHtml.match(/Compare at a glance[\s\S]*?<div class="grid">([\s\S]*?)<\/div>\s*<\/section>/)
  assert.ok(glance)
  const glanceSlugs = [...glance[1].matchAll(/href="\/tool\/([^"]+)"/g)].map((match) => match[1])
  assert.ok(glanceSlugs.length > 0)
  for (const slug of glanceSlugs) assertDecisionBlock(bestHtml, slug)

  for (const tool of tools) {
    assert.equal(typeof tool.strength, 'string')
    assert.ok(tool.strength.length > 0, tool.slug)
    assert.equal(typeof tool.watchOut, 'string')
    assert.ok(tool.watchOut.length > 0, tool.slug)
    assert.equal(typeof tool.freeTier, 'boolean', tool.slug)
    assert.equal(typeof tool.priceFrom, 'string', tool.slug)
    assert.ok(tool.priceFrom.length > 0, tool.slug)
  }
})
