// Search regression set from the Nov 21, 2026 search review (10 queries), plus the
// 5 searches the Duet audit already rated good. Each case lists:
//   expect: tools that should fill the top 3 (any order, unless first is set)
//   alt:    acceptable alternates that may take a top-3 slot
//   fill:   how many top slots must come from expect + alt (3 unless the catalog or an
//           older test leaves fewer eligible tools)
//   not6:   tools that must stay out of the top 6
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rankTools, topShown } from '../src/search.js'

const tools = JSON.parse(readFileSync(new URL('../src/tools.json', import.meta.url), 'utf8'))
const known = new Set(tools.map((t) => t.slug))
// The numbered results people see: R1 keeps weak matches and held-back models under Show all.
const top = (q, n) => topShown(rankTools(tools, q), n).map((t) => t.slug)

// Every regression case should now pass. Left in place so a later release can mark a new skip.
const PENDING = {
}

export const CASES = [
  { q: 'ai for writing blog posts', expect: ['claude', 'chatgpt', 'grammarly'], alt: ['quillbot', 'jasper', 'notion-ai', 'writesonic', 'jenni', 'copy-ai'], notFirst: ['meta-ai', 'microsoft-copilot'] },
  { q: 'ai browser', expect: ['perplexity-comet', 'dia', 'opera-neon'], alt: ['genspark', 'nod', 'lumo-desktop'], first: 'perplexity-comet', not6: ['chatgpt-work', 'topaz-labs', 'reso-ai'] },
  { q: 'cheapest coding assistant', expect: ['github-copilot', 'google-antigravity'], alt: ['cline', 'opencode', 'cursor'], not6: ['opencode-browse', 'easy-lens-cli', 'harness-autonomous'] },
  // The Nov 20 test keeps Phonic-1 (a voice agent model) out of the top 3, so only 2 slots are fixed.
  { q: 'phone calls', expect: ['retell-ai', 'bland-ai', 'call-e'], alt: ['vapi', 'phonic-1'], not6: ['nod', 'liquid-lfm3', 'alpie-seed', 'harness-autonomous', 'granola'] },
  { q: 'make a presentation', expect: ['gamma', 'canva', 'chatgpt-work'], alt: ['adobe-express', 'microsoft-copilot'], first: 'gamma', not6: ['make', 'synthesia'] },
  { q: 'summarize a pdf', expect: ['acrobat-ai-assistant', 'chatpdf', 'chatgpt'], alt: ['notebooklm', 'gemini', 'claude'], not3: ['scholarcy', 'scispace'] },
  { q: 'remove background from a photo', expect: ['photoroom', 'canva'], alt: ['chatgpt-images', 'adobe-firefly', 'mai-image-2-7'], not6: ['seedream-5-5', 'claude-duet'] },
  { q: 'build a website without code', expect: ['lovable', 'bolt', 'v0'], alt: ['wix-studio-two', 'gamma'], not6: ['opencode-browse', 'inkling-2-small', 'alpie-seed', 'problembot'] },
  { q: 'translate a document', expect: ['deepl-translator', 'google-translate'], alt: ['claude', 'chatgpt'], first: 'deepl-translator', not6: ['gamma', 'heygen', 'synthesia'] },
  { q: 'customer support chatbot for my website', expect: ['chatbase', 'tidio', 'intercom-fin'], alt: ['zendesk-ai', 'voiceflow'], first: 'chatbase', not6: ['nod', 'firecrawl', 'perplexity-comet', 'joveo-tandem', 'phonic-1', 'deepl-voice'] },
]

export function check(c) {
  const fill = c.fill ?? 3
  const ok = new Set([...c.expect, ...c.alt])
  const t3 = top(c.q, 3)
  const t6 = top(c.q, 6)
  const msg = `${c.q}: top 6 = ${t6.join(', ')}`
  for (const s of [...c.expect, ...c.alt, ...(c.not6 || []), ...(c.not3 || []), ...(c.notFirst || [])]) assert.ok(known.has(s), `unknown slug ${s}`)
  assert.ok(t3.slice(0, fill).every((s) => ok.has(s)), `top ${fill} must come from expected or alternates. ${msg}`)
  const missing = c.expect.filter((s) => !t3.includes(s))
  const alts = t3.filter((s) => c.alt.includes(s))
  assert.ok(missing.length <= alts.length, `missing expected ${missing.join(', ')}. ${msg}`)
  if (c.first) assert.equal(t3[0], c.first, msg)
  for (const s of c.notFirst || []) assert.notEqual(t3[0], s, msg)
  for (const s of c.not3 || []) assert.ok(!t3.includes(s), `${s} in top 3. ${msg}`)
  for (const s of c.not6 || []) assert.ok(!t6.includes(s), `${s} in top 6. ${msg}`)
}

for (const c of CASES) {
  const pending = PENDING[c.q]
  test(`regression: ${c.q}`, pending ? { todo: pending } : {}, () => check(c))
}

test('regression: cheapest coding assistant puts verified free plans with included AI first', () => {
  const t6 = top('cheapest coding assistant', 6)
  const bySlug = (s) => tools.find((x) => x.slug === s)
  assert.ok(t6.includes('github-copilot') && t6.includes('google-antigravity'), t6.join(', '))
  for (const s of t6.slice(0, 3)) assert.ok(bySlug(s).freePlan === true && bySlug(s).byoModel === false, s)
  for (const s of ['opencode-browse', 'easy-lens-cli', 'harness-autonomous']) assert.ok(!t6.includes(s), `${s} in top 6`)
})

test('regression: the 5 searches the Duet audit rated good stay good', () => {
  const tm = rankTools(tools, 'transcribe meetings').slice(0, 3)
  assert.ok(tm.every((t) => ['otter', 'fireflies', 'granola', 'fathom', 'tldv', 'notta', 'krisp'].includes(t.slug)), tm.map((t) => t.slug).join(','))
  const pod = top('edit a podcast', 3)
  assert.ok(pod.includes('descript') && pod.includes('riverside'), pod.join(','))
  const vid = rankTools(tools, 'make a video from text')
  assert.ok(vid.slice(0, 3).every((t) => t.category === 'video') && vid.slice(0, 3).some((t) => t.slug === 'runway'), vid.slice(0, 3).map((t) => t.slug).join(','))
  assert.ok(!vid.some((t) => t.slug === 'sora'))
  const em = rankTools(tools, 'write emails').slice(0, 3)
  assert.ok(em.every((t) => t.category === 'writing') && !em.some((t) => t.slug === 'kudonovel'), em.map((t) => t.slug).join(','))
  const logo = top('make a logo', 3)
  assert.ok(logo.includes('ideogram') || logo.includes('recraft'), logo.join(','))
  assert.ok(!logo.includes('make'), logo.join(','))
})

test('regression: the data fixes keep incidental words out of listings', () => {
  const t = (s) => tools.find((x) => x.slug === s)
  assert.ok(!/phone/i.test(t('nod').description) && /cannot make phone calls/.test(t('nod').watchOut))
  assert.ok(!/atlas/i.test(t('chatgpt-work').description) && /Atlas/.test(t('chatgpt-work').watchOut))
  assert.ok(!/background/i.test(t('claude-duet').tagline + t('claude-duet').strength))
  assert.ok(!/phone/i.test(t('liquid-lfm3').bestFor.join(' ')))
  assert.ok(!/phone/i.test(t('alpie-seed').bestFor.join(' ')))
  assert.ok(!/phone/i.test(t('harness-autonomous').bestFor.join(' ')))
})
