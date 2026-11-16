import assert from 'node:assert/strict'
import { test } from 'node:test'

const GUIDES = ['/alternatives/cursor', '/best/ai-coding-agent-for-beginners', '/best/ai-research-assistant', '/best/free-ai-tools', '/best/ai-voice-generator', '/best/ai-coding-assistant', '/best/ai-agent-builder', '/best/ai-tools-for-small-business', '/best/ai-transcription-tool', '/best/ai-writing-tool', '/best/ai-image-generator', '/best/ai-video-editor-for-youtube', '/best/ai-video-generator']

async function get(path) {
  const app = (await import('../src/index.js')).default
  const res = await app.request(`http://local${path}`)
  return { status: res.status, html: await res.text() }
}

function ld(html) {
  return JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
}

test('every guide and the methodology page name the editor in copy and schema', async () => {
  for (const path of [...GUIDES, '/methodology']) {
    const { status, html } = await get(path)
    assert.equal(status, 200, path)
    assert.match(html, /Edited by <a href="\/about">Sampson Brueher<\/a>/, path)
    const page = ld(html)['@graph'][0]
    assert.equal(page.author['@type'], 'Person', path)
    assert.equal(page.author.name, 'Sampson Brueher', path)
    assert.equal(page.author['@id'], 'https://buildstack.tier11.com/about#sampson', path)
  }
})

test('new tools from 2026-11-15 are listed', async () => {
  for (const slug of ['llama-cpp', 'sciground']) {
    const { status, html } = await get(`/tool/${slug}`)
    assert.equal(status, 200, slug)
    // v2 tool pages: an en dash appears only as the empty-cell marker in the alternatives table
    assert.equal(/[\u2013\u2014]/.test(html.replace(/<span aria-hidden="true">\u2013<\/span>/g, '')), false, slug)
  }
})
