import { Hono } from 'hono'
import toolsData from './tools.json' with { type: 'json' }
import { rankTools } from './search.js'

const app = new Hono()
const SITE = 'https://buildstack.tier11.com'
const NAME = 'BuildStack'
const UPDATED = '2026-11-13'

const CATEGORIES = {
  coding: { label: 'Coding', blurb: 'Editors, agents, and coding assistants' },
  writing: { label: 'Writing', blurb: 'Drafting, editing, and content AI' },
  images: { label: 'Images', blurb: 'Image generation and design AI' },
  video: { label: 'Video', blurb: 'Video generation and editing AI' },
  agents: { label: 'Agents', blurb: 'Autonomous and workflow agents' },
  research: { label: 'Research', blurb: 'Search, papers, and source-grounded AI' },
  voice: { label: 'Voice', blurb: 'Speech, music, and voice AI' },
}

// Task pills link to the matching /best guide instead of a stuffed search query.
const BEST_FOR = [
  { slug: 'write-code', title: 'Write and refactor code', href: '/best/ai-coding-assistant' },
  { slug: 'research-web', title: 'Research with citations', href: '/best/ai-research-assistant' },
  { slug: 'generate-images', title: 'Generate images', href: '/best/ai-image-generator' },
  { slug: 'make-video', title: 'Make short videos', href: '/best/ai-video-generator' },
  { slug: 'voiceover', title: 'Create voiceovers', href: '/best/ai-voice-generator' },
  { slug: 'automate-work', title: 'Automate workflows', href: '/best/ai-agent-builder' },
  { slug: 'write-marketing', title: 'Write marketing copy', href: '/best/ai-writing-tool' },
  { slug: 'build-mvp', title: 'Build an MVP app', href: '/best/ai-coding-agent-for-beginners' },
]

// Dates shown to people read like "Nov 13, 2026". Schema, sitemap, and JSON keep ISO dates.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return String(iso || '')
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

// New tag: a tool added to the directory in the last NEW_DAYS days, from its `added` date
// (the first day it appeared in tools.json). The site launched 2026-10-15 with its first
// catalog, so a 30-day window would still tag nearly every tool; 14 days keeps the tag meaningful.
const NEW_DAYS = 14
function todayIso() { return new Date().toISOString().slice(0, 10) }
function isNew(t, today = todayIso()) {
  if (!t || !t.added) return false
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - NEW_DAYS)
  return t.added > d.toISOString().slice(0, 10) && t.added <= today
}
function newTools(today) {
  return tools().filter((t) => isNew(t, today)).sort((a, b) => (b.added > a.added ? 1 : b.added < a.added ? -1 : a.rank - b.rank))
}

// Rank inside the tool's category (1 = top of that category), used on list cards and search
// results. The overall rank only shows on the tool page itself.
let CAT_RANK
function catRank(t) {
  if (!CAT_RANK) {
    CAT_RANK = new Map()
    const seen = {}
    for (const x of tools()) { seen[x.category] = (seen[x.category] || 0) + 1; CAT_RANK.set(x.slug, seen[x.category]) }
  }
  return CAT_RANK.get(t.slug) || 0
}
function catChip(t) {
  return `#${catRank(t)} in ${CATEGORIES[t.category]?.label || t.category}`
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: SITE + path,
    })),
  }
}

function listNames(names) {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

// Per-category meta description: tool count plus the top ranked names, so each
// category page gets a unique, specific snippet instead of a shared template.
function categoryDescription(cat, list) {
  const top = list.slice(0, 3).map((t) => t.name)
  const more = list.length > top.length ? `, plus ${list.length - top.length} more` : ''
  const picks = top.length ? `: ${listNames(top)}${more}` : ''
  return `${list.length} ${cat.label} AI tools ranked on ${NAME}${picks}. ${cat.blurb}. Updated ${fmtDate(maxDate(list.map((t) => t.updated)) || UPDATED)}.`
}

// Tool page meta description: search engines cut snippets at about 155
// characters, and full tool descriptions run 300 to 700. Lead with rank and
// category, then the description, trimmed at a word boundary so the snippet
// never ends mid-word.
function toolMetaDescription(t) {
  const label = CATEGORIES[t.category]?.label || t.category
  const full = `#${catRank(t)} in ${label} on ${NAME}. ${t.description}`
  if (full.length <= 155) return full
  const cut = full.slice(0, 152)
  const space = cut.lastIndexOf(' ')
  return `${(space > 100 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}...`
}

// Tool page FAQ. Plain text answers built only from tools.json fields, used
// for both the visible FAQ and the FAQPage schema so the two never drift.
function toolFaq(t) {
  const label = CATEGORIES[t.category]?.label || t.category
  const inCat = tools().filter((x) => x.category === t.category)
  const catRank = inCat.findIndex((x) => x.slug === t.slug) + 1
  const alts = inCat.filter((x) => x.slug !== t.slug).slice(0, 3)
  const best = (t.bestFor || []).slice(0, 3)
  // No "What is X?" entry: its answer was the Overview paragraph repeated word for word.
  const faq = []
  if (best.length) faq.push({ q: `What is ${t.name} best for?`, a: `${NAME} lists ${t.name} as best for ${listNames(best)}. It ranks #${t.rank} overall and #${catRank} of ${inCat.length} in ${label}.` })
  if (t.pricingNote) faq.push({ q: `How much does ${t.name} cost?`, a: `${t.pricingNote.replace(/[\s.]+$/, '')}. Prices change often, so confirm the current plans on the official site before you buy.` })
  if (alts.length) faq.push({ q: `What are the best alternatives to ${t.name}?`, a: `The top ranked ${label} tools on ${NAME} besides ${t.name} are ${listNames(alts.map((x) => `${x.name} (#${x.rank})`))}. See the full ${label} category for every option in rank order.` })
  return { faq, alts, label }
}

// Homepage quick answers: the top ranked tools for each job, read from
// tools.json so the visible block, the FAQ, and the schema always match the
// live ranks. Picks are the first three tools of each category in rank order.
const QUICK_JOBS = [
  { cat: 'writing', job: 'Writing and everyday questions' },
  { cat: 'coding', job: 'Coding' },
  { cat: 'research', job: 'Research and search' },
  { cat: 'images', job: 'Images' },
  { cat: 'video', job: 'Video' },
  { cat: 'voice', job: 'Voice and audio' },
  { cat: 'agents', job: 'Automation and agents' },
]

function quickAnswers() {
  const all = tools()
  return QUICK_JOBS
    .map((j) => ({ ...j, label: CATEGORIES[j.cat].label, picks: all.filter((t) => t.category === j.cat).slice(0, 3) }))
    .filter((j) => j.picks.length)
}

// Plain-text top 3 for one job, used in llms.txt and llms-full.txt.
function quickLine(j) {
  return `${j.picks.map((t, i) => `${i + 1}. ${t.name}`).join(', ')} (top ${j.picks.length} in ${j.label})`
}

// Homepage FAQ. Plain text answers, used for both the visible FAQ and the
// FAQPage schema so the two never drift. Answers follow /methodology.
function homeFaq() {
  const all = tools()
  const qa = quickAnswers()
  const tops = qa.map((j) => j.picks[0])
  const distinct = new Set(tops.map((t) => t.slug)).size === tops.length
  const nCat = Object.keys(CATEGORIES).length
  const first = all[0]
  const cline = all.find((t) => t.slug === 'cline')
  const zed = all.find((t) => t.slug === 'zed')
  const examples = []
  if (cline) examples.push(`The ${cline.name} extension (#${cline.rank}) is free for individual developers, and you pay only for AI inference.`)
  if (zed) examples.push(`${zed.name} (#${zed.rank}) has a $0 Personal plan for use with your own API keys, plus a paid Pro plan.`)
  return [
    {
      q: 'Which AI tool should I use?',
      a: `It depends on the job. The top ranked tool on BuildStack overall is ${first.name} (#1, ${CATEGORIES[first.category]?.label || first.category}). The top pick for each job: ${qa.map((j) => `${j.job.toLowerCase()}, ${j.picks[0].name} (#${j.picks[0].rank})`).join('; ')}. Type your task in the search box to see the best-fit tools for it.`,
    },
    {
      q: 'What is the best AI tool finder?',
      a: `Look for a finder that takes your task in plain words, ranks real tools, and links to their official sites. BuildStack works that way. It is free, needs no sign-up, and scores all ${all.length} listed tools against your words. Matches in a tool's name count most, then its best-for tags, then its category, and ties go to the higher ranked tool.`,
    },
    {
      q: 'Is there one AI tool that does everything?',
      a: `Not on BuildStack. Every tool sits in exactly one of ${nCat} categories, and ${distinct ? 'each category has a different top pick' : 'the top pick changes by category'}: ${listNames(qa.map((j) => `${j.picks[0].name} for ${j.label.toLowerCase()}`))}. Pick the tool that ranks best for the job in front of you.`,
    },
    {
      q: 'How do I pick an AI tool for my specific task?',
      a: 'Type the task in a few words, for example "voiceover for a podcast" or "write a React app". BuildStack lists the tools that match, best fit first. Open a tool page to read its best-for tags and pricing note, then confirm current prices on the official site.',
    },
    {
      q: 'Are the AI tools on BuildStack free?',
      a: `BuildStack itself is free to use. Pricing for the listed tools varies: some are free and open source, and others charge a subscription or by usage. ${examples.length ? `${examples.join(' ')} ` : ''}Each tool page has a short pricing note. Always check the official site for current prices.`,
    },
    {
      q: 'How often is the BuildStack ranking updated?',
      a: `BuildStack adds new tools and adjusts ranks as tools launch and change. The list was last updated on ${fmtDate(UPDATED)} and has ${all.length} tools. The same date is published in /tools.json, and each tool page shows when its own listing last changed.`,
    },
  ]
}

function tools() {
  return [...toolsData].sort((a, b) => a.rank - b.rank)
}

function bySlug(slug) {
  return tools().find((t) => t.slug === slug)
}

// Honest per-page dates (added 2026-11-13). Each tool carries `updated`: the last day its facts
// (name, link, category, tagline, description, best-for tags, or pricing note) changed. Rank
// renumbering when other tools are added does not count. A guide's date is the later of its own last
// editorial change (SECTION_DATES, from the git history of that guide's code) and the newest
// `updated` among the tools it shows. Bump a guide's SECTION_DATES entry when you edit its copy.
const SECTION_DATES = {
  '/methodology': '2026-11-13',
  '/alternatives/cursor': '2026-10-30',
  '/best/ai-coding-agent-for-beginners': '2026-11-13',
  '/best/ai-research-assistant': '2026-11-13',
  '/best/free-ai-tools': '2026-11-13',
  '/best/ai-voice-generator': '2026-11-13',
  '/best/ai-coding-assistant': '2026-11-13',
  '/best/ai-agent-builder': '2026-11-13',
  '/best/ai-tools-for-small-business': '2026-11-13',
  '/best/ai-transcription-tool': '2026-11-13',
  '/best/ai-writing-tool': '2026-11-13',
  '/best/ai-image-generator': '2026-11-13',
  '/best/ai-video-editor-for-youtube': '2026-11-13',
  '/best/ai-video-generator': '2026-11-13',
  '/guides/how-celebrity-deepfakes-are-made': '2026-11-13',
  '/get-featured': '2026-11-13',
}

function maxDate(dates) {
  return dates.filter(Boolean).reduce((a, b) => (b > a ? b : a), '')
}

// Collect the tool objects a guide's data function returns (skipping the full list and finder).
function toolsIn(d) {
  const out = new Map()
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (typeof v.slug === 'string' && typeof v.updated === 'string' && v.category) { out.set(v.slug, v); return }
    for (const [k, x] of Object.entries(v)) if (k !== 'all' && k !== 'find') walk(x)
  }
  walk(d)
  return [...out.values()]
}

function guideData() {
  return {
    '/alternatives/cursor': cursorAltData,
    [BEGINNER_PATH]: beginnerData,
    [RESEARCH_PATH]: researchData,
    [FREE_PATH]: freeData,
    [VOICE_PATH]: voiceData,
    [CODING_PATH]: codingData,
    [AGENT_PATH]: agentData,
    [SMB_PATH]: smbData,
    [TRANS_PATH]: transData,
    [WRITE_PATH]: writeData,
    [IMAGE_PATH]: imageData,
    [VIDEO_PATH]: videoData,
    [VIDEOGEN_PATH]: videogenData,
  }
}

function pageDate(path) {
  const all = tools()
  if (path.startsWith('/tool/')) { const t = bySlug(path.slice(6)); return (t && t.updated) || UPDATED }
  if (path.startsWith('/category/')) return maxDate(all.filter((t) => t.category === path.slice(10)).map((t) => t.updated)) || UPDATED
  if (['', '/', '/categories', '/about', '/tools.json', '/llms.txt', '/llms-full.txt'].includes(path)) return maxDate(all.map((t) => t.updated)) || UPDATED
  const fn = guideData()[path]
  return maxDate([SECTION_DATES[path], ...(fn ? toolsIn(fn()).map((t) => t.updated) : [])]) || UPDATED
}

function searchTools(q) {
  return rankTools(tools(), q)
}

// Search results: top SEARCH_TOP numbered cards, the rest behind a no-JS <details> toggle.
const SEARCH_TOP = 6
function searchResultsHtml(results) {
  if (!results.length) return '<p class="muted">No matches. Try a broader phrase.</p>'
  const top = results.slice(0, SEARCH_TOP)
  const rest = results.slice(SEARCH_TOP)
  return `<div class="grid">${top.map((t, i) => toolCardAt(t, i + 1)).join('')}</div>${rest.length ? `
    <details class="more"><summary>Show all ${results.length} results</summary><div class="grid">${rest.map((t, i) => toolCardAt(t, SEARCH_TOP + i + 1)).join('')}</div></details>` : ''}`
}

function layout({ title, description, path, body, jsonLd, robots, shareImage }) {
  const url = SITE + path
  const share = shareImage || {
    url: `${SITE}/og.png`,
    type: 'image/png',
    width: 1200,
    height: 630,
    alt: 'BuildStack. Ranked AI tools. Search by use case.',
  }
  const ld = jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: NAME,
    url: SITE,
    description: 'Ranked AI tool directory. Find the right AI tool for your use case.',
    potentialAction: {
      '@type': 'SearchAction',
      target: SITE + '/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
${robots ? `<meta name="robots" content="${esc(robots)}"/>
` : ''}<link rel="canonical" href="${esc(url)}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${NAME}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${esc(url)}"/>
<meta property="og:image" content="${esc(share.url)}"/>
<meta property="og:image:type" content="${esc(share.type)}"/>
<meta property="og:image:width" content="${share.width}"/>
<meta property="og:image:height" content="${share.height}"/>
<meta property="og:image:alt" content="${esc(share.alt)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(share.url)}"/>
<meta name="twitter:image:alt" content="${esc(share.alt)}"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32"/>
<link rel="alternate" type="application/json" href="/tools.json"/>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
:root {
  --bg: #0b0f14;
  --panel: #121821;
  --panel2: #182131;
  --text: #e8eef7;
  --muted: #9aa8bc;
  --line: #243044;
  --accent: #ff7a1a;
  --accent2: #ffb347;
  --ok: #3dd68c;
  --radius: 14px;
  --shadow: 0 10px 40px rgba(0,0,0,.35);
  --font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--font); }
a { color: var(--accent2); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { width: min(1100px, calc(100% - 2rem)); margin: 0 auto; }
.nav { display: flex; gap: 1rem; align-items: center; justify-content: space-between; padding: 1.1rem 0; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(11,15,20,.92); backdrop-filter: blur(10px); z-index: 20; }
.brand { font-weight: 800; letter-spacing: -.02em; font-size: 1.15rem; color: var(--text); }
.brand span { color: var(--accent); }
.navlinks { display: flex; gap: .9rem; flex-wrap: wrap; font-size: .92rem; }
.navlinks a { color: var(--muted); }
.navlinks a:hover { color: var(--text); }
.hero { padding: 2.4rem 0 1.4rem; }
.hero h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); line-height: 1.1; margin: 0 0 .75rem; letter-spacing: -.03em; }
.hero p { color: var(--muted); font-size: 1.05rem; max-width: 46rem; margin: 0 0 1.25rem; }
.searchbox { display: flex; gap: .6rem; background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: .35rem .35rem .35rem 1rem; box-shadow: var(--shadow); }
.searchbox input { flex: 1; background: transparent; border: 0; outline: 0; color: var(--text); font-size: 1rem; min-width: 0; }
.searchbox button { background: linear-gradient(135deg, var(--accent), #ff9a3c); color: #1a0f05; border: 0; border-radius: 999px; padding: .7rem 1.1rem; font-weight: 700; cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem 1.05rem; transition: border-color .15s, transform .15s; }
.card:hover { border-color: #3a4d6a; transform: translateY(-1px); }
.card h3 { margin: 0 0 .35rem; font-size: 1.05rem; }
.card h3 a { color: var(--text); }
.meta { color: var(--muted); font-size: .82rem; margin-bottom: .55rem; }
.tag { display: inline-block; background: var(--panel2); border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: .15rem .55rem; font-size: .75rem; margin-right: .3rem; }
.tag.new { color: var(--ok); border-color: #245c42; }
.tag.feat { color: var(--accent2); border-color: #6a4520; }
.section { padding: 1.6rem 0 0; }
.section h2 { margin: 0 0 .9rem; font-size: 1.25rem; letter-spacing: -.02em; }
.pills { display: flex; flex-wrap: wrap; gap: .55rem; }
.pill { background: var(--panel2); border: 1px solid var(--line); color: var(--text); border-radius: 999px; padding: .55rem .9rem; font-size: .9rem; }
.pill:hover { border-color: var(--accent); text-decoration: none; }
.footer { margin-top: 3rem; padding: 1.5rem 0 2.5rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .88rem; }
.btn { display: inline-block; background: linear-gradient(135deg, var(--accent), #ff9a3c); color: #1a0f05 !important; font-weight: 750; border-radius: 999px; padding: .75rem 1.2rem; text-decoration: none !important; }
.btn.secondary { background: transparent; color: var(--text) !important; border: 1px solid var(--line); }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; }
.cmp { width: 100%; border-collapse: collapse; font-size: .9rem; }
.cmp th, .cmp td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.cmp th { color: var(--muted); font-weight: 600; }
.muted { color: var(--muted); }
.formrow { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: .8rem; }
.formrow input { flex: 1; min-width: 220px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--text); padding: .7rem .85rem; }
.formrow button { background: var(--accent); color: #1a0f05; border: 0; border-radius: 10px; padding: .7rem 1rem; font-weight: 700; cursor: pointer; }
.notice { margin-top: .7rem; font-size: .9rem; }
.rank { color: var(--accent); font-weight: 800; margin-right: .35rem; }
.pos { display: inline-flex; align-items: center; justify-content: center; min-width: 1.6rem; height: 1.6rem; border-radius: 999px; background: var(--accent); color: #1a0f05; font-weight: 800; font-size: .8rem; margin-right: .45rem; padding: 0 .35rem; }
.tag.cat { color: var(--text); }
ol.top3 { margin: 0 0 .5rem; padding-left: 1.3rem; font-size: .95rem; line-height: 1.6; }
details.more { margin-top: 1rem; }
details.more > summary { cursor: pointer; color: var(--accent2); font-weight: 650; margin-bottom: 1rem; }
.footrow { display: flex; flex-wrap: wrap; gap: .35rem .9rem; }
.footrow a { color: var(--muted); }
.footrow a:hover { color: var(--text); }
.decide { margin: .7rem 0 0; display: grid; gap: .32rem; font-size: .8rem; line-height: 1.4; }
.decide div { display: grid; grid-template-columns: 5.6rem minmax(0, 1fr); gap: .35rem; align-items: start; }
.decide dt { margin: 0; color: var(--muted); font-weight: 650; }
.decide dd { margin: 0; color: var(--text); }
@media (max-width: 420px) {
  .decide { font-size: .78rem; }
  .decide div { grid-template-columns: 5.3rem minmax(0, 1fr); gap: .3rem; }
}
.prose { line-height: 1.6; color: var(--muted); }
.prose strong { color: var(--text); }
.hero-art { margin: 1rem 0 0; }
.hero-art img { width: 100%; height: auto; border-radius: var(--radius); display: block; background: var(--panel); }
.hero-art figcaption { margin: .45rem 0 0; color: var(--muted); font-size: .82rem; }
ul.clean { padding-left: 1.1rem; }
.hero-art.capped img { height: 300px; max-height: 300px; object-fit: cover; }
.about-head { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.about-head img { width: 160px; height: 160px; border-radius: 50%; object-fit: cover; display: block; background: var(--panel); border: 1px solid var(--line); }
.about-head .who { flex: 1; min-width: 260px; }
.byline-note { color: var(--text); font-size: .95rem; margin: .2rem 0 0; }
.article { max-width: 68ch; font-size: 17px; line-height: 1.65; color: #b9c5d6; }
.article h2 { color: var(--text); margin-top: 1.8rem; }
.article strong { color: var(--text); }
.checks { background: var(--panel2); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem 1.2rem; margin: 1.2rem 0; }
.checks h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
.checks ol { margin: 0; padding-left: 1.3rem; }
.checks li { margin: .3rem 0; }
.strip { margin: 1.2rem 0; }
.strip h3 { color: var(--text); font-size: 1.05rem; margin: 0 0 .6rem; }
.strip .note { font-size: .85rem; margin: .55rem 0 0; color: var(--muted); }
details.sources > summary { cursor: pointer; font-size: 1.25rem; font-weight: 700; color: var(--text); margin-bottom: .9rem; }
</style>
</head>
<body>
<div class="wrap">
  <nav class="nav">
    <a class="brand" href="/">Build<span>Stack</span></a>
    <div class="navlinks">
      <a href="/#best-for">Best for</a>
      <a href="/categories">Categories</a>
      <a href="/#new">New</a>
      <a href="/methodology">How we rank</a>
      <a href="/about">About</a>
    </div>
  </nav>
  ${body}
  <footer class="footer">
    <nav class="footrow" aria-label="Footer"><a href="/about">About</a><a href="/methodology">How we rank</a><a href="/#guides">Guides</a><a href="/get-featured">List your tool</a><a href="/about#chatbots">For chatbots</a><a href="https://itsbuildstack.substack.com">Substack</a><a href="mailto:buildstack@tier11.com">Contact</a><a href="https://tier11.com">tier11</a><a href="/sitemap.xml">Sitemap</a></nav>
  </footer>
</div>
<script>
async function subscribe(e){
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const notice = form.querySelector('.notice');
  notice.textContent = 'Saving...';
  try {
    const res = await fetch('/api/subscribe', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ email, source: form.dataset.source || 'website' })
    });
    const data = await res.json();
    notice.textContent = data.ok ? 'You are on the list. No spam, ever.' : (data.error || 'Could not save.');
    if (data.ok) form.reset();
  } catch (err) {
    notice.textContent = 'Network error. Try again.';
  }
}
</script>
</body>
</html>`
}

function bestForLine(t) {
  const items = Array.isArray(t.bestFor) ? t.bestFor.filter(Boolean) : []
  return items.length ? items.join(', ') : 'See listing'
}

function priceLine(t) {
  const from = String(t.priceFrom || '').trim() || 'See pricing'
  const free = t.freeTier === true ? 'yes' : 'no'
  return `${from} · Free tier: ${free}`
}

function decisionBlock(t) {
  return `<dl class="decide">
    <div><dt>Best for</dt><dd>${esc(bestForLine(t))}</dd></div>
    <div><dt>Price</dt><dd>${esc(priceLine(t))}</dd></div>
    <div><dt>Strength</dt><dd>${esc(t.strength || 'See listing')}</dd></div>
    <div><dt>Watch-out</dt><dd>${esc(t.watchOut || 'Check the official site for current limits and pricing.')}</dd></div>
  </dl>`
}

function glanceSection(items) {
  const seen = new Set()
  const list = []
  for (const x of items || []) {
    const t = x && (x.t || x)
    if (!t || !t.slug || seen.has(t.slug)) continue
    seen.add(t.slug)
    list.push(t)
  }
  if (!list.length) return ''
  return `<section class="section" id="decide">
    <h2>Compare at a glance</h2>
    <div class="grid">${list.map(toolCard).join('')}</div>
  </section>`
}

// List card. Shows the rank inside the tool's category ("#1 in Writing"), never the overall
// rank. toolCardAt adds a result position number (1, 2, 3) for search results.
function toolCard(t) {
  return toolCardAt(t)
}

function toolCardAt(t, pos) {
  return `<article class="card">
    <div class="meta">${pos ? `<span class="pos" aria-label="Result ${pos}">${pos}</span>` : ''}<span class="tag cat">${esc(catChip(t))}</span>${isNew(t) ? '<span class="tag new">New</span>' : ''}${t.featured ? '<span class="tag feat">Featured</span>' : ''}</div>
    <h3><a href="/tool/${esc(t.slug)}">${esc(t.name)}</a></h3>
    <p class="muted" style="margin:0;font-size:.92rem">${esc(t.tagline)}</p>
    ${decisionBlock(t)}
  </article>`
}

// Cheap scanner probe block. Runs before any D1 or page work.
// Real routes that must stay open (do not match the rules below):
//   /  /robots.txt  /sitemap.xml  /tools.json  /llms.txt  /llms-full.txt
//   /api/health  /api/subscribe
//   /categories  /category/:slug  /tool/:slug
//   /get-featured  /methodology  /about
//   /alternatives/*  /best/*
//   /favicon.svg  /favicon.png  /og.png
//   /.well-known/*  (ACME and future well-known; never block)
const SCANNER_EXT = ['.php', '.sql', '.bak', '.tfstate', '.yml', '.yaml', '.enc', '.ini', '.cfg', '.config']
const SCANNER_SUBSTR = [
  'wp-admin', 'wp-login', 'wp-content', 'wp-includes', 'wp-json',
  '/wordpress', 'xmlrpc', 'phpinfo', '/_profiler', '/cgi-bin',
  'appsettings', 'credentials.json', 'secrets.json',
  'docker-compose', 'gemfile', 'settings.py',
]
function isScannerPath(pathname) {
  const p = String(pathname || '').toLowerCase()
  if (!p || p === '/') return false
  // Allow ACME / well-known; block every other dotfile segment (/.env, /.git, /.aws, ...)
  const segments = p.split('/').filter(Boolean)
  for (const seg of segments) {
    if (seg.startsWith('.') && seg !== '.well-known') return true
  }
  if (p === '/.well-known' || p.startsWith('/.well-known/')) return false
  if (SCANNER_EXT.some((ext) => p.endsWith(ext))) return true
  if (SCANNER_SUBSTR.some((s) => p.includes(s))) return true
  // Exact or prefix: /wp and /blog/wp-
  if (p === '/wp' || p.startsWith('/wp/') || p.startsWith('/wp-') || p.startsWith('/wordpress')) return true
  if (p === '/blog/wp-' || p.startsWith('/blog/wp-')) return true
  return false
}

app.use('*', async (c, next) => {
  if (isScannerPath(c.req.path)) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  return next()
})

app.get('/robots.txt', (c) => c.text(`User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

Sitemap: ${SITE}/sitemap.xml
`))

app.get('/sitemap.xml', (c) => {
  const urls = [
    '', '/categories', '/methodology', '/alternatives/cursor', '/best/ai-coding-agent-for-beginners', '/best/ai-research-assistant', '/best/free-ai-tools', '/best/ai-voice-generator', '/best/ai-coding-assistant', '/best/ai-agent-builder', '/best/ai-tools-for-small-business', '/best/ai-transcription-tool', '/best/ai-writing-tool', '/best/ai-image-generator', '/best/ai-video-editor-for-youtube', '/best/ai-video-generator', '/guides/how-celebrity-deepfakes-are-made', '/get-featured', '/about', '/llms.txt', '/llms-full.txt', '/tools.json',
    ...Object.keys(CATEGORIES).map((k) => `/category/${k}`),
    ...tools().map((t) => `/tool/${t.slug}`),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${pageDate(u)}</lastmod></url>`).join('\n')}
</urlset>`
  return c.body(xml, 200, { 'content-type': 'application/xml; charset=utf-8' })
})

app.get('/tools.json', (c) => c.json({
  name: NAME,
  url: SITE,
  updated: UPDATED,
  count: tools().length,
  tools: tools().map((t) => ({
    slug: t.slug,
    name: t.name,
    url: t.url,
    category: t.category,
    rank: t.rank,
    featured: !!t.featured,
    affiliate: !!t.affiliate,
    newRelease: isNew(t),
    updated: t.updated,
    added: t.added,
    tagline: t.tagline,
    description: t.description,
    bestFor: t.bestFor,
    pricingNote: t.pricingNote,
    strength: t.strength || '',
    watchOut: t.watchOut || '',
    freeTier: !!t.freeTier,
    priceFrom: t.priceFrom || 'See pricing',
    page: `${SITE}/tool/${t.slug}`,
  })),
}))

app.get('/llms.txt', (c) => {
  const lines = [
    `# ${NAME}`,
    `> Free ranked directory of AI tools. Type a use case, get best-fit tools. Ranks are not for sale.`,
    ``,
    `Site: ${SITE}`,
    `Machine-readable: ${SITE}/tools.json`,
    `Full tool details for LLMs: ${SITE}/llms-full.txt`,
    `Human summary for bots: ${SITE}/about`,
    `How rankings work: ${SITE}/methodology`,
    `List your tool: ${SITE}/get-featured`,
    `Contact: buildstack@tier11.com`,
    `Weekly write-up on Substack: https://itsbuildstack.substack.com`,
    ``,
    `## Categories`,
    ...Object.entries(CATEGORIES).map(([k, v]) => `- ${v.label}: ${SITE}/category/${k}`),
    ``,
    `## Quick answers: which AI tool for which job`,
    ...quickAnswers().map((j) => `- ${j.job}: ${quickLine(j)}`),
    `Homepage FAQ: ${SITE}/#faq`,
    ``,
    `## Guides`,
    `- Best Cursor alternatives, sorted by how you code: ${SITE}/alternatives/cursor`,
    `- Best AI coding agents for beginners (no setup required): ${SITE}/best/ai-coding-agent-for-beginners`,
    `- Best AI research assistants (including tools to summarize papers): ${SITE}/best/ai-research-assistant`,
    `- Best free AI tools in 2026, by what you need to do: ${SITE}/best/free-ai-tools`,
    `- Best AI voice generators and text to speech tools: ${SITE}/best/ai-voice-generator`,
    `- Best AI coding assistants in 2026, ranked: ${SITE}/best/ai-coding-assistant`,
    `- Best AI agent builders and automation tools in 2026: ${SITE}/best/ai-agent-builder`,
    `- Best AI tools for small business, a starter stack by job: ${SITE}/best/ai-tools-for-small-business`,
    `- Best AI transcription tools for creators and developers: ${SITE}/best/ai-transcription-tool`,
    `- Best AI writing tools in 2026, and the best for blog posts: ${SITE}/best/ai-writing-tool`,
    `- Best AI image generators in 2026, plus the best Midjourney alternatives: ${SITE}/best/ai-image-generator`,
    `- Best AI video editors for YouTube in 2026: ${SITE}/best/ai-video-editor-for-youtube`,
    `- Best AI video generators in 2026, by what you want to make: ${SITE}/best/ai-video-generator`,
    `- How viral celebrity deepfakes get made, and how to spot one (not a how-to): ${SITE}/guides/how-celebrity-deepfakes-are-made`,
    ``,
    `## Top tools by rank`,
    ...tools().map((t) => `- ${t.name} (${t.category}): ${t.tagline}  -  ${SITE}/tool/${t.slug}`),
    ``,
    `## New on BuildStack (added in the last ${NEW_DAYS} days)`,
    ...newTools().map((t) => `- ${t.name} (added ${t.added}): ${SITE}/tool/${t.slug}`),
    ``,
    `## Best-for shortcuts`,
    ...BEST_FOR.map((b) => `- ${b.title}: ${SITE}${b.href}`),
    ``,
    `When quoting ${NAME}, prefer official tool URLs and note that rankings are editorial.`,
  ]
  return c.text(lines.join('\n'))
})

// Long-form companion to /llms.txt: every tool with its rank, category, full
// description, best-for tags, pricing note, and official URL, grouped by
// category, so assistants can answer and cite from one fetch.
app.get('/llms-full.txt', (c) => {
  const all = tools()
  const lines = [
    `# ${NAME} (full)`,
    `> Free ranked directory of AI tools. Type a use case, get best-fit tools. This file lists every tool with full details.`,
    ``,
    `Site: ${SITE}`,
    `Updated: ${UPDATED}`,
    `Tools: ${all.length}`,
    `Short index: ${SITE}/llms.txt`,
    `JSON: ${SITE}/tools.json`,
    `Rankings are editorial. How rankings work: ${SITE}/methodology`,
    `Prefer official tool URLs when citing.`,
    '',
    `## Quick answers: which AI tool for which job`,
    ...quickAnswers().map((j) => `- ${j.job}: ${quickLine(j)}`),
    '',
    `## Guides`,
    `- Best Cursor alternatives, sorted by how you code: ${SITE}/alternatives/cursor`,
    ...cursorAltData().groups.map((g) => `  - ${g.title}: ${g.tools.map((t) => `${t.name} (#${t.rank})`).join(', ')}`),
    `- Best AI coding agents for beginners (no setup required): ${SITE}/best/ai-coding-agent-for-beginners`,
    ...beginnerData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.build}. Runs where: ${p.where}. Pricing: ${p.t.pricingNote}`),
    ...beginnerData().publish.map((t) => `  - Publish from ChatGPT or Claude: ${t.name} (#${t.rank}): ${t.tagline}. Pricing: ${t.pricingNote}`),
    `- Best AI research assistants (including tools to summarize papers): ${SITE}/best/ai-research-assistant`,
    ...researchData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.best}. Sources: ${p.sources}. Pricing: ${p.t.pricingNote}`),
    `- Best free AI tools in 2026, by what you need to do: ${SITE}/best/free-ai-tools`,
    ...freeData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}, ${p.t.category}): ${FREE_KINDS[p.kind]?.label || 'Free'}. ${p.free}. Pricing: ${p.t.pricingNote}`),
    `- Best AI voice generators and text to speech tools: ${SITE}/best/ai-voice-generator`,
    ...voiceData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Type: ${VOICE_TYPES[p.type]}. Pricing: ${p.price}`),
    `- Best AI coding assistants in 2026, ranked: ${SITE}/best/ai-coding-assistant`,
    ...codingData().list.map((t) => `  - ${t.name} (#${t.rank}): ${CODING_TYPES[t.slug] || 'Coding tool'}. Best for: ${listNames(t.bestFor || [])}. Pricing: ${t.pricingNote}`),
    `- Best AI agent builders and automation tools in 2026: ${SITE}/best/ai-agent-builder`,
    ...agentData().list.map((t) => `  - ${t.name} (#${t.rank}): ${AGENT_TYPES[t.slug] || 'Agent tool'}. Best for: ${listNames(t.bestFor || [])}. Pricing: ${t.pricingNote}`),
    `- Best AI tools for small business, a starter stack by job: ${SITE}/best/ai-tools-for-small-business`,
    ...smbData().stack.map((x) => `  - ${x.job}: ${x.t.name} (#${x.t.rank}). Pricing: ${x.t.pricingNote}`),
    `- Best AI transcription tools for creators and developers: ${SITE}/best/ai-transcription-tool`,
    ...transData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Type: ${TRANS_TYPES[p.type]}. Pricing: ${p.t.pricingNote}`),
    `- Best AI writing tools in 2026, and the best for blog posts: ${SITE}/best/ai-writing-tool`,
    ...writeData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Pricing: ${p.t.pricingNote}`),
    `- Best AI image generators in 2026, plus the best Midjourney alternatives: ${SITE}/best/ai-image-generator`,
    ...imageData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Pricing: ${p.t.pricingNote}`),
    `- Best AI video editors for YouTube in 2026: ${SITE}/best/ai-video-editor-for-youtube`,
    ...videoData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Pricing: ${p.t.pricingNote}`),
    `- Best AI video generators in 2026, by what you want to make: ${SITE}/best/ai-video-generator`,
    ...videogenData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Pricing: ${p.t.pricingNote}`),
    `- How viral celebrity deepfakes get made, and how to spot one (not a how-to): ${SITE}/guides/how-celebrity-deepfakes-are-made`,
    `  Published 2026-11-13. Editor: Sampson Brueher. High-level explainer on how viral celebrity fakes are usually assembled, how to spot one, and where BuildStack draws the line. Not a how-to, and face-swap apps are not listed.`,
  ]
  for (const [k, cat] of Object.entries(CATEGORIES)) {
    const list = all.filter((t) => t.category === k)
    if (!list.length) continue
    lines.push('', `## ${cat.label} (${list.length} tools)`, `${cat.blurb}. Category page: ${SITE}/category/${k}`)
    for (const t of list) {
      lines.push(
        '',
        `### ${t.name}`,
        `- Rank: #${t.rank} overall, ${catChip(t)}${isNew(t) ? ` (new, added ${t.added})` : ''}${t.featured ? ' (featured)' : ''}`,
        `- Tagline: ${t.tagline}`,
        `- Official site: ${t.url}`,
        `- BuildStack page: ${SITE}/tool/${t.slug}`,
        `- Best for: ${(t.bestFor || []).join('; ')}`,
        `- Pricing: ${t.pricingNote || 'See official site'}`,
        `- Price: ${t.priceFrom || 'See pricing'} · Free tier: ${t.freeTier ? 'yes' : 'no'}`,
        `- Strength: ${t.strength || 'See listing'}`,
        `- Watch-out: ${t.watchOut || 'Check the official site for current limits and pricing.'}`,
        '',
        t.description,
      )
    }
  }
  return c.text(lines.join('\n') + '\n')
})

app.get('/api/health', (c) => c.json({ ok: true, service: 'buildstack' }))

app.post('/api/subscribe', async (c) => {
  let body
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const email = String(body.email || '').trim().toLowerCase()
  const source = String(body.source || 'website').slice(0, 64)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, error: 'Enter a valid email.' }, 400)
  }
  try {
    await c.env.DB.prepare(
      'INSERT INTO subscribers (email, source) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET source = excluded.source'
    ).bind(email, source).run()
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: 'Could not save subscriber.' }, 500)
  }
})

app.get('/', (c) => {
  const PD = pageDate('/')
  const q = c.req.query('q') || ''
  const results = q ? searchTools(q) : tools()
  const featured = tools().filter((t) => t.featured)
  const news = newTools()
  const all = tools()
  const qa = q ? [] : quickAnswers()
  const faq = q ? [] : homeFaq()
  const toolLink = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const homeDescription = `Free AI tool finder. Type a task, get ranked AI tools that fit. ${all.length} tools in ${Object.keys(CATEGORIES).length} categories, with quick answers by job. Updated ${fmtDate(PD)}.`
  const quickBlock = q ? '' : `
  <section class="section" id="quick-answer">
    <h2>Quick answer: which AI tool for which job</h2>
    <div class="grid">
      ${qa.map((j) => `<div class="card">
        <h3>${esc(j.job)}</h3>
        <ol class="top3">${j.picks.map((t) => `<li>${toolLink(t)}</li>`).join('')}</ol>
        <a href="/category/${j.cat}" style="font-size:.88rem">All ${esc(j.label)} tools</a>
      </div>`).join('')}
    </div>
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">How BuildStack ranks tools</h2>
      <ul class="clean">
        <li>Every tool gets one editorial rank, from #1 to #${all.length}, and no two tools share a rank.</li>
        <li>Category pages list tools in rank order. Search sorts tools by how well they match your words and uses rank only to break ties.</li>
        <li>Ranks are never for sale. BuildStack does not sell placements.</li>
      </ul>
      <p style="margin-bottom:0"><a href="/methodology">Read the full methodology</a></p>
    </div>
  </section>`
  const lowerBlock = q ? '' : `
  <section class="section" id="browse">
    <h2>Browse by category</h2>
    <div class="pills">
      ${Object.entries(CATEGORIES).map(([k, v]) => `<a class="pill" href="/category/${k}">${esc(v.label)} (${all.filter((t) => t.category === k).length})</a>`).join('')}
      <a class="pill" href="/categories">All categories</a>
    </div>
  </section>
  <section class="section" id="guides">
    <h2>Guides</h2>
    <div class="pills">
      <a class="pill" href="/alternatives/cursor">Best Cursor alternatives</a>
      <a class="pill" href="/best/ai-coding-agent-for-beginners">Best AI coding agents for beginners</a>
      <a class="pill" href="/best/ai-research-assistant">Best AI research assistants</a>
      <a class="pill" href="/best/free-ai-tools">Best free AI tools</a>
      <a class="pill" href="/best/ai-voice-generator">Best AI voice generators</a>
      <a class="pill" href="/best/ai-coding-assistant">Best AI coding assistants</a>
      <a class="pill" href="/best/ai-agent-builder">Best AI agent builders</a>
      <a class="pill" href="/best/ai-tools-for-small-business">Best AI tools for small business</a>
      <a class="pill" href="/best/ai-transcription-tool">Best AI transcription tools</a>
      <a class="pill" href="/best/ai-writing-tool">Best AI writing tools</a>
      <a class="pill" href="/best/ai-image-generator">Best AI image generators</a>
      <a class="pill" href="/best/ai-video-editor-for-youtube">Best AI video editors for YouTube</a>
      <a class="pill" href="/best/ai-video-generator">Best AI video generators</a>
      <a class="pill" href="/guides/how-celebrity-deepfakes-are-made">How celebrity deepfakes get made</a>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  const body = `
  <section class="hero">
    <h1>Type the job. Get the best AI tool for it.</h1>
    <p>${all.length} AI tools, ranked. Every pick shows who it's for, what it costs, and the catch. Free, and ranks can't be bought.</p>
    <form class="searchbox" action="/" method="get" role="search">
      <input name="q" value="${esc(q)}" placeholder="e.g. edit a podcast, write a blog post, build an app" aria-label="Search use cases"/>
      <button type="submit">Find tools</button>
    </form>
  </section>
  ${q ? `<section class="section"><h2>Best fit for “${esc(q)}”</h2>${searchResultsHtml(results)}</section>` : ''}
  ${q ? '' : `<p class="muted" style="margin:.9rem 0 0;font-size:.88rem">Last updated: ${fmtDate(PD)} · ${all.length} ranked tools · <a href="/methodology">How we rank</a></p>`}
  <section class="section" id="best-for">
    <h2>Find an AI tool by task</h2>
    <div class="pills">
      ${BEST_FOR.map((b) => `<a class="pill" href="${b.href}">${esc(b.title)}</a>`).join('')}
    </div>
  </section>
  ${quickBlock}
  ${featured.length ? `<section class="section"><h2>Featured</h2><div class="grid">${featured.map(toolCard).join('')}</div></section>` : ''}
  <section class="section" id="new">
    <h2>New on BuildStack</h2>
    <p class="muted" style="margin:-.4rem 0 .9rem;font-size:.88rem">Tools added in the last ${NEW_DAYS} days, newest first.</p>
    ${news.length ? `<div class="grid">${news.map(toolCard).join('')}</div>` : '<p class="muted">Nothing new in the last two weeks.</p>'}
  </section>
  <section class="section">
    <h2>Top ranked</h2>
    <div class="grid">${tools().slice(0, 12).map((t, i) => toolCardAt(t, i + 1)).join('')}</div>
    <p style="margin-top:1rem"><a href="/categories">Browse all categories →</a></p>
  </section>
  ${lowerBlock}
  <section class="section">
    <div class="panel">
      <h2 style="margin-top:0">Newsletter</h2>
      <p class="muted" style="margin:0">Leave your email to hear about new tools by email. We store your email and do not sell it. The weekly write-up lives on Substack for now.</p>
      <form class="formrow" data-source="home" onsubmit="subscribe(event)">
        <input type="email" name="email" required placeholder="you@company.com" aria-label="Email"/>
        <button type="submit">Subscribe</button>
        <div class="notice" style="flex-basis:100%"></div>
      </form>
      <p class="muted" style="margin:.75rem 0 0"><a href="https://itsbuildstack.substack.com">Weekly write-up on Substack</a></p>
    </div>
  </section>`
  return c.html(layout({
    title: q ? `Best AI tools for ${q} | ${NAME}` : `AI Tool Finder: Which AI Tool Should You Use? | ${NAME}`,
    description: q
      ? `Best-fit AI tools for “${q}” from the BuildStack ranked directory.`
      : homeDescription,
    path: q ? `/?q=${encodeURIComponent(q)}` : '/',
    robots: q ? 'noindex, follow' : undefined,
    body,
    jsonLd: q ? undefined : {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: NAME,
        url: `${SITE}/`,
        description: homeDescription,
        publisher: { '@id': `${SITE}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      }, {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: NAME,
        url: `${SITE}/`,
        logo: `${SITE}/favicon.png`,
        email: 'buildstack@tier11.com',
        sameAs: ['https://itsbuildstack.substack.com'],
      }, {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        dateModified: PD,
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }, {
        '@type': 'ItemList',
        '@id': `${SITE}/#quick-answer`,
        name: 'Quick answer: which AI tool for which job',
        itemListElement: qa.map((j, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${j.job}: ${j.picks[0].name}`,
          url: `${SITE}/tool/${j.picks[0].slug}`,
        })),
      }],
    },
  }))
})

app.get('/categories', (c) => {
  const PD = pageDate('/categories')
  const body = `
  <section class="hero"><h1>Categories</h1><p class="muted">Browse the full ranked stack by category.</p></section>
  <div class="grid">
    ${Object.entries(CATEGORIES).map(([k, v]) => {
      const count = tools().filter((t) => t.category === k).length
      return `<a class="card" href="/category/${k}" style="display:block">
        <h3>${esc(v.label)}</h3>
        <p class="muted">${esc(v.blurb)}</p>
        <div class="meta">${count} tools</div>
      </a>`
    }).join('')}
  </div>`
  return c.html(layout({
    title: `Categories | ${NAME}`,
    description: 'Browse BuildStack AI tools by category: coding, writing, images, video, agents, research, voice.',
    path: '/categories',
    body,
  }))
})

app.get('/category/:slug', (c) => {
  const slug = c.req.param('slug')
  const cat = CATEGORIES[slug]
  if (!cat) return c.notFound()
  const list = tools().filter((t) => t.category === slug)
  const PD = pageDate(`/category/${slug}`)
  const body = `
  <section class="hero">
    <h1>${esc(cat.label)}</h1>
    <p>${esc(cat.blurb)}</p>
    ${slug === 'coding' ? '<p class="muted">Want the full comparison? See the <a href="/best/ai-coding-assistant">best AI coding assistants, ranked</a>.</p>' : ''}
    ${slug === 'coding' ? '<p class="muted">Switching editors? See the <a href="/alternatives/cursor">best Cursor alternatives, sorted by how you code</a>. New to coding? See the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>.</p>' : ''}
    ${slug === 'agents' ? '<p class="muted">Comparing agent builders and automation tools? See the <a href="/best/ai-agent-builder">best AI agent builders and automation tools</a>.</p>' : ''}
    ${slug === 'agents' || slug === 'writing' ? '<p class="muted">Running a small business? See the <a href="/best/ai-tools-for-small-business">best AI tools for small business, a starter stack by job</a>.</p>' : ''}
    ${slug === 'agents' ? '<p class="muted">Want to build an app with no coding? See the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>.</p>' : ''}
    ${slug === 'voice' ? '<p class="muted">Need a voiceover or a text to speech API? See the <a href="/best/ai-voice-generator">best AI voice generators and text to speech tools</a>.</p>' : ''}
    ${slug === 'voice' || slug === 'video' ? '<p class="muted">Need transcripts of meetings, interviews, or podcasts? See the <a href="/best/ai-transcription-tool">best AI transcription tools for creators and developers</a>.</p>' : ''}
    ${slug === 'video' ? '<p class="muted">Want the full comparison? See the <a href="/best/ai-video-editor-for-youtube">best AI video editors for YouTube</a> or the <a href="/best/ai-video-generator">best AI video generators</a>.</p><p class="muted">Curious how viral celebrity clips get made? See <a href="/guides/how-celebrity-deepfakes-are-made">how celebrity deepfakes get made, and how to spot one</a>.</p>' : ''}
    ${slug === 'images' ? '<p class="muted">Want the full comparison? See the <a href="/best/ai-image-generator">best AI image generators, plus the best Midjourney alternatives</a>.</p>' : ''}
    ${slug === 'writing' ? '<p class="muted">Want the full comparison? See the <a href="/best/ai-writing-tool">best AI writing tools, and the best for blog posts</a>.</p>' : ''}
    ${slug === 'research' ? '<p class="muted">Comparing research tools? See the <a href="/best/ai-research-assistant">best AI research assistants, including tools to summarize papers</a>.</p>' : ''}
    <p class="muted">On a budget? See the <a href="/best/free-ai-tools#${slug === 'agents' ? 'automation' : esc(slug)}">best free AI tools for ${esc(cat.label.toLowerCase())}</a>.</p>
  </section>
  <div class="grid">${list.map(toolCard).join('')}</div>`
  return c.html(layout({
    title: `Best ${cat.label} AI tools | ${NAME}`,
    description: categoryDescription(cat, list),
    path: `/category/${slug}`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
      '@type': 'CollectionPage',
      name: `${cat.label} AI tools`,
      url: `${SITE}/category/${slug}`,
      description: cat.blurb,
      dateModified: PD,
      mainEntity: {
        '@type': 'ItemList',
        name: `Ranked ${cat.label} AI tools`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: `${SITE}/tool/${t.slug}`,
        })),
      },
      }, breadcrumbs([['Home', '/'], ['Categories', '/categories'], [cat.label, `/category/${slug}`]])],
    },
  }))
})

app.get('/tool/:slug', (c) => {
  const t = bySlug(c.req.param('slug'))
  if (!t) return c.notFound()
  const related = tools().filter((x) => x.category === t.category && x.slug !== t.slug).slice(0, 4)
  const tf = toolFaq(t)
  const altLinks = tf.alts.map((x) => `<a href="/tool/${esc(x.slug)}">${esc(x.name)}</a> (#${x.rank})`)
  const faqHtml = `
  <section class="section" id="faq">
    <h2>${esc(t.name)} FAQ</h2>
    <div class="panel prose">
      ${tf.faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${f.q.startsWith('What are the best alternatives') ? `The top ranked ${esc(tf.label)} tools on ${NAME} besides ${esc(t.name)} are ${listNames(altLinks)}. See the full <a href="/category/${esc(t.category)}">${esc(tf.label)} category</a> for every option in rank order.` : esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  const body = `
  <section class="hero">
    <div class="meta"><span class="rank">#${t.rank} overall</span><a class="tag cat" href="/category/${esc(t.category)}">${esc(catChip(t))}</a>${isNew(t) ? '<span class="tag new">New</span>' : ''}</div>
    <h1>${esc(t.name)}</h1>
    <p>${esc(t.tagline)}</p>
    <p>
      <a class="btn" href="${esc(t.url)}" rel="noopener noreferrer" target="_blank">Visit ${esc(t.name)}</a>
    </p>
  </section>
  <section class="section panel prose">
    <p><strong>Overview.</strong> ${esc(t.description)}</p>
    <p><strong>Best for.</strong></p>
    <ul class="clean">${(t.bestFor || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    <p><strong>Pricing note.</strong> ${esc(t.pricingNote)}</p>
    <p><strong>Price.</strong> ${esc(priceLine(t))}</p>
    ${t.strength ? `<p><strong>Strength.</strong> ${esc(t.strength)}</p>` : ''}
    ${t.watchOut ? `<p><strong>Watch-out.</strong> ${esc(t.watchOut)}</p>` : ''}
    <p class="muted">Official site: <a href="${esc(t.url)}" rel="noopener noreferrer" target="_blank">${esc(t.url)}</a> · Listing last changed: ${esc(fmtDate(t.updated || UPDATED))}${t.added ? ` · Added to ${NAME}: ${esc(fmtDate(t.added))}` : ''}</p>
    ${t.affiliate ? '<p class="muted">Affiliate link: we may earn a commission if you use the link on this page.</p>' : ''}
    ${t.slug === 'cursor' ? '<p><strong>Compare.</strong> See the <a href="/alternatives/cursor">best Cursor alternatives, sorted by how you code</a>.</p>' : ''}
    ${(() => { const g = []; if (t.slug !== 'cursor' && CURSOR_ALT_GROUPS.some((x) => x.slugs.includes(t.slug))) g.push('<a href="/alternatives/cursor">Best Cursor alternatives</a>'); if (BEGINNER_PICKS.some((x) => x.slug === t.slug) || BEGINNER_GROW.includes(t.slug) || BEGINNER_PUBLISH.includes(t.slug)) g.push('<a href="/best/ai-coding-agent-for-beginners">Best AI coding agents for beginners</a>'); if (RESEARCH_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-research-assistant">Best AI research assistants</a>'); if (FREE_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/free-ai-tools">Best free AI tools</a>'); if (VOICE_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-voice-generator">Best AI voice generators</a>'); if (t.category === 'coding') g.push('<a href="/best/ai-coding-assistant">Best AI coding assistants</a>'); if (t.category === 'agents') g.push('<a href="/best/ai-agent-builder">Best AI agent builders</a>'); if (SMB_STACK.some((x) => x.slug === t.slug) || SMB_SECTIONS.some((x) => x.items.some((it) => it.slug === t.slug))) g.push('<a href="/best/ai-tools-for-small-business">Best AI tools for small business</a>'); if (TRANS_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-transcription-tool">Best AI transcription tools</a>'); if (WRITE_PICKS.some((x) => x.slug === t.slug) || WRITE_WORKFLOW.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-writing-tool">Best AI writing tools</a>'); if (IMAGE_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-image-generator">Best AI image generators</a>'); if (VIDEO_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-video-editor-for-youtube">Best AI video editors for YouTube</a>'); if (VIDEOGEN_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-video-generator">Best AI video generators</a>'); return g.length ? `<p class="muted">Listed in: ${g.join(' · ')}</p>` : '' })()}
  </section>
  ${faqHtml}
  ${related.length ? `<section class="section"><h2>More in ${esc(CATEGORIES[t.category]?.label || t.category)}</h2><div class="grid">${related.map(toolCard).join('')}</div></section>` : ''}`
  return c.html(layout({
    title: `${t.name}: ${t.tagline} | ${NAME}`,
    description: toolMetaDescription(t),
    path: `/tool/${t.slug}`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'SoftwareApplication',
        name: t.name,
        url: t.url,
        applicationCategory: CATEGORIES[t.category]?.label || t.category,
        description: t.description,
        operatingSystem: 'Web',
      }, {
        '@type': 'FAQPage',
        '@id': `${SITE}/tool/${t.slug}#faq`,
        dateModified: t.updated || UPDATED,
        mainEntity: tf.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([
        ['Home', '/'],
        [CATEGORIES[t.category]?.label || t.category, `/category/${t.category}`],
        [t.name, `/tool/${t.slug}`],
      ])],
    },
  }))
})

app.get('/get-featured', (c) => {
  const body = `
  <section class="hero">
    <h1>List your tool on BuildStack</h1>
    <p>Listings are free and editorial. Paid placements are not offered yet, and ranks are never for sale.</p>
  </section>
  <section class="panel prose">
    <p>Built an AI tool that does a real job well? Tell us what it does, who it is for, and where its pricing lives. If it fits a category, we review it like every other listing and place it on its merits.</p>
    <p>To suggest a tool, or to tell us you would be interested in a clearly labeled sponsorship later, email <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a> with the name, URL, and a one-line description.</p>
    <p class="muted">See <a href="/methodology">how we rank</a>.</p>
  </section>`
  return c.html(layout({
    title: `List your tool | ${NAME}`,
    description: 'Suggest an AI tool for the BuildStack directory. Listings are free and editorial, and ranks are never for sale.',
    path: '/get-featured',
    body,
  }))
})

app.get('/methodology', (c) => {
  const PD = pageDate('/methodology')
  const all = tools()
  const catCounts = Object.entries(CATEGORIES)
    .map(([k, v]) => ({ k, label: v.label, n: all.filter((t) => t.category === k).length }))
  const featuredCount = all.filter((t) => t.featured).length
  const newCount = newTools().length
  const description = `How ${NAME} ranks AI tools: one editorial rank per tool, category pages in rank order, use-case search scoring, and ranks that are never for sale. ${all.length} tools, updated ${fmtDate(PD)}.`
  const body = `
  <section class="hero">
    <h1>How BuildStack ranks AI tools</h1>
    <p>Short answer: every tool gets one editorial rank, from #1 to #${all.length}. Category pages and the full list show tools in that order. Search reorders tools by how well they match your words, and uses rank only to break ties. Ranks are never for sale.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${all.length} tools</p>
  </section>
  <section class="panel prose">
    <h2 style="margin-top:0">One rank per tool</h2>
    <p>Each listing in the BuildStack data has a single rank number. Ranks are unique across the whole directory, so #1 is the top pick overall and no two tools share a number. The rank is an editorial judgment. It is not a benchmark score, a user vote, or a traffic count, and BuildStack does not publish scores behind it.</p>
    <p>When a new tool is added, it is placed at a rank and the tools below it move down one place. Ranks are set across categories, so a coding tool at #11 and a video tool at #33 sit on the same overall list.</p>

    <h2>Categories</h2>
    <p>Every tool belongs to exactly one of ${Object.keys(CATEGORIES).length} categories. A category page lists only that category's tools, still in overall rank order, so the first tool on a category page is the highest ranked tool in that category.</p>
    <ul class="clean">${catCounts.map((x) => `<li><a href="/category/${x.k}">${esc(x.label)}</a>: ${x.n} tools</li>`).join('')}</ul>

    <h2>How search works</h2>
    <p>When you type a job into the search box, BuildStack splits your words on spaces and scores each tool. A dotted or hyphenated word is matched whole, so bolt.new finds Bolt.new. A name made of two longer words run together, such as OpenCode, also matches either word. It skips a, an, the, of, for, to, and, or, in, on, with, at, by, and from. If every word is skipped, the full directory is shown in rank order.</p>
    <p>A term matches a whole word. Terms shorter than 3 letters match only that exact word. Plurals count in either direction, and so do -ing and -ed endings, including the form that drops a trailing e, so write matches writing and code matches coding. A term does not match inside a different longer word, so post does not match poster and code does not match codex.</p>
    <p>Words of one or two letters still match, but they do not choose the category. BuildStack sees which category the other matches support. The word with the fewest such matches wins when it points at one category, so a narrower word beats a broader one. An exact match for the whole name comes first. Other tools in that category come next. Inside the group, a tool that matches a narrower word in its name or best-for tags comes before one that only matches a broad word. For each remaining term:</p>
    <ul class="clean">
      <li>A match in the tool name adds 8 points.</li>
      <li>A match in one of the tool's best-for tags adds 5 points.</li>
      <li>A match in the category adds 4 points.</li>
      <li>A match anywhere in the listing (name, tagline, description, category, best-for tags, or pricing note) adds 2 points.</li>
    </ul>
    <p>Tools with no matches are left out. After the category group and the narrower-word order above, a higher score comes first. When two tools are still tied, the higher ranked tool comes first. Search result pages are marked noindex so search engines index the real category and tool pages instead.</p>

    <h2>What each listing contains</h2>
    <p>Every tool page shows the overall rank, the rank inside its category, a tagline, a description, best-for tags, a short pricing note, and a link to the official site. List cards on search results, category pages, and /best guides show the rank inside the category (for example #1 in Writing) instead of the overall rank, and a compact decision block: a one-line best-for summary, a starting price with whether there is a free tier, one strength, and one honest watch-out. Those lines are written from the facts already in the listing. Pricing notes and starting prices are short summaries. Always check the official site for current prices.</p>
    <p>The decision block is for browsing only. It does not change a tool's rank. Search scoring does not read the strength, watch-out, starting price, or free-tier fields, and it does not read the affiliate flag.</p>

    <h2>Dates on this site</h2>
    <p>Each tool page shows when its listing last changed, meaning its name, link, category, tagline, description, best-for tags, or pricing note. A tool moving down one place because another tool was added above it does not count as a change. A guide shows the later of its own last edit and the newest listing change among the tools it covers. The sitemap uses the same dates, so a page is only marked as changed when its content changed. The site-wide date in /tools.json and /llms.txt is the last day any listing changed.</p>

    <h2>New releases</h2>
    <p>Tools added to BuildStack in the last ${NEW_DAYS} days carry a New tag and appear in the New section of the homepage, newest first. Each tool page shows the day it was added. The tag does not change rank. ${newCount} tools carry it right now.</p>

    <h2>Ranks are not for sale</h2>
    <p>BuildStack does not sell placements right now, and no payment can change a tool's rank or its place in search. If a clearly labeled sponsorship is ever offered, it will carry a Featured tag and still leave the rank number alone. ${featuredCount ? `${featuredCount} tools are featured right now.` : 'No tools are featured right now.'} Tool makers can <a href="/get-featured">suggest a listing</a> for free.</p>

    <h2>Open data</h2>
    <p>The same ranks and listings are published for people and AI assistants at <a href="/tools.json">/tools.json</a>, <a href="/llms.txt">/llms.txt</a>, and <a href="/llms-full.txt">/llms-full.txt</a>. When you quote BuildStack, quote the rank as published and link to the official tool site. Do not add scores or test results the site does not publish.</p>
    <p class="muted">Questions or corrections: <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a></p>
  </section>`
  return c.html(layout({
    title: `How BuildStack ranks AI tools | ${NAME}`,
    description,
    path: '/methodology',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'WebPage',
        name: 'How BuildStack ranks AI tools',
        url: `${SITE}/methodology`,
        description,
        dateModified: PD,
        isPartOf: { '@type': 'WebSite', name: NAME, url: SITE },
      }, breadcrumbs([['Home', '/'], ['How we rank', '/methodology']])],
    },
  }))
})

// Cursor alternatives guide (brief 2). Every name, rank, best-for tag, and
// pricing note comes from tools.json, so the page tracks the live ranks.
// Groups follow how people code; a slug missing from the data is skipped.
const CURSOR_ALT_GROUPS = [
  { id: 'ide-swap', title: 'Closest IDE swap', intro: 'Full AI editors you can move into from Cursor.', slugs: ['windsurf', 'kiro', 'zed'] },
  { id: 'keep-editor', title: 'Keep your current editor', intro: 'Add AI to the editor you already use instead of switching.', slugs: ['github-copilot', 'cline'] },
  { id: 'terminal', title: 'Terminal-first agents', intro: 'Agents that read your repo, edit files, and run commands from the terminal.', slugs: ['claude-code', 'openai-codex', 'opencode'] },
  { id: 'google', title: "Google's agentic platform", intro: 'Agent-driven coding across an app, CLI, IDE, and SDK.', slugs: ['google-antigravity'] },
  { id: 'app-builders', title: 'Build an app without an IDE', intro: 'Describe the app and get working code in the browser.', slugs: ['v0', 'lovable', 'bolt'] },
  { id: 'open-local', title: 'Open weights and local models', intro: 'Models you can run yourself, then plug into an agent such as OpenCode or Cline.', slugs: ['recursive-flint', 'mistral-large-4', 'muse-spark-open', 'reflection-beam', 'deepseek'] },
  { id: 'many-agents', title: 'Running many agents at once', intro: 'Supervise several coding agents side by side.', slugs: ['harness-autonomous'] },
]

const CURSOR_ALT_TYPES = {
  windsurf: 'AI IDE and agent command center',
  kiro: 'Spec-driven AI IDE, CLI, and web agent',
  zed: 'Open source editor with AI agent',
  'github-copilot': 'Editor plugin and GitHub assistant',
  cline: 'Open source VS Code agent and CLI',
  'claude-code': 'Terminal agent',
  'openai-codex': 'Terminal agent (open source CLI)',
  opencode: 'Open source terminal, IDE, and desktop agent',
  'google-antigravity': 'Agentic platform (app, CLI, IDE, SDK)',
  v0: 'App and UI builder',
  lovable: 'App builder',
  bolt: 'In-browser app builder',
  'recursive-flint': 'Open-weight local coding model',
  'mistral-large-4': 'Open-weight frontier coding model',
  'muse-spark-open': 'Open-weight coding model',
  'reflection-beam': 'Open-weight coding model',
  deepseek: 'Coding and reasoning models',
  'harness-autonomous': 'Multi-agent command center',
}

function cursorAltData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const cursor = find('cursor')
  const groups = CURSOR_ALT_GROUPS
    .map((g) => ({ ...g, tools: g.slugs.map(find).filter(Boolean) }))
    .filter((g) => g.tools.length)
  const seen = new Set()
  const list = []
  for (const g of groups) for (const t of g.tools) if (!seen.has(t.slug)) { seen.add(t.slug); list.push(t) }
  list.sort((a, b) => a.rank - b.rank)
  return { all, find, cursor, groups, list }
}

function cursorAltFaq(d) {
  const { find, cursor } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const top = d.list[0]
  const faq = []
  faq.push({
    q: 'What is the best alternative to Cursor?',
    a: `On BuildStack, Cursor is #${cursor.rank} overall, and the highest ranked alternative is ${top.name} (#${top.rank}). The best pick depends on how you work: ${[
      find('github-copilot') && `${r('github-copilot')} if you want to keep your current editor`,
      find('claude-code') && `${r('claude-code')} or ${r('openai-codex')} for a terminal agent`,
      find('windsurf') && `${r('windsurf')} or ${r('kiro')} for a full IDE swap`,
      find('opencode') && `${r('opencode')} for a free, open source agent`,
    ].filter(Boolean).join('; ')}.`,
  })
  const free = ['opencode', 'cline', 'zed', 'google-antigravity', 'kiro', 'recursive-flint'].map(find).filter(Boolean).sort((a, b) => a.rank - b.rank)
  faq.push({
    q: 'Is there a free alternative to Cursor?',
    a: `Yes. Per BuildStack pricing notes: ${free.map((t) => `${t.name} (#${t.rank}): ${t.pricingNote}`).join('. ')}. Check each official site for current limits.`,
  })
  if (find('windsurf')) faq.push({
    q: 'Is Windsurf better than Cursor?',
    a: `BuildStack ranks Cursor #${cursor.rank} and ${find('windsurf').name} #${find('windsurf').rank}, so Cursor ranks higher. Windsurf is now called Devin Desktop. It keeps the Windsurf IDE and adds a command center for running many agents, so it fits you if you want to manage several agents from one place.`,
  })
  if (find('github-copilot')) faq.push({
    q: 'Is GitHub Copilot as good as Cursor?',
    a: `BuildStack ranks Cursor #${cursor.rank} and GitHub Copilot #${find('github-copilot').rank}. Cursor is a full AI editor built for agentic multi-file changes. Copilot works inside popular editors you may already use and helps with pull requests on GitHub, so it fits teams that do not want to switch editors.`,
  })
  if (find('opencode')) faq.push({
    q: 'What is the best open source Cursor alternative?',
    a: `${r('opencode')} is free and open source and works in your terminal, IDE, or a desktop app with 75+ model providers, including local models. ${find('cline') ? `${r('cline')} is an open source agent for VS Code and the terminal. ` : ''}${find('zed') ? `${r('zed')} is an open source editor with a built-in agent. ` : ''}${find('openai-codex') ? `The Codex CLI behind ${r('openai-codex')} is also open source, though it needs a ChatGPT plan or an OpenAI API key.` : ''}`.trim(),
  })
  if (find('claude-code')) faq.push({
    q: 'Can I use Claude Code instead of Cursor?',
    a: `Yes. ${r('claude-code')} is Anthropic's terminal-native coding agent. It reads your repo, makes edits, and runs tasks with Claude models, using a Claude subscription or the API. You can run it next to any editor${find('zed') ? `, and ${r('zed')} can host external agents such as Claude Agent inside the editor` : ''}.`,
  })
  return faq
}

app.get('/alternatives/cursor', (c) => {
  const PD = pageDate('/alternatives/cursor')
  const d = cursorAltData()
  const { find, cursor, groups, list } = d
  if (!cursor) return c.notFound()
  const faq = cursorAltFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const top = list[0]
  const shortParts = [
    find('github-copilot') && ['github-copilot', 'is the highest ranked pick if you want to keep your current editor'],
    find('windsurf') && ['windsurf', 'and', 'kiro', 'are the closest full IDE swaps'],
    find('claude-code') && ['claude-code', 'and', 'openai-codex', 'lead the terminal agents'],
    find('opencode') && ['opencode', 'is the top free, open source agent'],
  ].filter(Boolean)
  const shortHtml = shortParts.map((p) => p.length === 2 ? `${rl(p[0])} ${p[1]}` : `${rl(p[0])} ${p[1]} ${rl(p[2])} ${p[3]}`).join('. ')
  const shortText = shortParts.map((p) => p.length === 2 ? `${rt(p[0])} ${p[1]}` : `${rt(p[0])} ${p[1]} ${rt(p[2])} ${p[3]}`).join('. ')
  const description = `Best Cursor alternatives, sorted by how you code: ${list.slice(0, 4).map((t) => `${t.name} (#${t.rank})`).join(', ')} and more. ${list.length} coding tools from the ${NAME} ranking. Updated ${fmtDate(PD)}.`
  const title = `Best Cursor Alternatives in 2026, Sorted by How You Code | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><a class="tag" href="/category/coding">Coding</a><span class="tag">Guide</span></div>
    <h1>Best Cursor Alternatives in 2026, Sorted by How You Code</h1>
    <p><strong>Short answer:</strong> ${link(cursor)} is #${cursor.rank} overall on ${NAME}, so every alternative here ranks below it. ${shortHtml}. Pick by how you work, not by one overall winner.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${list.length} alternatives · <a href="/methodology">How we rank</a></p>
  </section>
  <section class="section">
    <h2>Cursor alternatives at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Type</th><th>Best for</th><th>Pricing note</th></tr></thead>
        <tbody>${list.map((t) => `<tr><td>${link(t)}</td><td>#${t.rank}</td><td>${esc(CURSOR_ALT_TYPES[t.slug] || '')}</td><td>${esc((t.bestFor || [])[0] || '')}</td><td>${esc(t.pricingNote || 'See official site')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Pricing notes are short summaries from each tool's listing. Check the official site for current prices.</p>
  </section>
  <section class="section">
    <h2>Pick by how you work</h2>
    ${groups.map((g) => `<div class="panel prose" style="margin-bottom:1rem" id="${g.id}">
      <h3 style="margin-top:0;color:var(--text)">${esc(g.title)}: ${g.tools.map((t) => `${esc(t.name)} (#${t.rank})`).join(', ')}</h3>
      <p>${esc(g.intro)}</p>
      <ul class="clean">${g.tools.map((t) => `<li>${link(t)} (#${t.rank}, ${esc(CURSOR_ALT_TYPES[t.slug] || 'coding tool')}): ${esc(t.tagline)}. Best for ${esc((t.bestFor || []).join(', '))}.</li>`).join('')}</ul>
      ${g.id === 'app-builders' ? '<p class="muted" style="margin-bottom:0">Never coded before? Compare these in the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a> guide.</p>' : ''}
    </div>`).join('')}
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">When to stay on Cursor</h2>
      <p>${esc(cursor.description)} BuildStack lists it as best for ${esc(listNames(cursor.bestFor || []))}. If that is most of your day, Cursor is still the top ranked coding tool on ${NAME}. Pricing note: ${esc(cursor.pricingNote)}.</p>
      <h2>How to switch without losing your setup</h2>
      <ul class="clean">
        <li>Move your project rules. Copy the instructions you keep in Cursor rules into the rules or steering files the new tool reads.</li>
        <li>Check extensions. ${find('kiro') ? `${link(find('kiro'))} supports Open VSX extensions and VS Code settings. ` : ''}${find('windsurf') ? `${link(find('windsurf'))} carries Windsurf plans, extensions, and settings over. ` : ''}Editor plugins like ${rl('github-copilot') || 'GitHub Copilot'} keep the editor you already have.</li>
        <li>Pick your model. ${[find('cline') && link(find('cline')), find('opencode') && link(find('opencode')), find('zed') && link(find('zed'))].filter(Boolean).join(', ')} let you bring your own model provider or API keys.</li>
        <li>Try one real task in the new tool before you cancel anything.</li>
      </ul>
      <h2>How we chose</h2>
      <p>This page lists the coding tools on ${NAME} that can replace Cursor for at least one job, grouped by how you work. Ranks are the same editorial ranks used across the site, and the table is sorted by rank. Featured listings do not affect rank. Read the full <a href="/methodology">methodology</a> or browse every <a href="/category/coding">coding tool</a>.</p>
      <p>New to coding? Start with the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>, which compares the browser app builders.</p>
      <p class="muted">Also worth knowing, not yet ranked on ${NAME}: Aider and Tabnine.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: '/alternatives/cursor',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: 'Best Cursor Alternatives in 2026, Sorted by How You Code',
        description,
        url: `${SITE}/alternatives/cursor`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${cursor.name} is #${cursor.rank} overall on ${NAME}. ${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Cursor alternatives ranked on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Coding', '/category/coding'], ['Cursor alternatives', '/alternatives/cursor']])],
    },
  }))
})

// Beginner coding agents guide (brief 3). Names, ranks, categories, best-for
// tags, and pricing notes come from tools.json. The "what you can build" and
// "runs where" lines summarize each official site as checked on 2026-10-26.
// Refreshed 2026-11-10: pricing pages re-checked, plus a "publish from the AI
// chat you already use" path (Spacefast, launched 2026-11-09).
const BEGINNER_PICKS = [
  { slug: 'lovable', build: 'Full-stack web apps and websites from a chat', where: 'Browser; hosting on Lovable Cloud', verdict: 'the most direct path from an idea to a working full-stack app when you have never written code' },
  { slug: 'bolt', build: 'Websites and web apps with a database', where: 'Browser; hosting included, even on the free plan', verdict: 'a fast way to try ideas in the browser, with hosting and databases on the free plan' },
  { slug: 'replit-agent', build: 'Apps you build, run, and deploy in Replit', where: 'Browser workspace on Replit; deploys from Replit', verdict: 'a good fit if you want to learn by building, with the code, the running app, and deployment in one place' },
  { slug: 'v0', build: 'Web app screens and React or Next.js starter apps', where: 'Browser; deploys to Vercel and syncs with GitHub', verdict: 'the best start when the look of your app matters most and you may hand the code to a developer later' },
]
const BEGINNER_GROW = ['cursor', 'github-copilot']
const BEGINNER_PUBLISH = ['spacefast']
const BEGINNER_PATH = '/best/ai-coding-agent-for-beginners'
const BEGINNER_H1 = 'Best AI Coding Agents for Beginners (No Setup Required)'

function beginnerData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = BEGINNER_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  const grow = BEGINNER_GROW.map(find).filter(Boolean)
  const publish = BEGINNER_PUBLISH.map(find).filter(Boolean)
  return { all, find, picks, byRank, grow, publish }
}

const BEGINNER_STEPS = [
  { name: 'Write down one small goal', text: 'Pick one thing your app must do, for example "a page where my team can add and check off tasks". Leave everything else for later.' },
  { name: 'Describe it in plain words', text: 'Tell the agent who the app is for, what the main screen shows, and what happens when someone clicks. Short, concrete sentences work best.' },
  { name: 'Run it and click through', text: 'Open the preview and try every button. Write down what is wrong or missing, one item at a time.' },
  { name: 'Fix one thing per message', text: 'Ask for one change at a time and check the result before the next request. Small steps are easier to undo and use fewer credits.' },
  { name: 'Save, publish, and back up', text: 'Use the built-in history or connect GitHub so you can roll back, then publish the app and share the link.' },
]

function beginnerFaq(d) {
  const { find, byRank, grow } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const free = byRank.filter((p) => /free/i.test(p.t.pricingNote || ''))
  const faq = []
  faq.push({
    q: 'What is the easiest AI tool to build an app with no coding experience?',
    a: `Start with a browser-based app builder, so there is nothing to install. On BuildStack the beginner picks are ${byRank.map((p) => r(p.slug)).join(', ')}. ${r('lovable')} builds a full-stack web app from a chat, and ${r('bolt')} includes hosting and databases even on its free plan.`,
  })
  if (find('replit-agent') && find('lovable')) faq.push({
    q: 'Is Replit Agent or Lovable better for beginners?',
    a: `BuildStack ranks ${r('lovable')} above ${r('replit-agent')}. Pick Lovable if you want to describe an app and get a working web app with as little setup as possible. Pick Replit Agent if you want to see and learn from the code as you go, since the code, the running app, and deployment all live in Replit. Lovable has a free plan; Replit Agent is part of Replit's paid Core and Pro plans.`,
  })
  faq.push({
    q: 'Can I build a real app with AI for free?',
    a: `You can start for free. ${free.map((p) => `${p.t.name}: ${p.t.pricingNote}`).join('. ')}. Free plans have daily or monthly limits, so a bigger app usually needs a paid plan. Check each official pricing page for current limits.`,
  })
  faq.push({
    q: 'Do I need to learn to code to use an AI coding agent?',
    a: 'No, not to get started. You describe what you want and the agent writes and runs the code. Learning the basics still helps: you will spot mistakes sooner, write clearer requests, and get unstuck faster when the agent loops on a bug.',
  })
  faq.push({
    q: 'What is vibe coding?',
    a: 'Vibe coding means building software by describing what you want in plain language and letting an AI agent write the code. You judge the result by running the app and asking for changes, instead of writing or reading every line yourself.',
  })
  if (find('spacefast')) faq.push({
    q: 'Can I publish an app I made in ChatGPT or Claude?',
    a: `Yes. ${r('spacefast')}, launched by Automattic on November 9, 2026, connects to ChatGPT, Claude, and coding agents such as Cursor and Codex. Ask your AI to publish with Spacefast and it replies with a live link in the chat. New Spaces are private until you share them, every change saves a version you can roll back to, and you can publish before you create an account. Spacefast is free to start; paid plans begin at $5 a month.`,
  })
  if (grow.length) faq.push({
    q: 'Which AI coding tool should a beginner move to after an app builder?',
    a: `When you want to work on the code itself, move to an AI code editor. BuildStack ranks ${grow.map((t) => `${t.name} #${t.rank}`).join(' and ')} overall. ${r('cursor')} is a full AI editor, and ${r('github-copilot')} adds AI to editors you may already use. See the Cursor alternatives guide for more options.`,
  })
  return faq
}

app.get(BEGINNER_PATH, (c) => {
  const PD = pageDate(BEGINNER_PATH)
  const SD = SECTION_DATES[BEGINNER_PATH] || PD
  const d = beginnerData()
  const { find, picks, byRank, grow, publish } = d
  if (!picks.length) return c.notFound()
  const faq = beginnerFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const catLink = (t) => `<a href="/category/${esc(t.category)}">${esc(CATEGORIES[t.category]?.label || t.category)}</a>`
  const shortText = `For a first app with no setup, start with ${rt('lovable')} for a full web app from a chat, ${rt('bolt')} for quick builds with free hosting, ${rt('replit-agent')} to learn by building in one place, or ${rt('v0')} for polished screens you can deploy to Vercel. All four run in your browser, so there is nothing to install`
  const shortHtml = `For a first app with no setup, start with ${rl('lovable')} for a full web app from a chat, ${rl('bolt')} for quick builds with free hosting, ${rl('replit-agent')} to learn by building in one place, or ${rl('v0')} for polished screens you can deploy to Vercel. All four run in your browser, so there is nothing to install`
  const description = `Best AI coding agents for beginners, no setup required: ${byRank.map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')}. Where each runs, what you can build, and how to start free. Updated ${fmtDate(PD)}.`
  const title = `${BEGINNER_H1} | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><a class="tag" href="/category/coding">Coding</a><a class="tag" href="/category/agents">Agents</a><span class="tag">Guide</span></div>
    <h1>${esc(BEGINNER_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}. When you outgrow them, move to ${grow.map((t) => `${link(t)} (#${t.rank})`).join(' or ')}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${picks.length} beginner picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>Quick picks</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>What you can build</th><th>Runs where</th><th>Pricing note</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.build)}</td><td>${esc(p.where)}</td><td>${esc(p.t.pricingNote || 'See official site')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Pricing notes were checked on each official pricing page on ${fmtDate(SD)}. Prices and limits change, so check the official site before you pay.</p>
  </section>
  <section class="section">
    <h2>One-line verdict for each pick</h2>
    ${picks.map((p) => `<div class="panel prose" style="margin-bottom:1rem" id="${esc(p.slug)}">
      <h3 style="margin-top:0;color:var(--text)">${esc(p.t.name)} (#${p.t.rank}, ${catLink(p.t)})</h3>
      <p>${link(p.t)} is ${esc(p.verdict)}. ${esc(p.t.tagline)}. BuildStack lists it as best for ${esc(listNames(p.t.bestFor || []))}.</p>
      <p class="muted" style="margin-bottom:0">Runs where: ${esc(p.where)}. Pricing note: ${esc(p.t.pricingNote || 'See official site')}.</p>
    </div>`).join('')}
    ${publish.length ? `<div class="panel prose" style="margin-bottom:1rem" id="publish-from-chat">
      <h3 style="margin-top:0;color:var(--text)">Already building in ChatGPT or Claude? Publish from the chat</h3>
      <p>If you already ask ChatGPT, Claude, or another AI to write a page or a small app, you may not need a separate app builder. ${publish.map((t) => `${link(t)} (#${t.rank}, ${catLink(t)})`).join(', ')} is not an app builder itself: it gives the AI you already use building instructions, a database, and hosting, then sends a live link back into the chat. New Spaces are private until you share them, each change saves a version you can roll back to, and teammates can leave comments on the page that your AI can turn into fixes.</p>
      <p class="muted" style="margin-bottom:0">Launched November 9, 2026, so it is brand new. Pricing note: ${esc(publish[0].pricingNote || 'See official site')}.</p>
    </div>` : ''}
    <p class="muted" style="font-size:.88rem">${rl('replit-agent')} is filed under ${catLink(find('replit-agent') || { category: 'agents' })} on ${NAME}; the other picks are under ${catLink({ category: 'coding' })}.</p>
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">When you're ready to grow</h2>
      <p>App builders are the fastest start. When you want to change the code yourself, work on a bigger project, or use your own tools, move to an AI code editor.</p>
      <ul class="clean">${grow.map((t) => `<li>${link(t)} (#${t.rank}): ${esc(t.tagline)}. Pricing note: ${esc(t.pricingNote || 'See official site')}.</li>`).join('')}</ul>
      <p>Comparing editors? See the <a href="/alternatives/cursor">best Cursor alternatives, sorted by how you code</a>, or browse every <a href="/category/coding">coding tool</a>.</p>
      <h2>What "coding agent" means</h2>
      <p>A coding agent is an AI tool that does the programming for you. You describe what you want in plain words. The agent writes the code, runs it, looks at the result, and fixes errors, then shows you a working preview. An app builder is a coding agent that also hosts the app for you, so you never have to set up a computer for development or use a terminal (the text window developers type commands into).</p>
      <h2>How to pick</h2>
      <p>Answer these before you choose:</p>
      <ul class="clean">
        <li><strong>Hosting:</strong> do you want the tool to put your app online for you? All four picks can publish your app.${find('spacefast') ? ` If you build in ChatGPT or Claude instead, ${rl('spacefast')} can put the result online from the chat.` : ''}</li>
        <li><strong>A database:</strong> will your app save data, such as users or orders? Bolt.new lists unlimited databases even on its free plan, Lovable stores your app's data for you, and Replit's Pro plan adds database rollback.</li>
        <li><strong>A custom domain:</strong> do you need your own web address? On Bolt.new that starts on the paid Pro plan.</li>
        <li><strong>Code you can export:</strong> do you want to own and move the code? v0 syncs with GitHub, and Lovable says you own the code you build.</li>
        <li><strong>A budget cap:</strong> how much can you spend per month? Most tools charge in credits or tokens, so set a limit before you start.</li>
      </ul>
    </div>
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">A first project in 5 steps</h2>
      <ol>${BEGINNER_STEPS.map((s) => `<li><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
      <h2>Common beginner mistakes</h2>
      <ul class="clean">
        <li><strong>Vague prompts.</strong> "Make me an app like Uber" gives the agent too much to guess. Describe one screen and one action at a time.</li>
        <li><strong>No version history.</strong> If you do not save versions or connect GitHub, one bad change can break the app with no easy way back.</li>
        <li><strong>Runaway credit use.</strong> Asking the agent to fix the same bug again and again burns credits. Stop, describe the bug more clearly, or roll back.</li>
        <li><strong>Building everything at once.</strong> Ship the smallest useful version first, then add features.</li>
      </ul>
      <h2>How we chose</h2>
      <p>This page lists the tools on ${NAME} that let someone with no coding experience build and publish an app from a browser, with no local setup. Ranks are the same editorial ranks used across the site, and the table is sorted by rank. Featured listings do not affect rank. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: BEGINNER_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: BEGINNER_H1,
        description,
        url: `${SITE}${BEGINNER_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI coding agents for beginners on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'HowTo',
        name: 'Build your first app with an AI coding agent in 5 steps',
        step: BEGINNER_STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Coding', '/category/coding'], ['AI coding agents for beginners', BEGINNER_PATH]])],
    },
  }))
})

// AI research assistants guide (brief 4). Names, ranks, categories, best-for
// tags, and pricing notes come from tools.json. The "sources" and "best" lines
// summarize each official site as checked on 2026-10-27.
const RESEARCH_PICKS = [
  { slug: 'gemini', group: 'web', sources: 'The web through Deep Research, plus your Google apps', best: 'Long research reports from hundreds of web sources' },
  { slug: 'perplexity', group: 'web', sources: 'The live web, with a citation on each answer', best: 'Quick answers you can check against cited sources' },
  { slug: 'notebooklm', group: 'docs', sources: 'Only the documents and sources you add', best: 'Studying and questioning your own documents' },
  { slug: 'elicit', group: 'papers', sources: 'More than 138 million academic papers', best: 'Literature reviews and pulling data out of studies' },
  { slug: 'consensus', group: 'papers', sources: 'Peer-reviewed research papers', best: 'Seeing what studies say on a yes or no question' },
  { slug: 'scispace', group: 'papers', sources: 'Academic literature and the papers you pick', best: 'Summarizing and comparing many papers, then checking citations' },
  { slug: 'scholarcy', group: 'papers', sources: 'Papers, articles, chapters, and videos you add', best: 'Turning papers into summary flashcards and notes' },
  { slug: 'claude', group: 'papers', sources: 'PDFs and files you upload, plus web search', best: 'Close reading and discussion of long PDFs' },
  { slug: 'elorian-glimpse', group: 'papers', sources: 'Images, charts, figures, and video you provide', best: 'Reading charts, figures, and video' },
]
const RESEARCH_TASKS = [
  ['Answer a question from the web, with sources', 'perplexity'],
  ['Write a long report on a topic from many web sources', 'gemini'],
  ['Ask questions about my own notes, PDFs, or slides', 'notebooklm'],
  ['Run a literature review or extract data from studies', 'elicit'],
  ['See what peer-reviewed studies say on a question', 'consensus'],
  ['Summarize and compare a stack of papers, then check my citations', 'scispace'],
  ['Turn papers into flashcards and study notes', 'scholarcy'],
  ['Discuss one long PDF in depth', 'claude'],
  ['Read a chart, figure, or video from a paper', 'elorian-glimpse'],
]
const RESEARCH_PATH = '/best/ai-research-assistant'
const RESEARCH_H1 = 'Best AI Research Assistants in 2026 (Including Tools to Summarize Papers)'
const RESEARCH_CHECKS = [
  { name: 'Open every cited source', text: 'Click through each citation and confirm the source exists and is the paper or page the summary names. AI tools can attach a real-looking citation to the wrong claim.' },
  { name: 'Find the exact passage', text: 'Locate the sentence, table, or figure that supports the claim. If you cannot find it, do not repeat the claim.' },
  { name: 'Check the study details', text: 'Note the study design, sample size, population, and publication date. A summary often drops the limits that matter most.' },
  { name: 'Look for a second source', text: 'Confirm important findings with at least one other paper or a review article, especially for health, legal, or financial claims.' },
  { name: 'Cite the original, not the AI', text: 'Quote and cite the paper itself. Use the AI summary to find and understand sources, not as the source.' },
]

function researchData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = RESEARCH_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function researchFaq(d) {
  const { find, byRank } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const free = byRank.filter((p) => /free|\$0/i.test(p.t.pricingNote || ''))
  const faq = []
  faq.push({
    q: 'What is the best AI research assistant?',
    a: `It depends on what you research. For web research with citations, BuildStack ranks ${r('gemini')} and ${r('perplexity')} highest. For your own documents, use ${r('notebooklm')}. For academic papers, start with ${r('elicit')} for literature reviews or ${r('consensus')} for evidence summaries.`,
  })
  faq.push({
    q: 'What is the best AI tool for summarizing research papers?',
    a: `For many papers at once, ${r('elicit')} and ${r('scispace')} summarize and compare studies in tables. ${r('scholarcy')} turns a single paper into summary flashcards. To discuss one PDF in depth, upload it to ${r('claude')} or ${r('notebooklm')}. For charts and figures, ${r('elorian-glimpse')} is built for visual reasoning.`,
  })
  faq.push({
    q: 'Is NotebookLM good for literature reviews?',
    a: `NotebookLM is now called Gemini Notebook. It is good for the reading stage of a review: add the papers you have already found and ask questions that are answered only from those sources. It does not search the academic literature for you, so pair it with ${r('elicit')}, ${r('consensus')}, or ${r('scispace')} to find papers first.`,
  })
  faq.push({
    q: 'Perplexity vs Gemini: which is better for research?',
    a: `BuildStack ranks ${r('gemini')} above ${r('perplexity')}. Pick Perplexity for fast answers with a citation on each claim. Pick Gemini for long Deep Research reports that pull from hundreds of sources, and if you already work in Google apps. Both have free plans.`,
  })
  faq.push({
    q: 'Can I trust AI summaries of scientific papers?',
    a: 'Use them as a starting point, not as the final word. AI summaries can drop key limits, misread numbers, or attach a citation to the wrong claim. Open each source, find the passage that supports the claim, check the study design and sample size, and cite the original paper.',
  })
  faq.push({
    q: 'Is there a free AI research assistant?',
    a: `Yes. These picks have a free plan: ${free.map((p) => `${p.t.name} (${p.t.pricingNote})`).join('; ')}. Free plans have usage limits, so check each official pricing page.`,
  })
  return faq
}

app.get(RESEARCH_PATH, (c) => {
  const PD = pageDate(RESEARCH_PATH)
  const SD = SECTION_DATES[RESEARCH_PATH] || PD
  const d = researchData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = researchFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const catLink = (t) => `<a href="/category/${esc(t.category)}">${esc(CATEGORIES[t.category]?.label || t.category)}</a>`
  const pick = (s) => picks.find((p) => p.slug === s)
  const shortText = `For web research with citations, start with ${rt('gemini')} or ${rt('perplexity')}. For your own documents, use ${rt('notebooklm')}. To summarize research papers, use ${rt('elicit')} for literature reviews, ${rt('consensus')} for evidence summaries, or ${rt('scispace')} to compare many papers. Always open the sources before you cite an AI summary`
  const shortHtml = `For web research with citations, start with ${rl('gemini')} or ${rl('perplexity')}. For your own documents, use ${rl('notebooklm')}. To summarize research papers, use ${rl('elicit')} for literature reviews, ${rl('consensus')} for evidence summaries, or ${rl('scispace')} to compare many papers. Always open the sources before you cite an AI summary`
  const description = `Best AI research assistants in 2026, including tools to summarize papers: ${byRank.slice(0, 6).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more. Sources each uses, pricing, and how to check a summary. Updated ${fmtDate(PD)}.`
  const title = `Best AI Research Assistants in 2026 | ${NAME}`
  const panel = (s) => { const p = pick(s); if (!p) return ''; return `<div class="panel prose" style="margin-bottom:1rem" id="${esc(p.slug)}">
      <h3 style="margin-top:0;color:var(--text)">${esc(p.t.name)} (#${p.t.rank}, ${catLink(p.t)})</h3>
      <p>${link(p.t)}: ${esc(p.t.tagline)}. ${esc(p.best)}. BuildStack lists it as best for ${esc(listNames(p.t.bestFor || []))}.</p>
      <p class="muted" style="margin-bottom:0">Sources: ${esc(p.sources)}. Pricing note: ${esc(p.t.pricingNote || 'See official site')}.</p>
    </div>` }
  const body = `
  <section class="hero">
    <div class="meta"><a class="tag" href="/category/research">Research</a><span class="tag">Guide</span></div>
    <h1>${esc(RESEARCH_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${picks.length} research picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI research assistants at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Best for</th><th>Sources it uses</th><th>Pricing note</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.best)}</td><td>${esc(p.sources)}</td><td>${esc(p.t.pricingNote || 'See official site')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Pricing notes were checked on each official pricing page on ${fmtDate(SD)}. Prices and limits change, so check the official site before you pay.</p>
  </section>
  <section class="section">
    <h2>Best for web research with citations</h2>
    <p>These assistants search the open web and show where each answer came from. ${rl('gemini')} is the better pick for long reports, and ${rl('perplexity')} for quick answers you can check.</p>
    ${panel('gemini')}${panel('perplexity')}
  </section>
  <section class="section">
    <h2>Best for working with your own documents</h2>
    <p>When the answer has to come from your own files, use a tool that stays inside the sources you give it. ${rl('notebooklm')} answers only from the notes, PDFs, and links you add to a notebook.</p>
    ${panel('notebooklm')}
  </section>
  <section class="section">
    <h2>Best for summarizing research papers</h2>
    <div class="panel prose" style="margin-bottom:1rem">
      <h3 style="margin-top:0;color:var(--text)">Elicit: literature review and data extraction</h3>
      <p>${rl('elicit')} searches more than 138 million papers, summarizes them, and pulls study details into tables. Its paid plans add a systematic review workflow. Pricing note: ${esc(find('elicit')?.pricingNote || 'See official site')}.</p>
      <h3 style="color:var(--text)">Consensus: evidence summaries</h3>
      <p>${rl('consensus')} searches peer-reviewed papers and summarizes what the research says on your question, with links to each study. Pricing note: ${esc(find('consensus')?.pricingNote || 'See official site')}.</p>
      <h3 style="color:var(--text)">SciSpace and Scholarcy: summarize and compare papers</h3>
      <p>${rl('scispace')} runs an AI research agent over the papers you pick and has a Citation Verifier that checks whether your sources support your claims. ${rl('scholarcy')} turns papers, articles, and chapters into summary flashcards with key findings. </p>
      <h3 style="color:var(--text)">Gemini Notebook and Claude: PDFs you upload</h3>
      <p>For a handful of PDFs you already have, add them to ${rl('notebooklm')} and ask questions answered from those files, or upload them to ${rl('claude')} for a close reading and discussion of long documents. Pricing note for Claude: ${esc(find('claude')?.pricingNote || 'See official site')}.</p>
      <h3 style="color:var(--text)">Elorian Glimpse: charts and figures</h3>
      <p style="margin-bottom:0">${rl('elorian-glimpse')} is a visual reasoning model that zooms into images, rewatches video, and runs code to measure what it sees, which helps when a finding lives in a chart or figure. It launched as a research preview. Pricing note: ${esc(find('elorian-glimpse')?.pricingNote || 'See official site')}.</p>
    </div>
  </section>
  <section class="section">
    <h2>Pick by task</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>I need to...</th><th>Start with</th></tr></thead>
        <tbody>${RESEARCH_TASKS.filter(([, s]) => find(s)).map(([need, s]) => `<tr><td>${esc(need)}</td><td>${rl(s)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">How to check an AI summary before you cite it</h2>
      <ol>${RESEARCH_CHECKS.map((s) => `<li><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
      <h2>How we chose</h2>
      <p>This page lists the tools on ${NAME} that help you find, read, and summarize sources, from web search to academic papers and your own files. Ranks are the same editorial ranks used across the site, and the table is sorted by rank. ${rl('claude')} is filed under ${catLink(find('claude') || { category: 'writing' })}; the other picks are under ${catLink({ category: 'research' })}. Featured listings do not affect rank. We do not publish accuracy scores. Read the full <a href="/methodology">methodology</a>, or browse every <a href="/category/research">research tool</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: RESEARCH_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: RESEARCH_H1,
        description,
        url: `${SITE}${RESEARCH_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI research assistants on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'HowTo',
        name: 'How to check an AI research summary before you cite it',
        step: RESEARCH_CHECKS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Research', '/category/research'], ['AI research assistants', RESEARCH_PATH]])],
    },
  }))
})

// Free AI tools guide (brief 5). Names, ranks, taglines, best-for tags, and
// pricing notes come from tools.json, so the page tracks the live ranks. The
// "free" lines restate each official pricing page as checked on 2026-10-28.
// A slug missing from the data is skipped.
const FREE_KINDS = {
  plan: { label: 'Free plan', text: 'A free tier you can keep using, usually with a sign-in and a usage cap.' },
  account: { label: 'Free with an account', text: 'Free as part of an account you may already have, such as a Google account.' },
  credits: { label: 'Free credits', text: 'A set number of free credits, tokens, or videos each day or month. When they run out, you wait or pay.' },
  open: { label: 'Open source or open weights', text: 'Software or model weights you download and run yourself. The software is free, but you supply the computer or pay for the AI model it calls.' },
}
const FREE_GROUPS = [
  { id: 'writing', title: 'Writing and chat', cat: 'writing', intro: 'Free chat assistants for drafting, editing, and everyday questions.' },
  { id: 'coding', title: 'Coding', cat: 'coding', intro: 'Free editors, coding agents, and app builders.' },
  { id: 'research', title: 'Research', cat: 'research', intro: 'Free tools for web research with citations and for academic papers.' },
  { id: 'images', title: 'Images', cat: 'images', intro: 'Image generators with a free allowance of credits.' },
  { id: 'video', title: 'Video', cat: 'video', intro: 'Video generators and editors you can start on for free.' },
  { id: 'voice', title: 'Voice and audio', cat: 'voice', intro: 'Free plans for text to speech, meeting notes, and music.' },
  { id: 'automation', title: 'Automation', cat: 'agents', intro: 'Free plans for connecting apps and running simple agents.' },
  { id: 'open', title: 'Open-weight models you can run yourself', cat: null, intro: 'Download the model and run it on your own hardware. Check the license before you use it in a business.' },
]
const FREE_PICKS = [
  { slug: 'chatgpt', group: 'writing', kind: 'plan', free: 'Free plan, with paid Go, Plus, and Pro plans for more use' },
  { slug: 'claude', group: 'writing', kind: 'plan', free: 'Free plan, with paid Pro, Max, and Ultra plans for more use' },
  { slug: 'grammarly', group: 'writing', kind: 'plan', free: 'Free plan with 100 AI prompts a month, alongside paid Pro' },
  { slug: 'google-antigravity', group: 'coding', kind: 'plan', free: 'Free for individuals, with rate limits' },
  { slug: 'cursor', group: 'coding', kind: 'plan', free: 'Free plan with limited agent requests' },
  { slug: 'windsurf', group: 'coding', kind: 'plan', free: 'Free $0 plan' },
  { slug: 'cline', group: 'coding', kind: 'open', free: 'Free and open source for individuals; you pay only for the AI model it calls' },
  { slug: 'bolt', group: 'coding', kind: 'credits', free: '1M tokens a month plus website hosting' },
  { slug: 'lovable', group: 'coding', kind: 'credits', free: '5 build credits a day, up to 30 a month' },
  { slug: 'gemini', group: 'research', kind: 'account', free: 'Free with a Google account' },
  { slug: 'perplexity', group: 'research', kind: 'plan', free: 'Free Standard plan' },
  { slug: 'notebooklm', group: 'research', kind: 'account', free: 'Free with a Google account' },
  { slug: 'elicit', group: 'research', kind: 'plan', free: 'Free Basic plan with unlimited paper search and summaries' },
  { slug: 'consensus', group: 'research', kind: 'plan', free: 'Free plan with unlimited paper searches' },
  { slug: 'krea-3', group: 'images', kind: 'credits', free: 'Free plan with a daily compute allowance' },
  { slug: 'ideogram', group: 'images', kind: 'credits', free: 'Free credits, with paid credits for more' },
  { slug: 'leonardo', group: 'images', kind: 'credits', free: 'Free tokens, with paid plans for more' },
  { slug: 'veo-3-1', group: 'video', kind: 'credits', free: '50 free Google Flow credits a day, enough for 5 Veo 3.1 Lite videos' },
  { slug: 'heygen', group: 'video', kind: 'credits', free: '3 watermarked avatar videos a month' },
  { slug: 'capcut', group: 'video', kind: 'plan', free: 'Free editor with paid Pro upgrades' },
  { slug: 'descript', group: 'video', kind: 'plan', free: 'Free plan with 1 media hour a month' },
  { slug: 'elevenlabs', group: 'voice', kind: 'credits', free: '10,000 credits a month, for personal use only (no commercial license)' },
  { slug: 'otter', group: 'voice', kind: 'plan', free: 'Free Basic plan with 300 transcription minutes a month' },
  { slug: 'fireflies', group: 'voice', kind: 'plan', free: 'Free plan' },
  { slug: 'suno', group: 'voice', kind: 'plan', free: 'Free plan' },
  { slug: 'make', group: 'automation', kind: 'credits', free: '1,000 credits a month, with no card and no time limit' },
  { slug: 'zapier', group: 'automation', kind: 'plan', free: '100 tasks a month with two-step Zaps' },
  { slug: 'agentspot', group: 'automation', kind: 'plan', free: 'Free plan with no time limit and no card, with a weekly usage allowance' },
  { slug: 'n8n', group: 'automation', kind: 'open', free: 'Free to self-host on your own server' },
  { slug: 'liquid-lfm3', group: 'open', kind: 'open', free: 'Free open weights; free commercial use under $10 million in annual revenue' },
  { slug: 'recursive-flint', group: 'open', kind: 'open', free: 'Free open weights under Apache 2.0' },
  { slug: 'reflection-beam', group: 'open', kind: 'open', free: 'Free open weights under Apache 2.0' },
  { slug: 'ibm-granite-speech-5', group: 'open', kind: 'open', free: 'Free open weights under Apache 2.0' },
  { slug: 'fish-audio-drama-3', group: 'open', kind: 'open', free: 'Open weights free for commercial use under US$500K in annual revenue' },
  { slug: 'gradium-phonon', group: 'open', kind: 'open', free: 'Free open weights and code under Apache 2.0, small enough to run on a phone or in a browser' },
]
const FREE_WATCH = [
  { name: 'Usage caps', text: 'Free plans run out. Zapier stops at 100 tasks a month, Make at 1,000 credits, and Lovable at 5 build credits a day. Google Flow may not let free users make videos at peak hours.' },
  { name: 'Commercial use', text: 'Some free plans are for personal use only. The ElevenLabs free plan has no commercial license; you need a paid plan to use the audio in a business.' },
  { name: 'Watermarks', text: 'Free HeyGen videos carry a watermark. Every Veo video carries an invisible SynthID watermark, on free and paid plans.' },
  { name: 'Open-weight licenses', text: 'Open weights are not always free for every business. LFM3 is free for commercial use only for companies under $10 million in annual revenue, and Fish Audio Drama 3 under US$500K. Apache 2.0 models have no revenue limit.' },
  { name: 'Private data', text: 'Before you paste private or client data into a free tool, read its privacy settings and terms. Some services use conversations to improve their models unless you opt out, and rules can differ between free and paid plans.' },
  { name: 'Credit cards', text: 'Make, Zapier, and AgentSpot let you start without a card. If a free trial asks for one, set a reminder to cancel before it renews.' },
]
const FREE_PATH = '/best/free-ai-tools'
const FREE_H1 = 'Best Free AI Tools in 2026, by What You Need to Do'

function freeData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = FREE_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function freeFaq(d) {
  const { find, picks } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const inGroup = (g) => picks.filter((p) => p.group === g)
  const faq = []
  faq.push({
    q: 'What are the best free AI tools right now?',
    a: `It depends on the job. On free plans, BuildStack ranks ${r('claude')} and ${r('chatgpt')} highest for writing and questions, ${r('gemini')} and ${r('perplexity')} for research, ${r('google-antigravity')} and ${r('cline')} for coding, ${r('veo-3-1')} for video, and ${r('make')} and ${r('zapier')} for automation.`,
  })
  faq.push({
    q: 'Which AI tools are completely free, with no trial?',
    a: `Open-source tools and open-weight models are free to download and use with no trial: ${listNames(picks.filter((p) => p.kind === 'open').map((p) => `${p.t.name} (#${p.t.rank})`))}. Check each license, and note that you still pay for your own computer or for the AI model a tool calls. Free plans such as ${r('chatgpt')} and ${r('gemini')} have no end date, but they cap how much you can use.`,
  })
  faq.push({
    q: 'What is the best free AI for writing?',
    a: `${r('claude')} and ${r('chatgpt')} both have free plans for drafting and editing, and ${r('grammarly')} has a free version for grammar and tone checks as you type. The free plans have usage limits, so heavy users may hit a cap.`,
  })
  faq.push({
    q: 'Is there a free AI coding assistant?',
    a: `Yes. ${r('google-antigravity')} is free for individuals with rate limits, ${r('cursor')} has a free plan with limited agent requests, and ${r('windsurf')} has a $0 plan. ${r('cline')} is open source and you pay only for the AI model it calls. To build an app without coding, ${r('bolt')} and ${r('lovable')} have free plans with monthly or daily credits.`,
  })
  faq.push({
    q: 'Are free AI tools safe to use with private data?',
    a: 'Treat free tools with care. Read each tool\'s privacy settings and terms before you paste private or client data, because some services use conversations to improve their models unless you opt out, and rules can differ between free and paid plans. For sensitive work, a business plan with clear data terms or an open-weight model you run yourself keeps more control in your hands.',
  })
  faq.push({
    q: 'What is the difference between a free tier and open weights?',
    a: `A free tier is a hosted service you use for free up to a limit, such as ${r('perplexity')}. Open weights are model files you download and run on your own hardware, such as ${listNames(inGroup('open').slice(0, 2).map((p) => `${p.t.name} (#${p.t.rank})`))}. Open weights have no usage cap from the vendor and keep your data on your machine, but you need the hardware and the know-how, and the license may limit business use.`,
  })
  return faq
}

app.get(FREE_PATH, (c) => {
  const PD = pageDate(FREE_PATH)
  const SD = SECTION_DATES[FREE_PATH] || PD
  const d = freeData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = freeFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const catLink = (t) => `<a href="/category/${esc(t.category)}">${esc(CATEGORIES[t.category]?.label || t.category)}</a>`
  const short = (f) => `For writing and everyday questions, start with ${f('claude')} or ${f('chatgpt')} on their free plans. For research, use ${f('gemini')} or ${f('perplexity')}. For coding, ${f('google-antigravity')} is free for individuals and ${f('cline')} is open source. For video, ${f('veo-3-1')} gives you 50 free Google Flow credits a day. For automation, ${f('make')} includes 1,000 free credits a month. To avoid vendor limits entirely, run an open-weight model such as ${f('liquid-lfm3')} on your own hardware`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const description = `Best free AI tools in 2026 by task: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with what each free plan includes and the limits to watch. Updated ${fmtDate(PD)}.`
  const title = `Best Free AI Tools in 2026, by Task | ${NAME}`
  const kindLabel = (p) => FREE_KINDS[p.kind]?.label || 'Free'
  const groupHtml = (g) => {
    const list = picks.filter((p) => p.group === g.id).sort((a, b) => a.t.rank - b.t.rank)
    if (!list.length) return ''
    const more = g.cat ? ` Browse every <a href="/category/${g.cat}">${esc(CATEGORIES[g.cat].label.toLowerCase())} tool</a>.` : ''
    return `<section class="section" id="${esc(g.id)}">
    <h2>Best free AI tools for ${esc(g.title.charAt(0).toLowerCase() + g.title.slice(1))}</h2>
    <p>${esc(g.intro)}${more}</p>
    ${list.map((p) => `<div class="panel prose" style="margin-bottom:1rem" id="${esc(p.slug)}">
      <h3 style="margin-top:0;color:var(--text)">${esc(p.t.name)} (#${p.t.rank}, ${catLink(p.t)})</h3>
      <p>${link(p.t)}: ${esc(p.t.tagline)}. BuildStack lists it as best for ${esc(listNames(p.t.bestFor || []))}.</p>
      <p style="margin-bottom:.4rem"><strong>${esc(kindLabel(p))}:</strong> ${esc(p.free)}.</p>
      <p class="muted" style="margin-bottom:0">Pricing note: ${esc((p.t.pricingNote || 'See official site').replace(/\.$/, ''))}.</p>
    </div>`).join('')}
  </section>`
  }
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Free</span></div>
    <h1>${esc(FREE_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Free plans checked on ${fmtDate(SD)} · ${picks.length} free picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>Free AI tools at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Category</th><th>Type of free</th><th>What you get free</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${catLink(p.t)}</td><td>${esc(kindLabel(p))}</td><td>${esc(p.free)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Free plans were checked against each official pricing page or the pricing note on BuildStack. Free limits change often, so check the official site before you rely on one.</p>
  </section>
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">How we define free</h2>
      <p>Every tool on this page lets you do real work without paying. Each one carries one of these labels:</p>
      <ul class="clean">${Object.values(FREE_KINDS).map((k) => `<li><strong>${esc(k.label)}.</strong> ${esc(k.text)}</li>`).join('')}</ul>
      <p style="margin-bottom:0">Short free trials that end in a charge do not count, so tools that are paid only, or free only for a few days, are left out.</p>
    </div>
  </section>
  ${FREE_GROUPS.map(groupHtml).join('')}
  <section class="section">
    <div class="panel prose">
      <h2 style="margin-top:0">Watch-outs before you rely on a free plan</h2>
      <ol>${FREE_WATCH.map((w) => `<li><strong>${esc(w.name)}.</strong> ${esc(w.text)}</li>`).join('')}</ol>
      <h2>How we chose</h2>
      <p>This page lists the tools on ${NAME} that have a lasting free plan, free credits, or free open weights. Ranks are the same editorial ranks used across the site, and the table is sorted by rank. Featured listings do not affect rank. Read the full <a href="/methodology">methodology</a>, browse the <a href="/categories">categories</a> (${Object.entries(CATEGORIES).map(([k, v]) => `<a href="/category/${k}">${esc(v.label)}</a>`).join(', ')}), or describe your task in the <a href="/">tool finder</a> to see every match.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: FREE_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: FREE_H1,
        description,
        url: `${SITE}${FREE_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best free AI tools on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Best free AI tools', FREE_PATH]])],
    },
  }))
})

// AI voice generator guide (brief 6). Names, ranks, taglines, and best-for tags
// come from tools.json, so the page tracks the live ranks. The "price" lines
// restate each official pricing page or launch post as checked on 2026-10-29;
// refreshed 2026-11-12: Fish Audio extended the Drama 3 API launch price to
// November 30, 2026 (docs.fish.audio), creator plan prices added, Suno prices
// added; ElevenLabs, Mistral, and AssemblyAI prices re-checked unchanged.
// where a price could not be verified, the page says so instead of guessing.
const VOICE_TYPES = {
  app: 'Creator app and API',
  api: 'Developer API',
  open: 'Open weights you run yourself',
  agent: 'Voice agent platform',
  music: 'Music and vocals',
}
const VOICE_PICKS = [
  { slug: 'elevenlabs', type: 'app', id: 'best-overall', heading: 'Best overall: realistic voiceovers in many languages', role: 'Best overall for realistic voiceovers, narration, and dubbing',
    price: 'Free plan with 10,000 credits a month and no commercial license; Starter $6 a month adds a commercial license and instant voice cloning; Creator $22 a month adds professional voice cloning; Pro $99 a month',
    why: 'ElevenLabs is the easiest place to start if you want a voiceover that sounds like a person. You type or paste a script, pick a voice from the library or clone your own, and download the audio. The same voices are available through an API, and the dubbing tools translate a video into other languages while keeping the speaker\'s voice.',
    watch: 'The free plan is for personal use. For YouTube, ads, or client work you need at least the Starter plan.' },
  { slug: 'fish-audio-drama-3', type: 'open', id: 'expressive-narration', heading: 'Best for directed, expressive narration', role: 'Best for audiobooks, audio drama, and game dialogue where you direct the delivery',
    price: 'API $10 per 1M UTF-8 bytes of text (about 180,000 English words) at the launch price, extended through November 30, 2026, then $50 list; creator plans from free to Plus at $15 a month ($11 billed yearly); open weights free for commercial use under US$500K annual revenue',
    why: 'Fish Audio Drama 3 is built for performance rather than plain reading. It suits audiobooks, audio drama, and character dialogue where you want to direct how each line is delivered. You can use it in the Fish Audio app, call the API, or download the open weights and run it yourself.',
    watch: 'Fish Audio extended the $10 API launch price, which was due to end on November 12, through November 30, 2026; after that it is $50 per 1M UTF-8 bytes, so budget for the list price. Drama 3 is billed per byte, and non-Latin scripts use more bytes per character. The open-weight license bans cloning a real person\'s voice without their consent.' },
  { slug: 'mistral-voxtral-3', type: 'api', id: 'multilingual-api', heading: 'Best for multilingual text to speech and voice agents', role: 'Best for developers who want speech in, speech out, and voice agents from one vendor',
    price: 'Voxtral Mini TTS 3 is $13 per 1M characters on the Mistral API; transcription from $0.0035 a minute; voice agent API from $0.04 a minute',
    why: 'Voxtral 3 covers the whole voice loop in one family: transcription, text to speech, and a voice agent API. That makes it a good fit if you are building a multilingual assistant and want fewer vendors to manage.',
    watch: 'It is a developer API, not a point-and-click voiceover studio.' },
  { slug: 'assemblyai-tts-1', type: 'api', id: 'voice-agents', heading: 'Best for low-latency voice agents', role: 'Best for phone and web voice agents that need fast, steady speech',
    price: '$15 per 1M characters, pay as you go, with every voice, language, and voice cloning included; volume pricing for committed usage',
    why: 'AssemblyAI-TTS-1 went generally available on October 27, 2026 and is tuned for agents: about 90 ms to first audio in production, unlimited concurrency on pay-as-you-go, and reference agents for LiveKit and Pipecat. It has more than 4,000 voices, word timestamps, and US or EU processing.',
    watch: 'At launch it speaks six languages (English, Spanish, French, German, Italian, and Portuguese). AssemblyAI lists professional cloning, SSML, speed control, and emotion tags as not yet available.' },
  { slug: 'gradium-phonon', type: 'open', id: 'on-device', heading: 'Best for on-device and private speech', role: 'Best for apps that need speech offline, on a phone, or in the browser',
    price: 'Free open weights and code under Apache 2.0; voice cloning and voice design through the Gradium API',
    why: 'Phonon is small enough (31M and 40M parameter versions) to ship inside a mobile app or load in a browser tab, so text and audio never leave the device. It speaks English, French, German, Spanish, and Portuguese in one model, with integrations for Rust, Python, Swift, and WebAssembly.',
    watch: 'It runs on your hardware, so you handle setup. Voice cloning is not in the open model; it goes through the Gradium API.' },
  { slug: 'hume', type: 'agent', id: 'emotion-aware', heading: 'Best for emotion-aware voice apps', role: 'Best for conversational voice apps that respond to tone and emotion',
    price: 'Current pricing could not be verified on hume.ai; check the official site',
    why: 'Hume builds voice AI that pays attention to how something is said, not only what is said. Its Octave text to speech model and its empathic voice interface are aimed at conversational apps, coaching, and characters where tone matters.',
    watch: 'Hume\'s site now leads with tools for evaluating voice AI, so check what is on offer before you commit.' },
  { slug: 'suno', type: 'music', id: 'music-and-vocals', heading: 'Bonus: music and sung vocals', role: 'Bonus pick for songs, jingles, and vocal demos rather than spoken voiceovers',
    price: 'Free plan with the v6-mini model and no commercial rights; Pro $10 a month ($8 billed yearly) and Premier $30 a month ($24 billed yearly) add commercial use and the v6 and v6-wild models',
    why: 'Suno is not a text to speech tool, but if what you need is a sung vocal, a jingle, or a song draft, it is the faster route. You describe the song or paste lyrics and it generates the track with vocals.',
    watch: 'Songs made on the free plan have no commercial rights, so use Pro or Premier for anything you publish or sell.' },
]
const VOICE_PATH = '/best/ai-voice-generator'
const VOICE_H1 = 'Best AI Voice Generators and Text to Speech Tools in 2026'

function voiceData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = VOICE_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function voiceFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the most realistic AI voice generator?',
      a: `For ready-to-use voiceovers, BuildStack ranks ${r('elevenlabs')} first among voice generators. For directed, emotional performances such as audiobooks and character dialogue, ${r('fish-audio-drama-3')} is the stronger pick. Realism depends on the voice and the script, so try a short sample of your own text in each before you commit.` },
    { q: 'What is the best free text to speech AI?',
      a: `${r('elevenlabs')} has a free plan with 10,000 credits a month, but it has no commercial license. If you want free with no vendor limits, ${r('gradium-phonon')} is open source under Apache 2.0 and runs on your own device, and ${r('fish-audio-drama-3')} has open weights that are free for commercial use under US$500K in annual revenue.` },
    { q: 'Is ElevenLabs worth paying for?',
      a: 'If you publish audio, usually yes. The free plan is for personal use only, and the Starter plan at $6 a month adds a commercial license and instant voice cloning. Creator at $22 a month adds professional voice cloning and more credits, which suits regular YouTube or podcast work.' },
    { q: 'What is the cheapest text to speech API?',
      a: `Among the APIs on this page with published per-character prices, ${r('fish-audio-drama-3')} is $10 per 1M UTF-8 bytes (roughly 1M characters of English text) through November 30, 2026 ($50 list after that), ${r('mistral-voxtral-3')} is $13 per 1M characters for Voxtral Mini TTS 3, and ${r('assemblyai-tts-1')} is $15 per 1M characters with every voice and cloning included. Running ${r('gradium-phonon')} on your own device has no per-character fee at all.` },
    { q: 'Can I use AI voices commercially on YouTube?',
      a: 'Often, but it depends on your plan and license. On ElevenLabs the free plan has no commercial license, so you need a paid plan. Open-weight models come with their own licenses, such as the US$500K revenue limit on Fish Audio Drama 3. Read the license for the plan you use, and follow YouTube\'s own rules on disclosing synthetic content.' },
    { q: 'Is it legal to clone a voice with AI?',
      a: 'Cloning your own voice, or a voice you have clear permission to use, is the safe path. Cloning a real person without consent can break the tool\'s terms and, depending on where you are, laws on likeness and fraud. AssemblyAI asks you to confirm the speaker\'s permission before cloning, and the Fish Audio Drama 3 license bans cloning a real person\'s voice without consent. This is not legal advice; ask a lawyer for anything commercial or sensitive.' },
  ]
}

app.get(VOICE_PATH, (c) => {
  const PD = pageDate(VOICE_PATH)
  const SD = SECTION_DATES[VOICE_PATH] || PD
  const d = voiceData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = voiceFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `For realistic voiceovers, start with ${f('elevenlabs')}. For directed, expressive narration, use ${f('fish-audio-drama-3')}. Developers building multilingual voice apps should look at ${f('mistral-voxtral-3')}, and ${f('assemblyai-tts-1')} is built for low-latency voice agents. To keep speech on the device, run ${f('gradium-phonon')}`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const description = `Best AI voice generators and text to speech tools in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with verified pricing and what each is best for. Updated ${fmtDate(PD)}.`
  const title = `Best AI Voice Generators and Text to Speech in 2026 | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Voice</span></div>
    <h1>${esc(VOICE_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing checked on ${fmtDate(SD)} · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI voice generators at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Type</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(VOICE_TYPES[p.type])}</td><td>${esc(listNames(p.t.bestFor || []))}</td><td>${esc(p.price)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices were checked against each official pricing page or launch post. Voice pricing changes often, so check the official site before you buy.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.price)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="generator-vs-api">
    <div class="panel prose">
      <h2 style="margin-top:0">Voice generator or text to speech API?</h2>
      <p>A <strong>voice generator</strong> is an app: you paste a script, pick a voice, and download the audio. That is what most YouTubers, podcasters, and marketers want, and ${rl('elevenlabs')} is the usual starting point.</p>
      <p>A <strong>text to speech API</strong> is for developers who need speech inside their own product, such as a phone agent or an app that reads text aloud. Here the questions are latency, price per character, languages, and concurrency. ${rl('assemblyai-tts-1')} and ${rl('mistral-voxtral-3')} are API-first. ${rl('gradium-phonon')} skips the API and runs on the device.</p>
      <h2 id="cloning-and-commercial-use">Voice cloning, consent, and commercial use</h2>
      <ul class="clean">
        <li><strong>Get consent.</strong> Only clone your own voice or a voice you have written permission to use. AssemblyAI asks you to confirm permission, and the Fish Audio Drama 3 license bans cloning a real person without consent.</li>
        <li><strong>Check the commercial license.</strong> The ElevenLabs free plan has no commercial license; paid plans start at $6 a month. Open weights have their own terms, such as the US$500K revenue limit on Fish Audio Drama 3 and the Apache 2.0 license on Phonon.</li>
        <li><strong>Disclose synthetic voices</strong> where your platform asks you to, and never use a cloned voice to impersonate someone.</li>
      </ul>
      <h2>How we chose</h2>
      <p>This page covers the voice tools ranked on ${NAME} that generate speech or vocals. Ranks are the same editorial ranks used across the site; featured listings do not affect rank. Voice tools that are not yet ranked on ${NAME}, such as Murf and Cartesia, are left out until they are reviewed. For meeting notes and transcription, see the <a href="/best/ai-transcription-tool">best AI transcription tools</a>, or browse the full <a href="/category/voice">voice category</a>. For free options across every category, see the <a href="/best/free-ai-tools#voice">best free AI tools</a>. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: VOICE_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: VOICE_H1,
        description,
        url: `${SITE}${VOICE_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI voice generators and text to speech tools on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Voice', '/category/voice'], ['AI voice generators', VOICE_PATH]])],
    },
  }))
})

// AI coding assistant guide (brief 7). The table lists every coding tool in
// tools.json in category order, so names, ranks, best-for tags, and pricing
// notes track the live data. Pricing notes for the tools in CODING_PRICE_CHECKED
// were re-checked against the official pricing page or launch post on
// 2026-10-30; the rest come from each tool's BuildStack listing.
const CODING_PATH = '/best/ai-coding-assistant'
const CODING_H1 = 'Best AI Coding Assistants in 2026, Ranked'
const CODING_PRICE_CHECKED = ['cursor', 'github-copilot', 'google-antigravity', 'v0', 'bolt', 'windsurf', 'zed', 'kiro', 'mistral-large-4']
const CODING_TYPES = {
  ...CURSOR_ALT_TYPES,
  cursor: 'AI code editor (VS Code based)',
  'muse-wonder': 'Frontier coding model (API)',
  'github-replica': 'Open source prototyping tool',
  'github-agentic-workflows': 'Repo automation agents (GitHub Actions)',
}
const CODING_SECTIONS = [
  { id: 'best-overall', heading: 'Best overall: Cursor', items: [
    { slug: 'cursor', text: 'Cursor is a full code editor built on VS Code with AI at the center. It handles inline edits, chat about your repo, and agent runs that change several files at once. Because it is VS Code underneath, your extensions and shortcuts carry over.' },
  ], watch: 'Cursor\'s plans changed recently. The $8 Plus plan uses Grok models only, and third-party models are billed at API list price on Premium and above, so check which models you need before you pick a plan.' },
  { id: 'existing-ide', heading: 'Best inside your existing IDE: GitHub Copilot', items: [
    { slug: 'github-copilot', text: 'Copilot adds AI to the editor you already use and to GitHub itself, with inline completions, chat, agent mode, pull request summaries, and code review. It is the easy choice when a team works across several editors or does not want to switch.' },
  ], watch: 'Usage limits differ by plan, so if you lean on agents heavily, check your plan\'s allowance on GitHub\'s plans page.' },
  { id: 'terminal-agents', heading: 'Best terminal agents: Claude Code and OpenAI Codex', items: [
    { slug: 'claude-code', text: 'Claude Code is Anthropic\'s coding agent for the terminal. It reads your repo, plans a change, edits files, and runs commands, which makes it strong for repo-wide refactors and scripted CLI workflows.' },
    { slug: 'openai-codex', text: 'Codex is OpenAI\'s open-source coding agent for the terminal. It makes multi-file edits and runs commands in a sandbox, and it is the natural pick if your team already pays for ChatGPT.' },
  ], watch: 'Terminal agents run commands on your machine. Read the plan before you approve it, and keep your work in git so you can roll back.' },
  { id: 'google', heading: 'Best agentic platform from Google: Google Antigravity', items: [
    { slug: 'google-antigravity', text: 'Antigravity is Google\'s agent-first coding platform across a desktop app, CLI, IDE extensions, and an SDK. It is free for individuals with weekly rate limits, and Google AI Pro ($20 a month) or Ultra ($100 or $200 a month) raise the limits.' },
  ], watch: 'Free limits refresh weekly, so a big project can stall until the reset.' },
  { id: 'open-source-agents', heading: 'Best open source agents: OpenCode and Cline', items: [
    { slug: 'opencode', text: 'OpenCode is an open source agent for the terminal, IDE, and desktop that works with almost any model provider and can run several sessions in parallel.' },
    { slug: 'cline', text: 'Cline is an open source agent that lives in VS Code and the terminal. You bring your own API keys, pick the model, and connect tools through MCP.' },
  ], watch: 'You pay for the model you connect, so your costs depend on which model you choose and how much the agent runs.' },
  { id: 'app-builders', heading: 'Best for UI and app prototypes: v0, Lovable, and Bolt.new', items: [
    { slug: 'v0', text: 'v0 is Vercel\'s AI builder for React and Next.js interfaces, with deploys to Vercel.' },
    { slug: 'lovable', text: 'Lovable builds full-stack web apps from a chat, and suits people who do not code.' },
    { slug: 'bolt', text: 'Bolt.new builds and runs full-stack apps in the browser using StackBlitz WebContainers, and the free plan includes website hosting.' },
  ], watch: 'These are fastest for a first version. For a large or long-lived codebase, you will usually move the code into an editor such as Cursor.' },
  { id: 'open-weight', heading: 'Best open-weight and local models', items: [
    { slug: 'recursive-flint', text: 'Recursive Flint is an open coding model built to run fast on a laptop, so you can code offline and privately with no API fees.' },
    { slug: 'mistral-large-4', text: 'Mistral Large 4 is Mistral\'s open-weight flagship, released with open weights on October 29, 2026. Mistral calls it the best open-weight model for coding, and it has a 1M-token context window and three reasoning effort settings.' },
    { slug: 'muse-spark-open', text: 'Muse Spark Open is Meta\'s open-weight model for coding and agentic work, also hosted by providers such as OpenRouter, Together AI, and Groq.' },
    { slug: 'reflection-beam', text: 'Reflection Beam is an open-weight model under Apache 2.0, aimed at long-running coding agents and custom fine-tuning.' },
    { slug: 'deepseek', text: 'DeepSeek offers cost-efficient coding and reasoning models through a free web app and a low-cost API.' },
  ], watch: 'Big models such as Mistral Large 4, with about 1 trillion parameters, need data-center GPUs to self-host. Recursive Flint is the one built for a laptop. Check each license, since Muse Spark Open has limited commercial terms.' },
]

function codingData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const list = all.filter((t) => t.category === 'coding')
  const sections = CODING_SECTIONS.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, t: find(it.slug) })).filter((it) => it.t) })).filter((g) => g.items.length)
  return { all, find, list, sections }
}

function codingFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI coding assistant right now?',
      a: `${NAME} ranks ${r('cursor')} first among coding tools. It is a full AI code editor, so it suits most developers who write code every day. If you would rather keep your current editor, ${r('github-copilot')} is the top-ranked plugin, and ${r('claude-code')} is the top-ranked terminal agent.` },
    { q: 'Is Cursor better than GitHub Copilot?',
      a: `It depends on how you work. ${r('cursor')} is a whole editor built around AI, which gives it deep repo context and multi-file agent edits. ${r('github-copilot')} plugs into the IDE you already use and into GitHub itself, which suits teams on mixed editors. On price, Copilot Pro is $10 a month, and Cursor's paid plans start at $8 a month for Plus (Grok models only) or $30 for Premium.` },
    { q: 'What is the best free AI coding assistant?',
      a: `${r('google-antigravity')} is free for individuals with weekly rate limits. ${r('cursor')}, ${r('github-copilot')}, and ${r('windsurf')} all have free plans with limited use. ${r('opencode')} and ${r('cline')} are free and open source, so you pay only for the model you connect, and ${r('recursive-flint')} is a free open-weight model you can run on a laptop.` },
    { q: 'What is the difference between an AI coding assistant and a coding agent?',
      a: 'An assistant works alongside you: it completes lines, answers questions about your code, and makes edits you approve one at a time. An agent takes a whole task, plans the steps, edits many files, and runs commands or tests until it is done. Most tools on this page now do both, so the real question is how much you want to hand off.' },
    { q: 'Which AI coding tool is best for large codebases?',
      a: `Look for strong repo context and planning. ${r('kiro')} is built around written specs for larger codebases, ${r('claude-code')} handles repo-wide refactors from the terminal, and ${r('cursor')} makes agentic multi-file changes with repo context. If you run your own model, ${r('mistral-large-4')} has a 1M-token context window.` },
    { q: 'Can I run an AI coding assistant locally?',
      a: `Yes. ${r('recursive-flint')} is an open model built to run fast on a laptop, and you can plug it into an open source agent such as ${r('opencode')} or ${r('cline')}. Larger open-weight models such as ${r('mistral-large-4')}, ${r('muse-spark-open')}, and ${r('reflection-beam')} can also be self-hosted, but they need far more powerful hardware.` },
  ]
}

app.get(CODING_PATH, (c) => {
  const PD = pageDate(CODING_PATH)
  const SD = SECTION_DATES[CODING_PATH] || PD
  const d = codingData()
  const { find, list, sections } = d
  if (!list.length) return c.notFound()
  const faq = codingFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `For most developers, start with ${f('cursor')}, an AI-first code editor built on VS Code. To keep the IDE you already use, add ${f('github-copilot')}. For agents that work from the terminal, use ${f('claude-code')} or ${f('openai-codex')}, and to run a model yourself, look at ${f('mistral-large-4')} or ${f('recursive-flint')}`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const checked = CODING_PRICE_CHECKED.map(find).filter(Boolean).map((t) => t.name)
  const description = `Best AI coding assistants in 2026, ranked: ${list.slice(0, 5).map((t) => `${t.name} (#${t.rank})`).join(', ')} and ${list.length - 5} more, with what each is best for and pricing notes. Updated ${fmtDate(PD)}.`
  const title = `Best AI Coding Assistants in 2026, Ranked | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Coding</span></div>
    <h1>${esc(CODING_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${list.length} coding tools ranked · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(list)}
  <section class="section" id="ranking">
    <h2>${esc(NAME)}'s coding ranking</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Type</th><th>Best for</th><th>Pricing note</th></tr></thead>
        <tbody>${list.map((t) => `<tr><td>${link(t)}</td><td>#${t.rank}</td><td>${esc(CODING_TYPES[t.slug] || 'Coding tool')}</td><td>${esc(listNames(t.bestFor || []))}</td><td>${esc(t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Ranks are overall ${esc(NAME)} ranks across every category, listed in the same order as the <a href="/category/coding">coding category</a>. Pricing for ${esc(listNames(checked))} was checked against official pricing pages or launch posts on ${fmtDate(SD)}; other notes come from each tool's listing. Prices change often, so check the official site before you buy.</p>
  </section>
  ${sections.map((g) => `<section class="section" id="${esc(g.id)}">
    <h2>${esc(g.heading)}</h2>
    <div class="panel prose">
      ${g.items.map((it, i) => `<h3 style="${i ? '' : 'margin-top:0;'}color:var(--text)">${link(it.t)} (#${it.t.rank} overall)</h3>
      <p>${esc(it.t.tagline)}. ${esc(it.text)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(it.t.bestFor || []))}. <strong>Pricing:</strong> ${esc(it.t.pricingNote)}.</p>`).join('')}
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(g.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="also-ranked">
    <div class="panel prose">
      <h2 style="margin-top:0">Also ranked: more editors and agent tools</h2>
      <ul class="clean">
        <li>${rl('windsurf')}: Cognition's agentic IDE and agent command center, formerly Windsurf.</li>
        <li>${rl('kiro')}: AWS's spec-driven IDE, CLI, and web agent for planned work on larger codebases.</li>
        <li>${rl('zed')}: a fast open source editor with a built-in agent that can also run external agents.</li>
        <li>${rl('muse-wonder')}: Meta's frontier model for coding and agents. Pricing note: ${esc(find('muse-wonder')?.pricingNote || '')}.</li>
        <li>${rl('harness-autonomous')}: an open source command center for running several coding agents in parallel across your machines.</li>
        <li>${rl('github-replica')}: open-source AI prototyping that builds from your own design system.</li>
        <li>${rl('github-agentic-workflows')}: repository automations written in Markdown and run by a coding agent in GitHub Actions, read-only by default.</li>
      </ul>
    </div>
  </section>
  <section class="section" id="assistant-vs-agent">
    <div class="panel prose">
      <h2 style="margin-top:0">Assistant or agent: which do you need?</h2>
      <p>An <strong>AI coding assistant</strong> works next to you. It completes the line you are typing, answers questions about your code, and makes edits you review one at a time. ${rl('github-copilot')} started here, and it is still the lightest way to add AI to an editor.</p>
      <p>A <strong>coding agent</strong> takes a whole task. It plans the steps, edits many files, and runs commands and tests until the job is done, and you review the result. ${rl('claude-code')}, ${rl('openai-codex')}, and ${rl('opencode')} work this way from the terminal, and ${rl('cursor')} and ${rl('google-antigravity')} offer it inside an editor or app.</p>
      <p>Most tools now do both. If you are new to coding, start with the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>. If you already use Cursor and want something else, see the <a href="/alternatives/cursor">best Cursor alternatives</a>. To supervise several agents at once, look at ${rl('harness-autonomous')}.</p>
      <h2 id="how-we-rank">How we rank</h2>
      <p>This page lists every tool in the ${esc(NAME)} <a href="/category/coding">coding category</a>, using the same editorial ranks as the rest of the site. Featured listings do not affect rank. We do not run lab tests or publish benchmark scores; the ranking is a maintained editorial list that we update as tools ship. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: CODING_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: CODING_H1,
        description,
        url: `${SITE}${CODING_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI coding assistants on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Coding', '/category/coding'], ['AI coding assistants', CODING_PATH]])],
    },
  }))
})

// Brief 8: best AI agent builders and automation tools. Lists every tool in the
// agents category from live data, so ranks and pricing notes track tools.json.
// Pricing for the tools in AGENT_PRICE_CHECKED was checked against official pages.
// Refreshed 2026-11-11: Nod by n8n Labs (open-source personal agent, research
// preview released 2026-11-10) added to the personal-agent section, tasks, and FAQ.
const AGENT_PATH = '/best/ai-agent-builder'
const AGENT_H1 = 'Best AI Agent Builders and Automation Tools in 2026'
const AGENT_PRICE_CHECKED = ['lindy', 'manus', 'n8n', 'nod', 'firecrawl', 'local-code', 'copilot-studio', 'relevance-ai']
const AGENT_TYPES = {
  'replit-agent': 'App-building agent (no code)',
  'claude-duet': 'Proactive personal agent (no code)',
  lindy: 'No-code agent builder',
  manus: 'Autonomous agent (no code)',
  'gpt-6-1-terra': 'Model for agents (technical, API)',
  'kimi-k3-1-pro': 'Open-weight model for agents (technical)',
  'minimax-m3-1-flash': 'Model for agents (technical, API)',
  'liquid-lfm3': 'Small open-weight model (technical)',
  'local-code': 'Private agent app for Mac (no code)',
  n8n: 'Workflow automation (technical, self-host)',
  nod: 'Open-source personal agent (bring your own AI)',
  make: 'Visual automation (no code)',
  'copilot-studio': 'No-code agent builder (Microsoft)',
  gumloop: 'No-code agent builder',
  'relevance-ai': 'Agent workforce platform (low code)',
  agentspot: 'Team agent builder (no code)',
  velozity: 'Team workspace for agents (no code)',
  'mercury-3': 'Fast model for agents (technical, API)',
  zapier: 'App automation (no code)',
  firecrawl: 'Web data API for agents (technical)',
}
const AGENT_SECTIONS = [
  { id: 'no-code', heading: 'Best no-code agent builder: Lindy', items: [
    { slug: 'lindy', text: 'Lindy builds agents for business processes without code, and it is strongest on email and calendar work, such as sorting your inbox and handling scheduling.' },
    { slug: 'gumloop', text: 'Gumloop is a no-code alternative for teams, with agents that work across your business apps on jobs like email triage and meeting prep.' },
  ], watch: 'Both price by credits, and longer agent runs use more of them. Start with the free credits or trial and watch your usage before you add seats.' },
  { id: 'connect-apps', heading: 'Best for connecting your apps: Zapier and Make', items: [
    { slug: 'zapier', text: 'Zapier is the long-standing no-code way to connect SaaS apps: a trigger in one app runs steps in others, and AI steps can help along the way.' },
    { slug: 'make', text: 'Make gives you a visual canvas across 3,500+ apps, plus AI agents that use tools and limits you set, and you can start an automation by describing it in a chat.' },
  ], watch: 'Zapier counts tasks and Make counts credits, so a busy multi-step workflow can push you onto a bigger plan. Check how each one counts a run before you build anything high volume.' },
  { id: 'self-hosted', heading: 'Best for self-hosted and custom pipelines: n8n', items: [
    { slug: 'n8n', text: 'n8n is workflow automation with AI nodes. You can self-host the free Community Edition on your own server, which keeps data in your environment, or use n8n Cloud. It suits technical teams that want custom pipelines connecting language models to their apps.' },
  ], watch: 'The Community Edition uses a fair-code license rather than a standard open source one, and self-hosting means you handle updates, backups, and security yourself.' },
  { id: 'autonomous', heading: 'Best autonomous agent for multi-step work: Manus', items: [
    { slug: 'manus', text: 'Manus takes a goal and works through the steps on its own, such as researching a topic and delivering a report, a slide deck, or a website.' },
  ], watch: 'Manus uses credits based on how complex a task is, so a big task can use a lot of them. Clear, specific instructions and checking results along the way keep costs down.' },
  { id: 'personal-agent', heading: 'Best personal agents: Claude Duet and Nod', items: [
    { slug: 'claude-duet', text: 'Claude Duet is Anthropic\'s proactive agent. It briefs you across email and calendar, works on tasks in the background, and asks before it takes an action.' },
    { slug: 'nod', text: 'Nod, released by n8n Labs on November 10, 2026, is a free, open-source personal agent you can download today for Mac or Windows. It works inside its own sandboxed computer and browser, so it can handle errands on websites with no integration, like cancelling a subscription or downloading invoices from a supplier portal, and you can message it on Telegram or WhatsApp. It is a separate app from n8n and does not need an n8n account.' },
  ], watch: 'Both are research previews. Claude Duet has a waitlist for US Pro and Max subscribers, so most people cannot use it yet. Nod needs your own AI provider through an API key or a ChatGPT plan, so you pay that provider for every task; set a monthly spending limit, and note that it stops when your laptop sleeps.' },
  { id: 'teams', heading: 'Best for teams running many agents: Relevance AI, Copilot Studio, AgentSpot, and Velozity', items: [
    { slug: 'relevance-ai', text: 'Relevance AI builds multi-agent workforces for sales, support, and ops. Its Invent 2.0 agent interviews you about a process, builds the agents, and sets tests before anything goes live.' },
    { slug: 'copilot-studio', text: 'Copilot Studio is the natural pick for companies on Microsoft 365. Agents publish to Teams, SharePoint, and Microsoft 365 Copilot, under the security and audit controls IT already uses.' },
    { slug: 'agentspot', text: 'AgentSpot lets a team build, share, and schedule agents on company data, with audit trails, and its free plan has no time limit.' },
    { slug: 'velozity', text: 'Velozity is a multiplayer AI office where people and agents work together in shared workspaces.' },
  ], watch: 'Team platforms charge by actions, credits, or usage rather than by seat alone, so estimate how many agent runs you need each month before you commit.' },
  { id: 'developers', heading: 'Best for developers building agents', items: [
    { slug: 'gpt-6-1-terra', text: 'GPT-6.1 Terra is OpenAI\'s fast, low-cost model for computer use agents that fill in forms and act on screens.' },
    { slug: 'minimax-m3-1-flash', text: 'MiniMax M3.1 Flash is a low-cost model for agent workflows, long coding tasks, and computer use.' },
    { slug: 'mercury-3', text: 'Mercury 3 is a diffusion language model that generates more than 1,000 tokens per second, which keeps agent loops fast.' },
    { slug: 'kimi-k3-1-pro', text: 'Kimi K3.1 Pro is an open-weight model for long multi-step agent tasks with a 1M-token context.' },
    { slug: 'firecrawl', text: 'Firecrawl turns websites into LLM-ready markdown, so your agent can read the web or you can prepare data for retrieval.' },
  ], watch: 'These are building blocks, not finished agents. You write the code, choose the framework, and pay per token or per page.' },
  { id: 'private', heading: 'Best private, on-device agent: Local Code', items: [
    { slug: 'local-code', text: 'Local Code, released October 28, 2026 by the makers of Draw Things, runs an agent on your Mac\'s own GPU with Python, Node.js, and a shell built in, so it can work on local files, documents, and slides, even offline.' },
    { slug: 'liquid-lfm3', text: 'Liquid AI LFM3 is a family of small open-weight models for agents that run on a phone or laptop, with tool calling and a 256K context.' },
  ], watch: 'Local models need a lot of memory. Local Code\'s smallest on-device model needs 16 GB, and the larger DeepSeek models need 32 GB or more. Choosing a cloud model in Local Code sends your prompts and files to that provider.' },
]
const AGENT_TASKS = [
  { task: 'Email triage and replies', first: 'lindy', also: ['gumloop', 'claude-duet'] },
  { task: 'Calendar and meeting prep', first: 'lindy', also: ['gumloop', 'claude-duet'] },
  { task: 'CRM updates and sales follow-up', first: 'relevance-ai', also: ['zapier', 'make'] },
  { task: 'Research reports', first: 'manus', also: ['kimi-k3-1-pro'] },
  { task: 'Web data and scraping', first: 'firecrawl', also: ['n8n'] },
  { task: 'Connecting SaaS apps', first: 'zapier', also: ['make', 'n8n'] },
  { task: 'Agents inside Microsoft 365 and Teams', first: 'copilot-studio', also: [] },
  { task: 'Private work on files on your own computer', first: 'local-code', also: ['liquid-lfm3'] },
  { task: 'Personal errands on websites with no integration', first: 'nod', also: ['manus'] },
]

function agentData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const list = all.filter((t) => t.category === 'agents')
  const sections = AGENT_SECTIONS.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, t: find(it.slug) })).filter((it) => it.t) })).filter((g) => g.items.length)
  const tasks = AGENT_TASKS.filter((x) => find(x.first))
  return { all, find, list, sections, tasks }
}

function agentFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI agent builder for non-technical users?',
      a: `${NAME} picks ${r('lindy')} for most non-technical users, since you build agents for email, calendar, and business workflows without code. ${r('gumloop')} and ${r('make')} are strong no-code alternatives, and if your company runs on Microsoft 365, ${r('copilot-studio')} publishes agents straight to Teams and SharePoint.` },
    { q: 'What are the best tools for automating repetitive tasks?',
      a: `For tasks that follow the same steps every time, use a workflow tool: ${r('zapier')} and ${r('make')} connect thousands of apps with no code, and ${r('n8n')} is the pick if you want to self-host. For tasks that need judgment, such as sorting email or drafting replies, an agent builder like ${r('lindy')} or ${r('gumloop')} fits better.` },
    { q: 'Zapier or n8n: which should I use?',
      a: `${r('zapier')} is hosted and no-code, with a free plan of 100 tasks a month and Professional from $19.99 a month billed annually. ${r('n8n')} is more technical: you can self-host the free Community Edition or use n8n Cloud from 20 euros a month billed annually, and cloud plans charge per workflow execution. Pick Zapier for speed and simplicity, and n8n for control, custom code, and keeping data on your own servers.` },
    { q: 'Can I build an AI agent without coding?',
      a: `Yes. ${r('lindy')}, ${r('gumloop')}, ${r('make')}, ${r('copilot-studio')}, and ${r('agentspot')} all let you build agents without writing code. ${r('relevance-ai')} goes a step further: its Invent agent builds agents for you after asking about your process. Nothing on that list needs a developer to get started.` },
    { q: 'Is n8n free?',
      a: `The self-hosted Community Edition of ${r('n8n')} is free to use; you pay only for your own server. n8n Cloud is paid, starting at 20 euros a month billed annually, with a free trial that needs no card. The Community Edition uses a fair-code license, so read the terms if you plan to build a commercial service on top of it.` },
    ...(find('nod') ? [{ q: 'Is there a free, open-source personal AI agent?',
      a: `Yes. ${r('nod')} from n8n Labs is free and open source under Apache 2.0, released as a research preview on November 10, 2026. It runs on your Mac, Windows PC, or your own server inside a private sandbox with its own browser, and a separate check confirms you asked for an action before it sends, pays, posts, or deletes anything. The app is free, but you pay your own AI provider for usage, or you can connect an open-source model running on your computer.` }] : []),
    { q: 'What is the difference between an AI agent and an automation?',
      a: 'An automation follows fixed steps you define: when a form is submitted, add a row and send an email. An AI agent gets a goal and decides the steps itself, using tools and judgment along the way. Many tools now mix both, running fixed workflows with AI steps or agents inside them.' },
  ]
}

app.get(AGENT_PATH, (c) => {
  const PD = pageDate(AGENT_PATH)
  const SD = SECTION_DATES[AGENT_PATH] || PD
  const d = agentData()
  const { find, list, sections, tasks } = d
  if (!list.length) return c.notFound()
  const faq = agentFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `For most people, start with ${f('lindy')}, a no-code agent builder for email, calendar, and business workflows. To connect apps with fixed steps, use ${f('zapier')} or ${f('make')}, or self-host ${f('n8n')}. For an agent that takes a goal and works through the steps itself, try ${f('manus')}, and for companies on Microsoft 365, look at ${f('copilot-studio')}`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const checked = AGENT_PRICE_CHECKED.map(find).filter(Boolean).map((t) => t.name)
  const description = `Best AI agent builders and automation tools in 2026: Lindy, Zapier, Make, n8n, Manus, Copilot Studio and ${list.length - 6} more, compared by no-code or technical, best use, and pricing. Updated ${fmtDate(PD)}.`
  const title = `Best AI Agent Builders and Automation Tools in 2026 | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Agents</span></div>
    <h1>${esc(AGENT_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${list.length} agent and automation tools ranked · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(list)}
  <section class="section" id="at-a-glance">
    <h2>At a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Type</th><th>Best for</th><th>Pricing note</th></tr></thead>
        <tbody>${list.map((t) => `<tr><td>${link(t)}</td><td>#${t.rank}</td><td>${esc(AGENT_TYPES[t.slug] || 'Agent tool')}</td><td>${esc(listNames(t.bestFor || []))}</td><td>${esc(t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Ranks are overall ${esc(NAME)} ranks across every category, listed in the same order as the <a href="/category/agents">agents category</a>. Pricing for ${esc(listNames(checked))} was checked against official pricing pages or launch posts on ${fmtDate(SD)}; other notes come from each tool's listing. Prices change often, so check the official site before you buy.</p>
  </section>
  ${sections.map((g) => `<section class="section" id="${esc(g.id)}">
    <h2>${esc(g.heading)}</h2>
    <div class="panel prose">
      ${g.items.map((it, i) => `<h3 style="${i ? '' : 'margin-top:0;'}color:var(--text)">${link(it.t)} (#${it.t.rank} overall)</h3>
      <p>${esc(it.t.tagline)}. ${esc(it.text)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(it.t.bestFor || []))}. <strong>Pricing:</strong> ${esc(it.t.pricingNote)}.</p>`).join('')}
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(g.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="by-task">
    <h2>Pick by task</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Task</th><th>Start with</th><th>Also consider</th></tr></thead>
        <tbody>${tasks.map((x) => `<tr><td>${esc(x.task)}</td><td>${rl(x.first)}</td><td>${x.also.map(rl).filter(Boolean).join(', ') || 'None yet'}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </section>
  <section class="section" id="builder-vs-automation">
    <div class="panel prose">
      <h2 style="margin-top:0">Agent builder, automation tool, or autonomous agent?</h2>
      <p>An <strong>automation tool</strong> runs fixed steps you define: when something happens in one app, do these things in others. ${rl('zapier')}, ${rl('make')}, and ${rl('n8n')} started here, and all now add AI steps or agents inside workflows.</p>
      <p>An <strong>agent builder</strong> lets you set up an AI agent with instructions, tools, and limits, then let it decide the steps for each case. ${rl('lindy')}, ${rl('gumloop')}, ${rl('relevance-ai')}, and ${rl('copilot-studio')} work this way, with no code or low code.</p>
      <p>An <strong>autonomous agent</strong> is ready to use: you give it a goal and it plans and does the work. ${rl('manus')} and ${rl('claude-duet')} are examples, and ${rl('local-code')} does the same on your own Mac. ${rl('nod')} is an open-source personal agent that runs in its own sandbox on your Mac or Windows PC with the AI provider you choose.</p>
      <p>Want an agent that builds a whole app? ${rl('replit-agent')} builds and deploys apps in Replit, and the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a> compares it with other app builders.</p>
      <h2 id="how-we-rank">How we rank</h2>
      <p>This page lists every tool in the ${esc(NAME)} <a href="/category/agents">agents category</a>, using the same editorial ranks as the rest of the site. Featured listings do not affect rank. We do not run lab tests or publish benchmark scores; the ranking is a maintained editorial list that we update as tools ship. On a budget? See the <a href="/best/free-ai-tools#automation">best free AI tools for automation</a>. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: AGENT_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: AGENT_H1,
        description,
        url: `${SITE}${AGENT_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI agent builders and automation tools on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Agents', '/category/agents'], ['AI agent builders', AGENT_PATH]])],
    },
  }))
})

// AI tools for small business guide (brief 9). A starter stack by job, built from
// tools across categories. Names, ranks, taglines, best-for tags, and pricing notes
// come from tools.json so the page tracks the live ranks. Pricing for the tools in
// SMB_PRICE_CHECKED was checked on official pricing pages on 2026-11-01.
const SMB_PATH = '/best/ai-tools-for-small-business'
const SMB_H1 = 'Best AI Tools for Small Business: A Starter Stack by Job'
const SMB_PRICE_CHECKED = ['chatgpt', 'grammarly', 'notion-ai', 'jasper', 'canva', 'lindy']
const SMB_STACK = [
  { job: 'Writing, email, and everyday questions', slug: 'chatgpt' },
  { job: 'Graphics, social posts, and presentations', slug: 'canva' },
  { job: 'Notes, docs, and meeting summaries', slug: 'notion-ai' },
  { job: 'Connecting apps and automating admin', slug: 'zapier' },
  { job: 'Research you can check', slug: 'perplexity' },
]
const SMB_SECTIONS = [
  { id: 'writing-and-email', heading: 'Everyday writing and email: ChatGPT, Claude, and Grammarly', items: [
    { slug: 'chatgpt', text: 'ChatGPT is the broadest place to start. One app drafts emails and posts, answers questions, summarizes documents, and makes images, and the free plan is enough to learn what it does well before anyone pays.' },
    { slug: 'claude', text: 'Claude is a strong second assistant for careful writing and long documents, such as reading a proposal, a contract, or a long customer thread and drafting a reply.' },
    { slug: 'grammarly', text: 'Grammarly checks spelling, grammar, clarity, and tone where you already type, including email and the browser, so it helps people who never open a chat assistant.' },
  ], watch: 'AI drafts can sound generic or get facts wrong. Have a person read anything that goes to a customer, and keep passwords and payment details out of prompts.' },
  { id: 'marketing-copy', heading: 'Marketing copy in your brand voice: Jasper', items: [
    { slug: 'jasper', text: 'Jasper is built for marketing teams, with brand voice controls so campaign copy, product descriptions, and posts sound like your business. It makes the most sense once you publish marketing content every week, or several people write for the brand.' },
  ], watch: 'Jasper is priced per seat and costs more than a general assistant. Try ChatGPT or Claude for marketing drafts first, and move to Jasper when keeping one voice across writers becomes the problem.' },
  { id: 'notes-and-meetings', heading: 'Notes, wikis, and meeting summaries: Notion AI and Fireflies', items: [
    { slug: 'notion-ai', text: 'If your team already keeps docs, wikis, or projects in Notion, Notion AI drafts and summarizes pages and answers questions over what you have written. The Business plan adds AI Meeting Notes.' },
    { slug: 'fireflies', text: 'Fireflies joins Zoom, Google Meet, and Microsoft Teams calls to record, transcribe, and summarize them, and it can send notes and action items to your CRM or Slack.' },
  ], watch: 'Tell people when a call is recorded, and check the recording laws where you and your callers are. Check names, numbers, and dates in AI notes before you act on them.' },
  { id: 'automating-admin', heading: 'Automating admin: Zapier, Lindy, and Claude Duet', items: [
    { slug: 'zapier', text: 'Zapier connects the apps you already pay for. When a form is filled in, a payment comes through, or an email arrives, it can add a row, create a task, or send a message, with AI steps for sorting and drafting along the way.' },
    { slug: 'lindy', text: 'Lindy builds AI agents for admin that needs judgment, such as sorting the inbox, drafting replies, and handling scheduling, without code.' },
    { slug: 'claude-duet', text: 'Claude Duet is Anthropic\'s proactive agent. It sends a short brief from your connected apps, works on tasks in the background, and asks before it sends, pays, or deletes anything.' },
  ], watch: 'Start with one small, low-risk workflow and check its results for a while before you let it contact customers on its own. Claude Duet is a research preview with a waitlist, so most people cannot use it yet.' },
  { id: 'social-and-graphics', heading: 'Social video and graphics: Canva, CapCut, Ideogram, and Adobe Firefly', items: [
    { slug: 'canva', text: 'Canva is the easiest starting point for small business graphics: social posts, flyers, presentations, and brand kits from templates, with Canva AI for edits. Canva Brush, announced October 29, 2026 for Canva Pro subscribers, can restyle an image or turn a slide into an Instagram graphic, and the result stays editable.' },
    { slug: 'capcut', text: 'CapCut is a popular editor for short-form social video, with AI captions and effects for quick edits.' },
    { slug: 'ideogram', text: 'Ideogram generates images with readable text, which helps with posters, sale graphics, and logo drafts.' },
    { slug: 'adobe-firefly', text: 'Adobe Firefly works inside Adobe apps and is trained with commercial use in mind, which suits a business that already pays for Adobe.' },
  ], watch: 'Check each tool\'s license before you use AI images in ads or on products, and do not generate images that copy another brand\'s logo or a real person\'s likeness.' },
  { id: 'research', heading: 'Research and competitor checks: Perplexity', items: [
    { slug: 'perplexity', text: 'Perplexity answers questions with live web sources and citations, so you can see where a claim came from. It suits supplier comparisons, pricing research, and keeping an eye on competitors.' },
  ], watch: 'Open the sources before you rely on an answer, especially for legal, tax, or financial questions.' },
  { id: 'ai-answers', heading: 'Showing up in AI answers: ReSO AI', items: [
    { slug: 'reso-ai', text: 'Customers can now ask AI assistants for product and service recommendations. ReSO AI tracks how brands show up in those AI answers and in generative search, so you can see where you are missing.' },
  ], watch: 'This is a newer kind of tool. Get the basics right first: a clear website, accurate business listings, and pages that answer the questions your customers ask.' },
  { id: 'simple-app-or-site', heading: 'Building a simple app or site: Lovable', items: [
    { slug: 'lovable', text: 'Lovable turns a plain-language description into a working web app, which suits a booking form, an internal tracker, or a first version of a product idea without hiring a developer.' },
  ], watch: 'Anything that takes payments or stores customer data needs a careful security review before it goes live.' },
]

function smbData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const stack = SMB_STACK.map((x) => ({ ...x, t: find(x.slug) })).filter((x) => x.t)
  const sections = SMB_SECTIONS.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, t: find(it.slug) })).filter((it) => it.t) })).filter((g) => g.items.length)
  const seen = new Set()
  const list = []
  for (const x of [...stack.map((s) => s.t), ...sections.flatMap((g) => g.items.map((it) => it.t))]) if (!seen.has(x.slug)) { seen.add(x.slug); list.push(x) }
  return { all, find, stack, sections, list }
}

function smbFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What AI tool should a small business use first?',
      a: `Start with one general assistant, such as ${r('chatgpt')} or ${r('claude')}, for writing, email, and everyday questions, since one tool covers many jobs. Add ${r('canva')} for graphics, and ${r('zapier')} once you notice the same admin steps repeating every week.` },
    { q: 'What is the best free AI tool for a small business?',
      a: `${r('chatgpt')}, ${r('claude')}, ${r('canva')}, ${r('grammarly')}, ${r('perplexity')}, and ${r('zapier')} all have free plans, so a small team can try a full starter stack before paying for anything. See the best free AI tools guide on ${NAME} for more free options by job.` },
    { q: 'Can AI answer customer emails?',
      a: `It can draft them well, and a person should approve them, at least at first. ${r('chatgpt')} and ${r('claude')} draft replies you paste in, and ${r('lindy')} can sort an inbox and draft replies in your voice. Keep a person reviewing anything about refunds, complaints, or account details.` },
    { q: 'What is the best AI tool for small business marketing?',
      a: `For copy, a general assistant is enough for occasional posts, and ${r('jasper')} fits when you publish often and want brand voice controls. For visuals, use ${r('canva')} for graphics and ${r('capcut')} for short video. To see how your business appears in AI answers, look at ${r('reso-ai')}.` },
    { q: 'Is it safe to put customer data into AI tools?',
      a: 'It depends on the tool and the plan. Read each vendor\'s data policy and check whether your data can be used to train models, prefer business or team plans that add admin controls, and keep passwords, card numbers, and sensitive customer records out of prompts. This is not legal advice; check the privacy rules that apply to your business.' },
    { q: 'How much do AI tools cost for a small business?',
      a: `Many start free. Paid plans on this page include ${r('grammarly')} Pro from $12 a month, ${r('zapier')} Professional from $19.99 a month billed annually, ${r('notion-ai')} on the Notion Business plan from $20 per member a month, ${r('lindy')} from $29.99 per active user a month, and ${r('jasper')} Pro at $59 per seat a month billed yearly. Prices change often, so check each official pricing page before you buy.` },
  ]
}

app.get(SMB_PATH, (c) => {
  const PD = pageDate(SMB_PATH)
  const SD = SECTION_DATES[SMB_PATH] || PD
  const d = smbData()
  const { find, stack, sections, list } = d
  if (!stack.length) return c.notFound()
  const faq = smbFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `A simple starter stack for a small business is ${f('chatgpt')} for writing, email, and questions, ${f('canva')} for graphics and social posts, ${f('notion-ai')} for notes and meeting summaries, ${f('zapier')} for connecting apps and automating admin, and ${f('perplexity')} for research with sources. All five have a free plan or trial, so you can start at no cost and pay only for the ones your team uses`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const checked = SMB_PRICE_CHECKED.map(find).filter(Boolean).map((t) => t.name)
  const description = `Best AI tools for small business in 2026: a starter stack of ChatGPT, Canva, Notion AI, Zapier and Perplexity, plus ${list.length - 5} more picks by job, with pricing notes. Updated ${fmtDate(PD)}.`
  const title = `Best AI Tools for Small Business: A Starter Stack by Job | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Small business</span></div>
    <h1>${esc(SMB_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · ${list.length} tools picked by job · <a href="/methodology">How we rank</a></p>
    <p>BuildStack is run by tier11. If you want help picking tools and rolling them out safely, email <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a>.</p>
  </section>
  ${glanceSection(list)}
  <section class="section" id="starter-stack">
    <h2>The starter stack</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Job</th><th>Tool</th><th>Rank</th><th>Pricing note</th></tr></thead>
        <tbody>${stack.map((x) => `<tr><td>${esc(x.job)}</td><td>${link(x.t)}</td><td>#${x.t.rank}</td><td>${esc(x.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Ranks are overall ${esc(NAME)} ranks across every category. Pricing for ${esc(listNames(checked))} was checked against official pricing pages on ${fmtDate(SD)}; other notes come from each tool's listing. Prices change often, so check the official site before you buy.</p>
  </section>
  ${sections.map((g) => `<section class="section" id="${esc(g.id)}">
    <h2>${esc(g.heading)}</h2>
    <div class="panel prose">
      ${g.items.map((it, i) => `<h3 style="${i ? '' : 'margin-top:0;'}color:var(--text)">${link(it.t)} (#${it.t.rank} overall)</h3>
      <p>${esc(it.t.tagline)}. ${esc(it.text)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(it.t.bestFor || []))}. <strong>Pricing:</strong> ${esc(it.t.pricingNote)}.</p>`).join('')}
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(g.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="roll-out">
    <div class="panel prose">
      <h2 style="margin-top:0">How to roll out AI in a small team</h2>
      <ul class="clean">
        <li><strong>Pick one job first.</strong> Choose a task that comes up every week, such as customer email replies or social posts, and try one tool for it before adding more.</li>
        <li><strong>Start free.</strong> Use free plans and trials, and pay only when people use a tool regularly. The <a href="/best/free-ai-tools">best free AI tools</a> guide lists free options by job.</li>
        <li><strong>Write down simple rules.</strong> Agree what data can go into AI tools (no passwords, card numbers, or sensitive customer records) and who checks AI output before it reaches a customer.</li>
        <li><strong>Use business plans for shared data.</strong> Team and business plans usually add admin controls and clearer data terms, which matters once several people share customer information.</li>
        <li><strong>Automate last.</strong> Once a manual process works, automate it with the tools in the <a href="/best/ai-agent-builder">best AI agent builders and automation tools</a> guide, and keep a person reviewing the results at first.</li>
        <li><strong>Review costs every month.</strong> Seat and credit pricing adds up, so cancel tools nobody uses.</li>
      </ul>
      <p>Want more choices? Browse the <a href="/category/writing">writing tools</a> and <a href="/category/agents">agent and automation tools</a> categories.</p>
      <h2 id="how-we-rank">How we rank</h2>
      <p>This page picks tools from across the ${esc(NAME)} categories for common small business jobs, and shows each one's overall editorial rank from the rest of the site. Featured listings do not affect rank or which tools appear here. We do not run lab tests or publish benchmark scores; the ranking is a maintained editorial list that we update as tools ship. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: SMB_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: SMB_H1,
        description,
        url: `${SITE}${SMB_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI tools for small business on BuildStack',
        itemListOrder: 'https://schema.org/ItemListUnordered',
        numberOfItems: list.length,
        itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Guides', '/#guides'], ['AI tools for small business', SMB_PATH]])],
    },
  }))
})

// AI transcription tool guide (brief 10). Names, ranks, taglines, best-for tags,
// and pricing notes come from tools.json, so the page tracks the live ranks and
// the pricing notes checked against each official pricing page or launch post
// (Otter, Descript, Riverside, Deepgram, Mistral Voxtral 3, and OpenAI rechecked
// on 2026-11-02). The page does not rank tools by accuracy.
const TRANS_TYPES = {
  editor: 'Recording and editing app',
  app: 'Meeting notetaker app',
  workspace: 'Workspace AI with meeting notes',
  api: 'Developer API',
  open: 'Open weights you run yourself',
  both: 'Developer API and open weights',
}
const TRANS_PICKS = [
  { slug: 'descript', type: 'editor', id: 'best-for-editing', heading: 'Best for editing podcasts and video by transcript', role: 'Best for editing podcasts and talking-head video by editing the transcript',
    why: "Descript transcribes your recording in 25 languages, labels speakers (it can detect 8 or more), and lets you cut audio and video by deleting words in the transcript. It can also remove filler words and translate captions into 61 languages.",
    watch: 'Transcription counts against your monthly media hours, and the Free plan includes 1 media hour a month, so a backlog of long recordings needs a paid plan.' },
  { slug: 'otter', type: 'app', id: 'best-for-meetings', heading: 'Best for meeting transcripts and summaries', role: 'Best for live meeting transcripts, summaries, and searching past meetings',
    why: 'Otter joins Zoom, Microsoft Teams, and Google Meet calls, transcribes them live with speaker identification, and writes summaries with action items. You can chat with your meetings, search across them, and connect them to other assistants through the Otter MCP server.',
    watch: 'The Basic plan includes 300 transcription minutes a month but only 3 lifetime file imports, so it suits live meetings more than uploading old recordings.' },
  { slug: 'fireflies', type: 'app', id: 'meetings-and-uploads', heading: 'Best for meetings plus uploaded audio files', role: 'Best for teams that want meeting notes and uploaded file transcripts in one place',
    why: 'Fireflies records and transcribes calls on Zoom, Google Meet, Microsoft Teams, and more, and it also transcribes audio and video files you upload. Notes, action items, and search are shared across your team, and it can send call notes to CRMs and Slack.',
    watch: 'Fireflies says English is its primary language, with Spanish, French, Portuguese, Italian, and 100+ other languages in beta, so test your language first.' },
  { slug: 'riverside', type: 'editor', id: 'best-for-interviews', heading: 'Best for recording interviews and podcasts', role: 'Best for recording remote interviews and podcasts with transcripts built in',
    why: 'Riverside records multitrack audio and video at up to 4K, transcribes the session automatically, and lets you edit by cutting the transcript. Its new Riverside Agents, launched October 26, 2026, can prep a session, plan the edit, find clips, and draft show notes, and nothing publishes without your sign-off.',
    watch: 'Riverside is built around recording in its own studio. If you only need to transcribe files you already have, a notetaker or an API is simpler.' },
  { slug: 'deepgram', type: 'api', id: 'best-api', heading: 'Best transcription API for apps', role: 'Best for developers who need fast, per-second-billed speech to text in their own product',
    why: 'Deepgram offers pre-recorded and streaming transcription through one API, billed per second. Since October 23, 2026 its Nova-3 Multilingual model covers 55 languages in a single model and handles speakers switching languages mid-conversation, and diarization is included on pre-recorded audio.',
    watch: 'It is an API, not an app, so you need a developer. The 55-language model is for the hosted service; self-hosted Nova-3 Multilingual stays at 10 languages.' },
  { slug: 'mistral-voxtral-3', type: 'api', id: 'low-cost-api', heading: 'Best low-cost API with speaker labels', role: 'Best for low-cost multilingual transcription with speaker labels',
    why: 'Voxtral 3, released October 20, 2026, transcribes 50+ languages, labels who said what, and accepts key terms to improve recall on names and jargon. Voxtral Mini Transcribe 3 costs $0.0035 per minute in batch, and Mistral offers EU, US, and global endpoints or self-deployment.',
    watch: 'The realtime transcription model costs more ($0.008 per minute) and covers fewer languages than batch.' },
  { slug: 'nvidia-nemotron-transcribe', type: 'open', id: 'best-open-model', heading: 'Best open model for long recordings with speakers', role: 'Best open-weight model for long recordings that need speaker labels',
    why: 'Nemotron 3.5 Transcribe, released October 28, 2026, transcribes 40 languages, labels up to 8 speakers in recordings up to an hour long, and can answer questions about the audio. NVIDIA reports it ranks first among open-weight models on the Hugging Face Open ASR Leaderboard for English.',
    watch: 'It is built for recorded audio, not live streaming, and the full model needs a data center GPU unless you use the smaller FP8 or NVFP4 versions.' },
  { slug: 'ibm-granite-speech-5', type: 'open', id: 'on-device-and-translation', heading: 'Best open model for on-device transcription and translation', role: 'Best for fast on-device transcription and translation under Apache 2.0',
    why: 'Granite Speech 5.0, released October 21, 2026, includes a 2B model that transcribes six languages and translates to and from English, plus a 470M Turbo model built for speed. Everything is Apache 2.0, so you can run it on your own hardware and keep audio private.',
    watch: 'The 2B model covers English, French, German, Spanish, Portuguese, and Japanese only, so check your language first.' },
  { slug: 'openai-whisper', type: 'both', id: 'original-open-model', heading: 'The original open model, also on the OpenAI API', role: 'The widely used open speech model, also available through the OpenAI API',
    why: "Whisper is OpenAI's speech recognition model for transcription and translation. The open-source models are free to run yourself and power many other apps, and the OpenAI API offers Whisper alongside newer transcription models.",
    watch: 'On the OpenAI API, newer models such as gpt-transcribe are priced below Whisper. Running Whisper yourself means supplying your own hardware.' },
  { slug: 'notion-ai', type: 'workspace', id: 'meetings-in-your-workspace', heading: 'Best for meeting notes inside your workspace', role: 'Best for teams that want meeting notes saved next to their docs and wiki',
    why: 'Notion AI Meeting Notes keep transcripts and summaries inside your Notion workspace, where Notion AI can answer questions over them along with the rest of your docs.',
    watch: 'AI Meeting Notes come with the Business plan; the Free and Plus plans only include a trial of Notion AI.' },
]
const TRANS_PATH = '/best/ai-transcription-tool'
const TRANS_H1 = 'Best AI Transcription Tools in 2026, for Creators and Developers'

function transData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = TRANS_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function transFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the most accurate AI transcription tool?',
      a: `There is no single answer, because accuracy depends on your audio: accents, background noise, crosstalk, and jargon all matter. Vendors publish their own benchmarks, for example NVIDIA reports that ${r('nvidia-nemotron-transcribe')} ranks first among open-weight models on the Hugging Face Open ASR Leaderboard for English, and IBM reports ${r('ibm-granite-speech-5')} ranks second. ${NAME} does not rank by accuracy; test a short clip of your own audio in two or three tools before you commit.` },
    { q: 'Is there a free AI transcription tool?',
      a: `Yes. ${r('otter')} has a free Basic plan with 300 transcription minutes a month, ${r('descript')} has a free plan with 1 media hour a month, and ${r('fireflies')} has a free plan. Developers get $200 of free credit at ${r('deepgram')}. Open models such as ${r('openai-whisper')}, ${r('ibm-granite-speech-5')}, and ${r('nvidia-nemotron-transcribe')} are free to run if you have the hardware.` },
    { q: 'Which transcription tool can run locally for privacy?',
      a: `Open-weight models run on your own hardware, so audio never leaves your machine: ${r('openai-whisper')} has open-source models, ${r('ibm-granite-speech-5')} is Apache 2.0 with a small Turbo model built for speed, and ${r('nvidia-nemotron-transcribe')} has FP8 and NVFP4 versions for local RTX and DGX Spark machines. ${r('mistral-voxtral-3')} can also be self-deployed, and ${r('deepgram')} offers self-hosting on Enterprise plans.` },
    { q: 'What is the best transcription API for developers?',
      a: `${r('deepgram')} is the most complete API on this page, with pre-recorded and streaming transcription from $0.0043 per minute and per-second billing. ${r('mistral-voxtral-3')} is the lowest published price here at $0.0035 per minute for batch transcription with speaker labels. On the OpenAI API, Whisper is $0.006 per minute and gpt-transcribe is $0.0045 per minute.` },
    { q: 'Can AI transcription tell multiple speakers apart?',
      a: `Yes, this is called diarization. ${r('otter')} and ${r('descript')} label speakers in the app, ${r('mistral-voxtral-3')} and ${r('deepgram')} return speaker labels through their APIs, and ${r('nvidia-nemotron-transcribe')} labels up to 8 speakers in recordings up to an hour long. Speaker labels work best when people do not talk over each other.` },
  ]
}

app.get(TRANS_PATH, (c) => {
  const PD = pageDate(TRANS_PATH)
  const SD = SECTION_DATES[TRANS_PATH] || PD
  const d = transData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = transFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `To edit podcasts and video by transcript, start with ${f('descript')}. For meeting transcripts and summaries, use ${f('otter')} or ${f('fireflies')}. Developers adding speech to text to an app should look at ${f('deepgram')} or the lower-cost ${f('mistral-voxtral-3')}, and to keep audio private on your own hardware, run ${f('nvidia-nemotron-transcribe')} or ${f('ibm-granite-speech-5')}`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const description = `Best AI transcription tools in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with verified pricing for meetings, podcasts, and developer APIs. Updated ${fmtDate(PD)}.`
  const title = `Best AI Transcription Tools in 2026 | ${NAME}`
  const useCases = [
    ['Meetings', `${rl('otter')} and ${rl('fireflies')} join your calls and send notes afterward. If your team lives in Notion, ${rl('notion-ai')} keeps meeting notes next to your docs.`],
    ['Interviews and podcasts', `Record with ${rl('riverside')} to get multitrack recordings and a transcript, then edit by transcript in ${rl('descript')} or in Riverside itself.`],
    ['Subtitles and captions', `${rl('descript')} translates captions into 61 languages. For a do-it-yourself pipeline, ${rl('openai-whisper')} is a common starting point for subtitle drafts.`],
    ['Apps and products', `${rl('deepgram')} covers pre-recorded and streaming audio in one API, and ${rl('mistral-voxtral-3')} has the lowest published per-minute price on this page.`],
    ['Sensitive audio', `Run ${rl('nvidia-nemotron-transcribe')}, ${rl('ibm-granite-speech-5')}, or open-source ${rl('openai-whisper')} on your own hardware so recordings never leave it.`],
  ]
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Voice</span></div>
    <h1>${esc(TRANS_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing from official pages, most rechecked on ${fmtDate(SD)} · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI transcription tools at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>App or model</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(TRANS_TYPES[p.type])}</td><td>${esc(listNames(p.t.bestFor || []))}</td><td>${esc(p.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices come from each official pricing page or launch post. Transcription pricing changes often, so check the official site before you buy.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.t.pricingNote)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="by-use-case">
    <div class="panel prose">
      <h2 style="margin-top:0">Pick by use case</h2>
      <ul class="clean">
        ${useCases.map(([h, txt]) => `<li><strong>${esc(h)}:</strong> ${txt}</li>`).join('')}
      </ul>
      <h2 id="privacy">Privacy: cloud or local?</h2>
      <p><strong>Cloud tools</strong> are the easiest way to start, but your audio is uploaded to the vendor. Check where it is processed and whether it is used for training. Fireflies says it does not train AI models on customer data, Descript is SOC 2 Type II compliant, ${rl('deepgram')} has a dedicated EU endpoint, and ${rl('mistral-voxtral-3')} offers EU, US, and global endpoints.</p>
      <p><strong>Local models</strong> keep audio on hardware you control, which suits legal, medical, and other sensitive recordings. ${rl('nvidia-nemotron-transcribe')}, ${rl('ibm-granite-speech-5')}, and open-source ${rl('openai-whisper')} are free to run; you trade convenience and setup time for control.</p>
      <h2>How we chose</h2>
      <p>This page covers the tools ranked on ${NAME} that transcribe speech. Ranks are the same editorial ranks used across the site; featured listings do not affect rank, and we do not rank by accuracy, since results depend on your audio. Transcription services that are not yet ranked on ${NAME}, such as Rev, are left out until they are reviewed. For text to speech and voiceovers, see the <a href="/best/ai-voice-generator">best AI voice generators</a>, or browse the full <a href="/category/voice">voice category</a>. For free options across every category, see the <a href="/best/free-ai-tools#voice">best free AI tools</a>. Read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: TRANS_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: TRANS_H1,
        description,
        url: `${SITE}${TRANS_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI transcription tools on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Voice', '/category/voice'], ['AI transcription tools', TRANS_PATH]])],
    },
  }))
})

// AI writing tool guide (brief 11). Names, ranks, taglines, best-for tags, and
// pricing notes come from tools.json, so the page tracks the live ranks and the
// pricing notes checked against each official pricing page (Claude, Grok, and
// Ideogram rechecked on 2026-11-03). The page does not score writing quality.
const WRITE_PICKS = [
  { slug: 'claude', id: 'best-overall', heading: 'Best overall AI writing tool', role: 'Best overall for careful, long-form writing',
    why: 'Claude is strong at nuanced writing and long-document work: you can paste in research, transcripts, or a style guide and ask for a draft that follows it. Even the Free plan includes Projects (up to 5), memory across conversations, web search, and Claude Docs, and paid plans add more usage and more models.',
    watch: 'Every plan has usage limits that reset every 5 hours and every week, so very long drafting sessions can hit a limit on Free or Pro.' },
  { slug: 'chatgpt', id: 'best-all-rounder', heading: 'Best all-rounder for writing plus everything else', role: 'Best all-rounder when writing is one of many jobs',
    why: 'ChatGPT is the broadest everyday assistant: drafting, rewriting, brainstorming, browsing for sources, and generating images all happen in one place, so it suits people who write a little of everything.',
    watch: 'Its default style can sound generic. Give it examples of your own writing and ask it to match them, then edit the result.' },
  { slug: 'grok', id: 'best-real-time', heading: 'Best for timely and social posts', role: 'Best for writing about what is happening right now',
    why: 'Grok searches the web and X live with citations, which helps when a post depends on current news or trends, and it has a Canvas for long-form editing with inline suggestions. It works in 30+ languages.',
    watch: 'Real-time posts on X are not always accurate. Check claims against the primary source before you publish.' },
  { slug: 'grammarly', id: 'best-editing', heading: 'Best for editing and tone', role: 'Best for polishing grammar, clarity, and tone wherever you write',
    why: 'Grammarly checks grammar, clarity, and tone across browsers and documents, so it fits the last step of almost any workflow, including drafts written by another AI tool.',
    watch: 'The free plan includes 100 AI prompts a month; heavier rewriting needs Pro.' },
  { slug: 'jasper', id: 'best-marketing-teams', heading: 'Best for marketing teams and brand voice', role: 'Best for marketing teams that need on-brand copy at scale',
    why: 'Jasper is built for marketing teams, with brand voice controls and campaign workflows so many people can produce copy that sounds like one company.',
    watch: 'It is priced per seat for teams, so it is more than most solo bloggers need. Start with the 7-day free trial.' },
  { slug: 'notion-ai', id: 'best-in-notes', heading: 'Best for writing inside your notes and wiki', role: 'Best for drafting and summarizing inside a Notion workspace',
    why: 'Notion AI drafts, summarizes, and answers questions over your Notion pages, so you can turn meeting notes or research already in your workspace into a first draft without copying anything out.',
    watch: 'The Free and Plus plans only include a trial of Notion AI; full access comes with the Business plan.' },
  { slug: 'mintlify-autopilot', id: 'best-product-docs', heading: 'Best for product documentation', role: 'Best for keeping product docs in sync with your code',
    why: 'Mintlify Autopilot, launched in beta on October 20, 2026, watches your repos and tools like Slack and support tickets, drafts doc updates when code merges, and opens a pull request for your team to review. Nothing publishes until someone merges it.',
    watch: 'It is for teams that host docs on Mintlify, and it is in beta on Pro and Enterprise plans only.' },
]
const WRITE_WORKFLOW = [
  { slug: 'perplexity', name: 'Research with sources', text: 'Use Perplexity to gather facts with citations, and save the links you plan to use.' },
  { slug: 'claude', name: 'Outline and draft', text: 'Paste your notes and sources into Claude or ChatGPT, ask for an outline first, fix it, then ask for a draft section by section.' },
  { slug: 'grammarly', name: 'Edit and polish', text: 'Rewrite the draft in your own words where it sounds generic, then run Grammarly for grammar, clarity, and tone.' },
  { slug: 'ideogram', name: 'Add images', text: 'Create a header image or diagram with Ideogram, which is known for readable text inside images.' },
  { slug: '', name: 'Fact-check and publish', text: 'Check every number, name, and quote against the source before you publish, including your title and meta description.' },
]
const WRITE_PATH = '/best/ai-writing-tool'
const WRITE_H1 = 'Best AI Writing Tools in 2026 (and the Best for Blog Posts)'
const GOOGLE_AI_GUIDANCE = 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content'

function writeData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = WRITE_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function writeFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI writing tool?',
      a: `For most people, ${r('claude')} is the best overall AI writing tool on ${NAME}, with ${r('chatgpt')} close behind as the best all-rounder. For editing and tone, add ${r('grammarly')}; for marketing teams that need one brand voice, look at ${r('jasper')}.` },
    { q: 'What is the best AI for writing blog posts?',
      a: `Use a short workflow rather than one tool: research with ${r('perplexity')}, outline and draft in ${r('claude')} or ${r('chatgpt')}, polish with ${r('grammarly')}, and make images with ${r('ideogram')}. Then fact-check before you publish.` },
    { q: 'Is Claude or ChatGPT better for writing?',
      a: `Both are strong. ${NAME} ranks ${r('claude')} just ahead of ${r('chatgpt')}: Claude is the pick for careful long-form drafts and working from long documents, while ChatGPT is the better all-rounder if you also want browsing and image generation in the same place. Both have free plans, so try the same prompt in each before you pay.` },
    { q: 'Will Google penalize AI-written blog posts?',
      a: `Google's Search Central guidance on generative AI content does not ban AI-assisted writing. It says generative AI can be useful for research and for adding structure to original content, but that using it to generate many pages without adding value for users may violate its spam policy on scaled content abuse. It also asks you to fact-check AI output, including titles, meta descriptions, and structured data, and to focus on accuracy, quality, and relevance. Read the full guidance at ${GOOGLE_AI_GUIDANCE}.` },
    { q: 'What is the best free AI writing tool?',
      a: `${r('claude')} and ${r('chatgpt')} both have free plans that are enough for drafting blog posts and emails, ${r('grok')} is free to try on grok.com, and ${r('grammarly')} has a free plan with 100 AI prompts a month for editing. See the full list of free options in our free AI tools guide.` },
    { q: 'Can AI match my brand voice?',
      a: `Yes, with some setup. ${r('jasper')} has brand voice controls built for marketing teams. With ${r('claude')} or ${r('chatgpt')}, paste a few examples of your best writing and a short style guide, ask the tool to describe your voice, and reuse that description in every prompt. Expect to edit the first drafts.` },
  ]
}

app.get(WRITE_PATH, (c) => {
  const PD = pageDate(WRITE_PATH)
  const d = writeData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = writeFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `The best AI writing tool for most people is ${f('claude')}, with ${f('chatgpt')} as the best all-rounder. Add ${f('grammarly')} for editing and tone, ${f('jasper')} if a marketing team needs one brand voice, and ${f('notion-ai')} if you write inside Notion. For blog posts, research with ${f('perplexity')}, draft in Claude or ChatGPT, polish with Grammarly, and fact-check before you publish`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const steps = WRITE_WORKFLOW.map((s) => ({ ...s, t: s.slug ? find(s.slug) : null }))
  const description = `Best AI writing tools in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, plus a blog post workflow and verified pricing. Updated ${fmtDate(PD)}.`
  const title = `Best AI Writing Tools in 2026 (and for Blog Posts) | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Writing</span></div>
    <h1>${esc(WRITE_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing from official pages · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI writing tools at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Our pick for</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.role)}</td><td>${esc(listNames(p.t.bestFor || []))}</td><td>${esc(p.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices come from each official pricing page. AI pricing changes often, so check the official site before you buy.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.t.pricingNote)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="blog-posts">
    <div class="panel prose">
      <h2 style="margin-top:0">Best AI tools for blog posts: a 5-step workflow</h2>
      <ol>
        ${steps.map((s) => `<li><strong>${esc(s.name)}${s.t ? ` (${link(s.t)}, #${s.t.rank})` : ''}:</strong> ${esc(s.text)}</li>`).join('')}
      </ol>
      <p>For deeper research, see the <a href="/best/ai-research-assistant">best AI research assistants</a>.</p>
      <h2 id="sound-human">How to keep AI writing sounding human</h2>
      <ul class="clean">
        <li><strong>Start from your own material.</strong> Notes, interviews, data, and opinions you bring are what make a post worth reading; the AI should organize them, not invent them.</li>
        <li><strong>Show, do not describe, your voice.</strong> Paste two or three examples of your writing and ask the tool to match them.</li>
        <li><strong>Cut the filler.</strong> Delete generic intros, repeated summaries, and stock phrases, and keep sentences short.</li>
        <li><strong>Add what only you know.</strong> A real example, a number from your own work, or a mistake you made beats any generated paragraph.</li>
        <li><strong>Fact-check everything.</strong> <a href="${GOOGLE_AI_GUIDANCE}" rel="noopener">Google's guidance on generative AI content</a> notes that AI output can contain inaccuracies and asks publishers to review it, including titles, meta descriptions, and structured data, and warns that mass-producing pages without adding value can violate its scaled content abuse policy.</li>
      </ul>
      <h2>How we chose</h2>
      <p>This page covers the writing tools ranked on ${NAME}, plus ${rl('perplexity')} and ${rl('ideogram')} for the research and image steps. Ranks are the same editorial ranks used across the site; featured listings do not affect rank, and we do not score writing quality, since it depends on your prompts and editing. Writing tools that are not yet ranked on ${NAME}, such as Sudowrite and Copy.ai, are left out until they are reviewed. Browse the full <a href="/category/writing">writing category</a>, the <a href="/best/free-ai-tools#writing">best free AI tools for writing</a>, or read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: WRITE_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: WRITE_H1,
        description,
        url: `${SITE}${WRITE_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI writing tools on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'HowTo',
        name: 'Write a blog post with AI tools in 5 steps',
        step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Writing', '/category/writing'], ['AI writing tools', WRITE_PATH]])],
    },
  }))
})

const IMAGE_PICKS = [
  { slug: 'midjourney', id: 'best-artistic', heading: 'Best AI image generator for artistic images', role: 'Best for artistic, stylized images',
    why: 'Midjourney is the highest-ranked dedicated image generator on BuildStack and the usual benchmark for concept art, mood boards, and stylized marketing visuals. Standard and higher plans include unlimited image generations in the slower Relax mode, and Pro and Mega add unlimited standard-definition video in Relax mode.',
    watch: 'There is no free plan, Stealth Mode (private images) is only on Pro and Mega, and companies with more than $1M in yearly revenue must be on Pro or Mega.' },
  { slug: 'ideogram', id: 'best-text', heading: 'Best AI image generator for text in images', role: 'Best for readable text in images',
    why: 'Ideogram is known for images that include readable text, which makes it the pick for posters, logo drafts, thumbnails, and marketing graphics where the words matter. Free accounts get weekly credits, and pay as you go credits also cover API use.',
    watch: 'Even the best text rendering makes mistakes, so check every word and number before an image goes on a product or an ad.' },
  { slug: 'flux', id: 'best-photorealism-api', heading: 'Best for photorealism and API image generation', role: 'Best for photorealism and building on an API',
    why: 'FLUX is the family of image models from Black Forest Labs, including FLUX 3 Image and FLUX.2. You pay per image through the API with no subscription, the Playground costs the same as the API, and the models are also served through partner platforms. Teams that want to run the models on their own servers can license the open weights.',
    watch: 'It is built for developers first, and some open-weight versions, such as FLUX.2 [dev], are non-commercial unless you buy a license.' },
  { slug: 'krea-3', id: 'best-consistent', heading: 'Best for consistent products and characters', role: 'Best for keeping products and characters consistent',
    why: 'Krea 3 is built for editing as much as generating. It takes up to 6 reference images per edit and keeps products, labels, logos, characters, and text intact while changing the rest of the scene, and most edits finish in under 8 seconds at native 2K. That makes it a strong choice for product photos and campaign variants.',
    watch: 'Krea 3 is new (released October 15, 2026), so expect its features and pricing to keep changing.' },
  { slug: 'seedream-5-5', id: 'best-multi-round-editing', heading: 'Best for many rounds of edits and transparent assets', role: 'Best for repeated edits and transparent-background assets',
    why: 'Seedream 5.5 from ByteDance is built to keep editing the same image: it preserves the parts you did not ask to change at the pixel level, and ByteDance demonstrates 100 successive edits without color shifts or detail loss. It can also output native RGBA images with transparent backgrounds, so product cutouts, stickers, and logo-style assets are ready for a layout without a separate background removal step.',
    watch: 'Seedream 5.5 is brand new (introduced November 9, 2026). At launch it is in the Doubao, Doubao Work, and Jimeng apps, and its API on Volcano Engine Ark is announced but not yet live, so pricing and access outside those apps may change.' },
  { slug: 'leonardo', id: 'best-game-assets', heading: 'Best for game assets and custom styles', role: 'Best for game assets and trained custom styles',
    why: 'Leonardo AI gives you 80+ models in one place on paid plans, including third-party models, and lets you train personal models on a small set of your own images to lock in a style, theme, or character. That suits game assets, item sets, and any project that needs many images in one look.',
    watch: 'Free creations are public and Leonardo keeps rights to use them, and unlimited relaxed generation only covers selected models.' },
  { slug: 'adobe-firefly', id: 'best-commercial', heading: 'Best commercially safer AI image generator', role: 'Best commercially safer option for design teams',
    why: 'Adobe Firefly works inside the Adobe apps many designers already use, such as Generative Fill in Photoshop. Paid Firefly plans and Creative Cloud Pro include unlimited standard image generations, and Adobe says outputs from features that are not in beta can be used in commercial projects.',
    watch: 'Partner models from companies like Google and OpenAI count as premium features and use credits, and outputs from beta features are not covered by Adobe indemnification for teams and enterprise customers.' },
  { slug: 'canva', id: 'best-social', heading: 'Best for social posts and marketing graphics', role: 'Best for quick social and marketing graphics',
    why: 'Canva puts image generation next to templates, brand kits, and layout tools, so a generated image can become a finished social post, slide, or flyer in the same place. It has its own image model, Canva Craft, and the Canva Brush design model for editable AI edits.',
    watch: 'Brush is limited to Canva Pro subscribers for now, and prices vary by region.' },
  { slug: 'topaz-labs', id: 'best-upscaling', heading: 'Best for upscaling and fixing images', role: 'Best for upscaling and repairing images',
    why: 'Topaz Labs is not a text-to-image generator; it is the finishing step. Its new Wonder 4 model upscales and repairs an image in one pass, handling denoising, sharpening, compression artifacts, and faces, which helps when an AI image needs to be printed or used at a larger size.',
    watch: 'At launch Wonder 4 is in the browser-based Topaz for Web, and personal plans only allow commercial use for organizations under $1M in annual revenue.' },
]
const IMAGE_PATH = '/best/ai-image-generator'
const IMAGE_H1 = 'Best AI Image Generators in 2026 (Plus the Best Midjourney Alternatives)'

function imageData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = IMAGE_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function imageFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI image generator right now?',
      a: `It depends on the image. ${r('midjourney')} is the best for artistic, stylized images and is the highest-ranked image generator on ${NAME}. Pick ${r('flux')} for photorealism or an API, ${r('ideogram')} when the image needs readable text, and ${r('krea-3')} when products or characters must stay consistent across images.` },
    { q: 'What is the best free Midjourney alternative?',
      a: `Midjourney has no free plan. ${r('krea-3')} has a free plan with a daily compute allowance, ${r('ideogram')} gives free accounts weekly credits, ${r('leonardo')} gives 150 fast tokens a day (free creations are public), and ${r('adobe-firefly')} allows limited daily generations for free. ${r('canva')} also has a free plan.` },
    { q: 'Which AI image generator is best at text?',
      a: `${r('ideogram')} is the pick for readable text in images, such as posters, logos, and thumbnails. Always proofread the result before you publish it.` },
    { q: 'Which AI image generator can make transparent backgrounds?',
      a: `${r('seedream-5-5')}, introduced November 9, 2026, generates native RGBA images with full and partial transparency, so assets come out ready for a layout. It also keeps unedited areas unchanged across many rounds of edits. At launch it is in the Doubao, Doubao Work, and Jimeng apps, with its API announced but not yet live.` },
    { q: 'Which AI image generator is safe for commercial use?',
      a: `No tool removes all risk, so read the terms for your plan. ${r('adobe-firefly')} is the commercially safer pick: Adobe says outputs from non-beta features can be used commercially. ${r('midjourney')} lets subscribers use their images in just about any way, but companies with more than $1M in yearly revenue need the Pro or Mega plan. On ${r('leonardo')}, paid subscribers own the images they generate.` },
    { q: 'What is the best Midjourney API alternative?',
      a: `For developers, ${r('flux')} is the main pick: pay per image through the Black Forest Labs API with no subscription. ${r('krea-3')} has an API at $0.06 per 2K image and $0.03 per 1K image, ${r('ideogram')} sells pay as you go credits that include API use, and ${r('leonardo')} has a pay as you go API.` },
  ]
}

app.get(IMAGE_PATH, (c) => {
  const PD = pageDate(IMAGE_PATH)
  const d = imageData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = imageFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `The best AI image generator for artistic images is ${f('midjourney')}. Choose ${f('ideogram')} for readable text, ${f('flux')} for photorealism and API use, ${f('krea-3')} for consistent products and characters, ${f('seedream-5-5')} for many rounds of edits and transparent assets, ${f('leonardo')} for game assets and custom styles, and ${f('adobe-firefly')} if you want the commercially safer option inside Adobe apps`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const description = `Best AI image generators in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, plus the best Midjourney alternatives and verified pricing. Updated ${fmtDate(PD)}.`
  const title = `Best AI Image Generators in 2026 (Midjourney Alternatives) | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Images</span></div>
    <h1>${esc(IMAGE_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing from official pages · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI image generators at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Our pick for</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.role)}</td><td>${esc(listNames(p.t.bestFor || []))}</td><td>${esc(p.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices come from each official pricing page. AI pricing changes often, so check the official site before you buy.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.t.pricingNote)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="midjourney-alternatives">
    <div class="panel prose">
      <h2 style="margin-top:0">Best Midjourney alternatives</h2>
      <p>${rl('midjourney')} is subscription only, so these are the alternatives by what you need instead.</p>
      <ul class="clean">
        <li><strong>Free:</strong> ${rl('krea-3')} has a free plan with a daily compute allowance, ${rl('ideogram')} gives free accounts weekly credits, ${rl('leonardo')} gives 150 fast tokens a day, and ${rl('adobe-firefly')} and ${rl('canva')} can be used for free with limits. See more in the <a href="/best/free-ai-tools#images">best free AI tools for images</a>.</li>
        <li><strong>Text rendering:</strong> ${rl('ideogram')} is the pick when an image needs readable words, such as a poster, logo draft, or thumbnail.</li>
        <li><strong>API:</strong> ${rl('flux')} sells pay per image API access with no subscription, and ${rl('krea-3')}, ${rl('ideogram')}, and ${rl('leonardo')} also offer APIs.</li>
        <li><strong>Transparent backgrounds:</strong> ${rl('seedream-5-5')} generates native RGBA images with full and partial transparency, so cutouts skip the background removal step.</li>
        <li><strong>Inside Adobe:</strong> ${rl('adobe-firefly')} runs in Photoshop and other Adobe apps, and paid Firefly plans include unlimited standard image generations.</li>
        <li><strong>Already paying for an assistant:</strong> ${rl('chatgpt')} also generates images, which is enough for many quick jobs before you add a dedicated tool.</li>
      </ul>
      <h2>How we chose</h2>
      <p>This page covers the image tools ranked on ${NAME}, plus ${rl('chatgpt')} as an assistant that also makes images. Ranks are the same editorial ranks used across the site; featured listings do not affect rank, and we do not score image quality, since results depend on your prompts and style. Browse the full <a href="/category/images">images category</a>, the <a href="/best/free-ai-tools#images">best free AI tools for images</a>, or read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: IMAGE_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: IMAGE_H1,
        description,
        url: `${SITE}${IMAGE_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI image generators on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Images', '/category/images'], ['AI image generators', IMAGE_PATH]])],
    },
  }))
})

const VIDEO_PICKS = [
  { slug: 'descript', id: 'best-talking-head', heading: 'Best for talking-head and podcast videos', role: 'Best for talking-head and podcast edits',
    why: 'Descript lets you edit video and podcasts by editing a transcript, which is the fastest path for talking-head YouTube videos and interview shows. AI tools cover cleanup, overdub, and studio sound, and the free plan includes 1 media hour a month so you can try the workflow before you pay.',
    watch: 'Heavier creators usually need Hobbyist or Creator for more media hours, and overdub and advanced AI features sit on paid plans.' },
  { slug: 'opusclip', id: 'best-shorts-from-long', heading: 'Best for turning long videos into Shorts', role: 'Best for Shorts and clips from long videos',
    why: 'OpusClip is built for turning long footage into short social clips. OpusClip 4.0 (November 2, 2026) also auto-edits raw talking-head footage into a finished video with speech cleanup, captions, and B-roll, and one edit can become highlight clips, a longer cut, or a lo-fi update. Viral Hook and Motion Graphics cover openings and on-screen graphics, and AI Producer lets you edit from ChatGPT or Claude.',
    watch: 'The free plan uses watermarked caption templates and limited exports, so regular YouTube uploads usually need Starter or Pro.' },
  { slug: 'capcut', id: 'best-free-shorts', heading: 'Best for Shorts and quick social edits', role: 'Best for free Shorts and quick social edits',
    why: 'CapCut is a widely used editor with AI captions, effects, and templates aimed at short-form social video. It is the easiest free starting point when you already have a finished take and just need captions, cuts, and a vertical crop for Shorts.',
    watch: 'Some templates, effects, and exports push you toward CapCut Pro, and accounts and cloud features are tied to the CapCut / TikTok ecosystem.' },
  { slug: 'twelvelabs-jockey', id: 'best-search-footage', heading: 'Best for finding moments in long footage', role: 'Best for searching footage and rough cuts',
    why: 'Jockey by TwelveLabs searches video and photo libraries by meaning, explains what happens in each clip, groups footage, and assembles highlight reels or rough cuts. That saves hours when you have long recordings and need the moments worth publishing. It works inside ChatGPT and Claude or through the TwelveLabs API.',
    watch: 'It is stronger at finding and assembling moments than at polish edits; finish captions and color in Descript, OpusClip, or CapCut.' },
  { slug: 'runway', id: 'best-effects-broll', heading: 'Best for creative effects and b-roll', role: 'Best for AI effects and generated b-roll',
    why: 'Runway is the pick when you need generative video, not just cuts: text-to-video, image-to-video, and creative effects for short clips and b-roll that would be expensive to shoot. Use it to generate supporting footage, then edit the final cut in a transcript or timeline editor.',
    watch: 'Plans are credit-based, so heavy generation burns credits quickly, and generated clips still need editing before they look like a finished YouTube video.' },
  { slug: 'elevenlabs', id: 'best-voiceover', heading: 'Best for AI voiceover', role: 'Best for AI voiceover and dubbing',
    why: 'ElevenLabs covers realistic text-to-speech, voice clones, and multilingual dubbing, which helps when a YouTube video needs a voiceover, a language version, or a clean read over B-roll. It pairs well with Descript or CapCut in the last mile of an edit.',
    watch: 'The free plan has no commercial license; Starter and above add commercial use, and cloned voices need the right consent and rights.' },
]
const VIDEO_WORKFLOW = [
  { slug: '', name: 'Record', text: 'Shoot your talking-head, screen, or interview footage with clean audio. Keep a simple slate or chapter markers so later tools can find moments faster.' },
  { slug: 'descript', name: 'Transcribe and cut', text: 'Import into Descript, edit by deleting words in the transcript, and use cleanup tools for filler words and studio sound before you export a master cut.' },
  { slug: 'opusclip', name: 'Captions and Shorts', text: 'Send the long cut to OpusClip for highlight clips and Shorts, or use CapCut when you want free captions and a quick vertical edit.' },
  { slug: 'twelvelabs-jockey', name: 'Find moments', text: 'If you have hours of raw footage, use Jockey to search by meaning and assemble a rough cut of the moments worth publishing.' },
  { slug: 'elevenlabs', name: 'Voiceover fixes', text: 'Add or fix narration with ElevenLabs when you need a clean voiceover, a second language, or a read over B-roll that was not recorded on camera.' },
  { slug: '', name: 'Check YouTube AI disclosure', text: 'Before you upload, review YouTube Help on disclosing realistic generative AI content. Caption creation and minor aesthetic edits typically do not need disclosure; realistic GenAI that could mislead viewers may. Disclosing AI content alone will not limit audience or monetization eligibility per YouTube Help.' },
]
const VIDEO_PATH = '/best/ai-video-editor-for-youtube'
const VIDEO_H1 = 'Best AI Video Editors for YouTube in 2026'
const YT_AI_DISCLOSURE = 'https://support.google.com/youtube/answer/14328491'

function videoData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = VIDEO_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function videoFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI video editor for YouTube?',
      a: `It depends on the job. ${r('descript')} is the best for talking-head and podcast edits because you cut by editing a transcript. ${r('opusclip')} is the pick for turning long videos into Shorts and clips. ${r('capcut')} is the best free option for quick social edits, ${r('twelvelabs-jockey')} for searching long footage, ${r('runway')} for AI effects and generated b-roll, and ${r('elevenlabs')} for AI voiceover.` },
    { q: 'What is the best free AI video editor for YouTube?',
      a: `${r('capcut')} is the best free starting point for Shorts and quick social edits. ${r('descript')} has a free plan with 1 media hour a month for transcript-based editing, and ${r('opusclip')} has a free plan with watermarked caption templates and limited exports. See more free options in our free AI tools guide.` },
    { q: 'Can AI turn a long video into YouTube Shorts?',
      a: `Yes. ${r('opusclip')} is built for that: it finds highlight moments, adds captions, and exports short clips, and OpusClip 4.0 can also auto-edit raw talking-head footage into a finished video. ${r('capcut')} is a strong free alternative when you already know the moments you want and just need a vertical cut with captions.` },
    { q: 'Descript or CapCut for YouTube?',
      a: `Use ${r('descript')} when the video is a talking-head or podcast and you want to edit by deleting words in a transcript. Use ${r('capcut')} when you already have a take and need free captions, effects, and a Shorts-ready vertical edit. Many creators use Descript for the long cut and CapCut or OpusClip for Shorts.` },
    { q: 'Will YouTube demonetize videos edited with AI?',
      a: `Per YouTube Help (${YT_AI_DISCLOSURE}), creators must disclose realistic generative AI content in some cases. Caption creation and minor aesthetic edits typically do not need disclosure. YouTube Help also says that disclosing AI content alone will not limit your audience or your eligibility for monetization. Read the full policy on YouTube Help before you upload.` },
  ]
}

app.get(VIDEO_PATH, (c) => {
  const PD = pageDate(VIDEO_PATH)
  const d = videoData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = videoFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `The best AI video editor for talking-head YouTube videos is ${f('descript')}. Choose ${f('opusclip')} to turn long videos into Shorts, ${f('capcut')} for free and quick social edits, ${f('twelvelabs-jockey')} to search long footage for moments, ${f('runway')} for AI effects and generated b-roll, and ${f('elevenlabs')} for AI voiceover`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const steps = VIDEO_WORKFLOW.map((s) => ({ ...s, t: s.slug ? find(s.slug) : null }))
  const description = `Best AI video editors for YouTube in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with a Shorts workflow and verified pricing. Updated ${fmtDate(PD)}.`
  const title = `Best AI Video Editors for YouTube in 2026 | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Video</span></div>
    <h1>${esc(VIDEO_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing from official pages · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI video editors for YouTube at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Our pick for</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.role)}</td><td>${esc(listNames(p.t.bestFor || []))}</td><td>${esc(p.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices come from each official pricing page. AI pricing changes often, so check the official site before you buy.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.t.pricingNote)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="youtube-workflow">
    <div class="panel prose">
      <h2 style="margin-top:0">YouTube workflow: from recording to Shorts</h2>
      <ol>
        ${steps.map((s) => `<li><strong>${esc(s.name)}${s.t ? ` (${link(s.t)}, #${s.t.rank})` : ''}:</strong> ${s.name === 'Check YouTube AI disclosure' ? `Before you upload, review <a href="${YT_AI_DISCLOSURE}" rel="noopener">YouTube Help on disclosing AI-generated content</a>. Caption creation and minor aesthetic edits typically do not need disclosure; realistic GenAI that could mislead viewers may. Disclosing AI content alone will not limit audience or monetization eligibility per YouTube Help.` : esc(s.text)}</li>`).join('')}
      </ol>
      <h2>Editors vs video generators</h2>
      <p>This page is about editors that cut, caption, and package footage for YouTube. Generators such as ${rl('runway')} are for making new footage from text or images. See the <a href="/best/ai-video-generator">best AI video generators</a> guide for side-by-side picks, or browse the full <a href="/category/video">video category</a> for both editors and generators.</p>
      <h2>How we chose</h2>
      <p>This page covers video editors and supporting tools ranked on ${NAME} that YouTube creators actually use for talking-head cuts, Shorts, footage search, effects, and voiceover. Ranks are the same editorial ranks used across the site; featured listings do not affect rank, and we do not score edit quality, since results depend on your footage and taste. Browse the full <a href="/category/video">video category</a> or read the full <a href="/methodology">methodology</a>.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${f.q === 'Will YouTube demonetize videos edited with AI?' ? `Per <a href="${YT_AI_DISCLOSURE}" rel="noopener">YouTube Help</a>, creators must disclose realistic generative AI content in some cases. Caption creation and minor aesthetic edits typically do not need disclosure. YouTube Help also says that disclosing AI content alone will not limit your audience or your eligibility for monetization. Read the full policy on YouTube Help before you upload.` : esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: VIDEO_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: VIDEO_H1,
        description,
        url: `${SITE}${VIDEO_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI video editors for YouTube on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'HowTo',
        name: 'Edit a YouTube video with AI tools',
        step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Video', '/category/video'], ['AI video editors for YouTube', VIDEO_PATH]])],
    },
  }))
})

const VIDEOGEN_PICKS = [
  { slug: 'runway', id: 'best-overall', heading: 'Best overall AI video generator for creators', role: 'Best overall for creators', mode: 'Text-to-video and image-to-video',
    why: 'Runway is the highest-ranked video tool on BuildStack and the broadest creator studio for generative clips: text-to-video, image-to-video, partner models, App Studio, and ad workflows sit in one credit-based product. It is the default starting point when you need new footage, not just cuts.',
    watch: 'Credits burn quickly on longer or higher-resolution clips, and generated shots still need an editor before they look like a finished video.' },
  { slug: 'kling', id: 'best-social', heading: 'Best for short social clips', role: 'Best for short social clips', mode: 'Text-to-video and image-to-video',
    why: 'Kling AI is built for short-form creative clips with competitive motion quality from text or images. Paid plans add professional mode, watermark removal, and video extension, which suits creators who iterate on vertical social shots.',
    watch: 'Unused monthly credits do not roll over on typical plans, and credit cost varies by model, resolution, duration, and audio.' },
  { slug: 'veo-3-1', id: 'best-cinematic', heading: 'Best for cinematic storytelling with sound', role: 'Best for cinematic storytelling', mode: 'Text-to-video and image-to-video',
    why: 'Google Veo 3.1 generates picture together with sound effects, ambient noise, and dialogue, follows reference images for character consistency, and supports first/last-frame control with 1080p or 4K output in Google Flow. It is the strongest listed option for cinematic short stories now that OpenAI Sora is discontinued.',
    watch: 'Free Flow users get a small daily credit allotment and may be unable to generate at peak hours; Quality mode uses far more credits than Lite or Fast.' },
  { slug: 'luma-dream-machine', id: 'best-concept', heading: 'Best for fast concept shots', role: 'Best for fast concept shots', mode: 'Text-to-video and image-to-video',
    why: 'Luma Dream Machine is aimed at fast concepting: turn a prompt or still into a short shot to explore a look before you commit to a longer production. Ray3-class models and credit plans cover text-to-video, image-to-video, and related edits.',
    watch: 'Higher resolutions and longer clips cost many more credits, so treat early drafts as throwaway concept tests.' },
  { slug: 'viggle-jst-2', id: 'best-3d-motion', heading: 'Best for 3D scenes and character motion', role: 'Best for 3D scenes and character motion', mode: 'Image and prompt to 3D scene, character, and motion',
    why: 'Viggle JST-2 generates explorable 3D scenes in about a second, turns a single image into an animation-ready character without a separate rigging step, and creates full-body motion from text or video. Scenes decode to 3D Gaussian splats that play in the browser.',
    watch: 'It is a different category from flat text-to-video generators; use it when you need 3D worlds, characters, or motion, then composite elsewhere if you need a conventional clip.' },
  { slug: 'seedance-2-5', id: 'also-seedance', heading: 'Also strong: longer takes with synced audio', role: 'Best for longer takes with audio', mode: 'Text-to-video and image-to-video',
    why: 'Seedance 2.5 from ByteDance Seed generates audio and video together in clips of up to 30 seconds per pass, supports extension for multi-minute stories, and takes many image, video, and audio references in one pass.',
    watch: 'Access is through Jimeng AI, Doubao, and BytePlus ModelArk, so the product surface you use depends on region and account.' },
  { slug: 'pika-h3-flex', id: 'also-pika', heading: 'Also strong: fast drafts with open weights', role: 'Best for fast open-weight drafts', mode: 'Text-to-video, image-to-video, and reference-to-video',
    why: 'Pika H3 Flex generates video with synchronized stereo audio quickly, accepts up to 12 reference images, videos, and audio files, and ships open weights for self-hosting. The Pika API prices by output second and resolution.',
    watch: 'The 50% API Club launch discount and 15 free API Club generations a day ended November 5, 2026, so check current API and app plan prices before you budget.' },
  { slug: 'heygen', id: 'also-heygen', heading: 'Also strong: avatar talking-head videos', role: 'Best for avatar talking-head videos', mode: 'Script to avatar video (plus text/image/reference video on paid plans)',
    why: 'HeyGen turns scripts into videos with stock or custom AI avatars, translates into 175+ languages and dialects, and includes Video Agent plus an AI Studio editor. Paid plans add HeyGen Video 1 and access to models such as Seedance 2.5 and Veo 3.1.',
    watch: 'Free exports are watermarked and capped at 3 videos a month; avatar likeness and voice cloning need the right consent and rights.' },
  { slug: 'synthesia', id: 'also-synthesia', heading: 'Also strong: business training and docs-to-video', role: 'Best for business training videos', mode: 'Script, doc, or deck to avatar video',
    why: 'Synthesia is built for business training and onboarding: avatars in 140+ languages, one-click translation, and Syren, which builds a video from a description. A ChatGPT plugin (November 3, 2026) works on every plan, including free.',
    watch: 'Free Basic videos carry a Synthesia watermark, and Syren credit use varies with length and complexity.' },
  { slug: 'gemini-omni-flash', id: 'also-omni', heading: 'Also strong: conversational video in Google apps', role: 'Best for conversational Google video', mode: 'Mixed references to video, edit by chat',
    why: 'Gemini Omni Flash lets you create and edit short videos by conversation from mixed text, image, video, and voice references. Omni 1.2 Flash arrived in Google Vids on November 5, 2026, with a small free monthly allotment for any Google account.',
    watch: 'Clip length and free allotments are limited compared with dedicated credit studios; check Flow, Vids, and Gemini API limits for your account.' },
]
const VIDEOGEN_PATH = '/best/ai-video-generator'
const VIDEOGEN_H1 = 'Best AI Video Generators in 2026, by What You Want to Make'

function videogenData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = VIDEOGEN_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  return { all, find, picks, byRank }
}

function videogenFaq(d) {
  const { find } = d
  const r = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  return [
    { q: 'What is the best AI video generator right now?',
      a: `It depends on what you want to make. ${r('runway')} is the best overall creator studio for text-to-video and image-to-video. Pick ${r('kling')} for short social clips, ${r('veo-3-1')} for cinematic shorts with native sound, ${r('luma-dream-machine')} for fast concept shots, and ${r('viggle-jst-2')} for 3D scenes and character motion. Avatar products such as ${r('heygen')} and ${r('synthesia')} fit scripted talking-head videos.` },
    { q: 'Is there a free AI video generator?',
      a: `Several listed tools have free tiers with limits. ${r('runway')} includes 125 one-time free credits, ${r('veo-3-1')} gives Google Flow accounts daily free credits, ${r('gemini-omni-flash')} offers a small monthly free allotment in Google Vids, ${r('heygen')} allows 3 watermarked videos a month, and ${r('synthesia')} Basic includes 500 credits a month with a watermark. ${r('viggle-jst-2')} has free trials in PINOC. Always check the official plan page before you rely on free output for client work.` },
    { q: 'Sora vs Runway: which is better?',
      a: `${r('sora')} is no longer available: OpenAI discontinued the Sora web and app experiences on April 26, 2026 and the Sora API on September 24, 2026. For new generative clips, ${r('runway')} is the better active pick on BuildStack for creators who need text-to-video and image-to-video in a credit-based studio. For cinematic shorts with native audio, compare ${r('veo-3-1')} as well.` },
    { q: 'What is the best image to video AI?',
      a: `Most top generators on this page do both text-to-video and image-to-video. ${r('runway')}, ${r('kling')}, ${r('veo-3-1')}, ${r('luma-dream-machine')}, ${r('seedance-2-5')}, and ${r('pika-h3-flex')} all support image-to-video. Choose by motion quality needs, audio, and credits rather than by a single winner.` },
    { q: 'Can I use AI-generated video commercially?',
      a: `It depends on the tool and plan. Many free tiers watermark output or restrict commercial use, while paid creator plans often allow commercial publishing under their terms. Read each vendor's license for your plan, confirm consent for any likeness or voice clone, and follow platform rules such as YouTube's generative AI disclosure help article when you upload realistic AI content.` },
  ]
}

app.get(VIDEOGEN_PATH, (c) => {
  const PD = pageDate(VIDEOGEN_PATH)
  const d = videogenData()
  const { find, picks, byRank } = d
  if (!picks.length) return c.notFound()
  const faq = videogenFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const short = (f) => `The best overall AI video generator for creators is ${f('runway')}. Choose ${f('kling')} for short social clips, ${f('veo-3-1')} for cinematic storytelling with sound, ${f('luma-dream-machine')} for fast concept shots, and ${f('viggle-jst-2')} for 3D scenes and character motion`
  const shortText = short(rt)
  const shortHtml = short(rl)
  const description = `Best AI video generators in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with text-to-video vs image-to-video notes and verified pricing. Updated ${fmtDate(PD)}.`
  const title = `Best AI Video Generators in 2026 | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Video</span></div>
    <h1>${esc(VIDEOGEN_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${fmtDate(PD)} · Pricing from official pages · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
  ${glanceSection(picks)}
  <section class="section">
    <h2>AI video generators at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Text-to-video or image-to-video</th><th>Best for</th><th>Pricing</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.mode)}</td><td>${esc(p.role)}</td><td>${esc(p.t.pricingNote)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Prices come from each official pricing page. AI pricing changes often, so check the official site before you buy. OpenAI Sora is listed for context but is discontinued.</p>
  </section>
  ${picks.map((p) => `<section class="section" id="${esc(p.id)}">
    <h2>${esc(p.heading)}</h2>
    <div class="panel prose">
      <h3 style="margin-top:0;color:var(--text)">${link(p.t)} (#${p.t.rank} overall)</h3>
      <p>${esc(p.t.tagline)}. ${esc(p.why)}</p>
      <p><strong>Inputs:</strong> ${esc(p.mode)}.</p>
      <p><strong>Best for:</strong> ${esc(listNames(p.t.bestFor || []))}.</p>
      <p><strong>Pricing:</strong> ${esc(p.t.pricingNote)}.</p>
      <p class="muted" style="margin-bottom:0"><strong>Watch out:</strong> ${esc(p.watch)}</p>
    </div>
  </section>`).join('')}
  <section class="section" id="generator-vs-editor">
    <div class="panel prose">
      <h2 style="margin-top:0">Generator vs editor</h2>
      <p>Generators make new footage from text, images, or references. Editors cut, caption, and package footage you already have. If you are finishing a YouTube video, start with the <a href="/best/ai-video-editor-for-youtube">best AI video editors for YouTube</a> guide, then come back here when you need generated b-roll or a fully synthetic clip.</p>
      <h2>How credits and pricing work</h2>
      <p>Most generators sell monthly credit allotments. Longer clips, higher resolution, audio, and reference-heavy modes cost more credits per second. Free tiers often watermark output or give a one-time credit deposit. Always confirm commercial-use terms on the official plan page for ${rl('runway')}, ${rl('kling')}, ${rl('veo-3-1')}, ${rl('luma-dream-machine')}, ${rl('pika-h3-flex')}, ${rl('heygen')}, and ${rl('synthesia')}.</p>
      <h2>How we chose</h2>
      <p>This page covers video generators ranked on ${esc(NAME)}, using the same editorial ranks as the rest of the site. Featured listings do not affect rank, and we do not score clip quality, since results depend on your prompts and taste. ${rl('sora')} remains in the directory for search context but is discontinued. Browse the full <a href="/category/video">video category</a> or read the full <a href="/methodology">methodology</a>.</p>
      <p>Curious how viral celebrity clips usually get made, and how to look more carefully before you share one? See <a href="/guides/how-celebrity-deepfakes-are-made">how celebrity deepfakes get made, and how to spot one</a>. It is a high-level explainer, not a how-to, and we do not list face-swap apps.</p>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>`
  return c.html(layout({
    title,
    description,
    path: VIDEOGEN_PATH,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: VIDEOGEN_H1,
        description,
        url: `${SITE}${VIDEOGEN_PATH}`,
        dateModified: PD,
        author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        abstract: `${shortText}.`,
      }, {
        '@type': 'ItemList',
        name: 'Best AI video generators on BuildStack',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: byRank.length,
        itemListElement: byRank.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.t.name, url: `${SITE}/tool/${p.t.slug}` })),
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Video', '/category/video'], ['AI video generators', VIDEOGEN_PATH]])],
    },
  }))
})


// The editor. One Person node, referenced by @id from article authors.
const EDITOR_ID = `${SITE}/about#sampson`
const EDITOR = {
  '@type': 'Person',
  '@id': EDITOR_ID,
  name: 'Sampson Brueher',
  url: `${SITE}/about`,
  image: `${SITE}/about/sampson.jpg`,
  jobTitle: 'Editor, BuildStack',
  worksFor: { '@type': 'Organization', name: 'tier11', url: 'https://tier11.com' },
  sameAs: ['https://x.com/itsbuildstack', 'https://itsbuildstack.substack.com'],
}

const DEEPFAKE_PATH = '/guides/how-celebrity-deepfakes-are-made'
const DEEPFAKE_H1 = 'How viral celebrity deepfakes get made, and how to spot one'
const DEEPFAKE_DESC = 'A plain-language look at how viral celebrity deepfakes are usually assembled, how to spot one, and where BuildStack draws the line. Not a how-to.'
const DEEPFAKE_PUBLISHED = '2026-11-13'
const DEEPFAKE_READ = '6 min read'

function deepfakeFaq() {
  return [
    {
      q: 'If the big video apps block celebrities, why do these clips still spread?',
      a: 'Many are made with face-swap tools, local image-to-video workflows, or smaller sites without the same restrictions, and labels are often stripped.',
    },
    {
      q: 'Can I trust an app that claims to detect deepfakes?',
      a: 'Not on its own. Detectors are unreliable on new or compressed fakes and can flag real video by mistake. Check the source, context, and any Content Credentials or platform labels too.',
    },
    {
      q: 'What should I do if a nonconsensual intimate deepfake is posted?',
      a: 'Ask the platform to remove it, keep records, and consider reporting it to law enforcement. In the United States, covered platforms generally have 48 hours after a valid request. If they fail, or have no way to request removal, report the platform at https://takeitdown.ftc.gov/. This is not legal advice.',
    },
  ]
}

// Mainstream video tools whose official policies restrict real-person likeness. Each note is
// limited to what the cited policy says (see Sources).
const DEEPFAKE_LIKENESS = [
  { slug: 'veo-3-1', note: 'Google says Veo is built to reject photorealistic depictions of prominent people.', src: 'https://cloud.google.com/vertex-ai/generative-ai/docs/video/responsible-ai-and-usage-guidelines', srcName: 'Responsible AI for Veo' },
  { slug: 'runway', note: "Runway's usage policy bans using another person's image, video, or audio without permission, and bans impersonation.", src: 'https://runway.com/safety/usage-policy', srcName: 'Runway usage policy' },
  { slug: 'kling', note: "Kling's community guidelines require respect for likeness rights and prohibit impersonation.", src: 'https://kling.ai/docs/community-policy', srcName: 'Kling community guidelines' },
]

const DEEPFAKE_SOURCES = [
  'U.S. Department of Homeland Security, "<a href="https://www.dhs.gov/sites/default/files/publications/increasing_threats_of_deepfake_identities_0.pdf">Increasing Threat of Deepfake Identities</a>" (signs that can help identify fake images, video, and audio).',
  'U.S. Department of Homeland Security, Science and Technology Directorate, "<a href="https://www.dhs.gov/sites/default/files/2025-01/25_0110_st_impacts_of_adversarial_generative_ai_on_homeland_security_0.pdf">Impacts of Adversarial Use of Generative AI on Homeland Security</a>," January 2025, Appendix C (heuristics for identifying deepfakes).',
  'National Security Agency, Federal Bureau of Investigation, and Cybersecurity and Infrastructure Security Agency, "<a href="https://media.defense.gov/2023/Sep/12/2003298925/-1/-1/0/CSI-DEEPFAKE-THREATS.PDF">Contextualizing Deepfake Threats to Organizations</a>," September 12, 2023. See also the <a href="https://www.cisa.gov/news-events/alerts/2023/09/12/nsa-fbi-and-cisa-release-cybersecurity-information-sheet-deepfake-threats">CISA announcement</a>.',
  'Coalition for Content Provenance and Authenticity, "<a href="https://c2pa.org/faqs/">FAQs</a>."',
  'Content Authenticity Initiative, "<a href="https://www.contentauthenticity.org/how-it-works">How it works</a>," and the <a href="https://verify.contentauthenticity.org">Content Credentials verification tool</a>.',
  'OpenAI, "<a href="https://openai.com/index/creating-with-sora-safely/">Creating with Sora safely</a>," March 23, 2026 (public-figure blocks and C2PA metadata on Sora videos).',
  'OpenAI Help Center, "<a href="https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation">What to know about the Sora discontinuation</a>" (app discontinued April 26, 2026; API discontinued September 24, 2026).',
  'Google Cloud, "<a href="https://cloud.google.com/vertex-ai/generative-ai/docs/video/responsible-ai-and-usage-guidelines">Responsible AI for Veo</a>" (rejects photorealistic representations of prominent people).',
  'Runway, "<a href="https://runway.com/safety/usage-policy">Usage Policy</a>," updated March 6, 2026 (no use of another person\'s image, video, or audio without permission; no impersonation).',
  'Kling AI, "<a href="https://kling.ai/docs/community-policy">Community Guidelines</a>," effective September 8, 2026 (likeness rights and a ban on impersonation).',
  'YouTube, "<a href="https://www.youtube.com/howyoutubeworks/ai/">How Creators Use AI for Content Creation</a>" (disclosure and labels for realistic or meaningfully altered AI content).',
  'Meta Transparency Center, "<a href="https://transparency.meta.com/en-us/governance/tracking-impact/labeling-ai-content">Labeling AI Content</a>," updated February 19, 2025 ("AI Info" labels).',
  'TikTok Newsroom, "<a href="https://newsroom.tiktok.com/en-us/more-ways-to-spot-shape-and-understand-ai-generated-content">More ways to spot, shape and understand AI-generated content</a>," November 24, 2025 (creator labels, detection, and C2PA).',
  'TAKE IT DOWN Act, <a href="https://www.govinfo.gov/content/pkg/PLAW-119publ12/html/PLAW-119publ12.htm">Public Law 119-12</a>, signed May 19, 2025. See also <a href="https://www.congress.gov/bill/119th-congress/senate-bill/146">Congress.gov</a> and the Congressional Research Service legal sidebar, "<a href="https://www.congress.gov/crs-product/LSB11314">The TAKE IT DOWN Act: A Federal Law Prohibiting the Nonconsensual Publication of Intimate Images</a>," May 20, 2025.',
  'Federal Trade Commission, "<a href="https://takeitdown.ftc.gov/">TakeItDown.ftc.gov</a>" (platform notice-and-removal and 48-hour duty).',
  'Federal Trade Commission, "<a href="https://www.federalregister.gov/documents/2024/03/01/2024-04335/trade-regulation-rule-on-impersonation-of-government-and-businesses">Trade Regulation Rule on Impersonation of Government and Businesses</a>," <em>Federal Register</em>, March 1, 2024.',
  'Rahman, Hasan, and Mohammed, "<a href="https://doi.org/10.1145/3595353.3595882">Why Do Facial Deepfake Detectors Fail?</a>," Association for Computing Machinery, 2023.',
  '"<a href="https://doi.org/10.30574/wjarr.2026.30.2.1387">Beyond benchmark accuracy: Evaluating deepfake detection tools for digital forensic admissibility through a systematic review</a>," <em>World Journal of Advanced Research and Reviews</em>, 2026 (reported accuracy falling to about 54% to 75% on out-of-distribution data).',
]

const DEEPFAKE_PILLS = [
  { label: 'For AI video', href: '/best/ai-video-generator' },
  { label: 'Video', href: '/category/video' },
  { label: 'Voice', href: '/best/ai-voice-generator' },
]

app.get(DEEPFAKE_PATH, (c) => {
  const PD = pageDate(DEEPFAKE_PATH)
  const faq = deepfakeFaq()
  const title = `${DEEPFAKE_H1} | ${NAME}`
  const likeness = DEEPFAKE_LIKENESS.map((x) => ({ ...x, t: bySlug(x.slug) })).filter((x) => x.t)
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Video</span></div>
    <h1>${esc(DEEPFAKE_H1)}</h1>
    <p class="muted" style="margin:0">By <a href="/about">Sampson Brueher, editor</a></p>
    <p class="muted" style="margin:.2rem 0 0">${fmtDate(DEEPFAKE_PUBLISHED)} · ${DEEPFAKE_READ}</p>
    <p class="byline-note">BuildStack is a free ranked directory of AI tools. Ranks aren't for sale.</p>
    <figure class="hero-art capped">
      <picture>
        <source type="image/webp" srcset="/guides/deepfake-hero.webp"/>
        <img src="/guides/deepfake-hero.jpg" width="1280" height="720" alt="Illustration: an invented face, half photographic and half digital wireframe" fetchpriority="high" decoding="async"/>
      </picture>
      <figcaption>AI-generated illustration. Not a real person.</figcaption>
    </figure>
  </section>
  <section class="section">
    <div class="article">
      <p><strong>Deepfake detectors that score near-perfect in the lab can fall to between the mid-50s and mid-70s percent accuracy on realistic video,</strong> a 2026 systematic review found. At the low end, that is close to a coin flip. So when a clip of a famous person saying or doing something shocking starts flying around, an app cannot answer "is this real?" for you. This guide explains, at a high level, how those clips usually get made and what to check before you share one.</p>

      <div class="checks" id="checks">
        <h2>6 checks before you share</h2>
        <ol>
          <li><strong>Face edges and hairline.</strong> Skin tone that shifts at the edge of the face, double edges, blur, or flicker when the head turns.</li>
          <li><strong>Teeth and the inner mouth.</strong> Teeth that blur together, and lips that never close on p, b, and m.</li>
          <li><strong>Blinking, lighting, and hands.</strong> Odd blinking, light that does not match the neck or background, smeared fingers.</li>
          <li><strong>Audio sync.</strong> Choppy speech, odd pauses, or a voice with no breath and no room sound.</li>
          <li><strong>Context.</strong> Is it from an official account or a verified newsroom? Do the event, date, and place line up? Reverse-search a still.</li>
          <li><strong>Provenance and labels.</strong> Look for Content Credentials and platform AI labels. Treat any detector result as one clue, not a verdict.</li>
        </ol>
      </div>

      <h2>Four common routes, in plain terms</h2>
      <p>Most viral celebrity fakes follow one of four paths, or a mix of them.</p>
      <p><strong>Face-swap is the classic method.</strong> Software takes a face from photos or video of one person and pastes it onto existing footage of someone else. Tools in this category include DeepFaceLab and FaceFusion. Because the body and background already exist, the result can look like a real event even when the face is not.</p>
      <p><strong>Image-to-video starts with a still photo.</strong> A model is asked to animate that picture, as if the person had been filmed. People often run models like this inside a power-user workbench such as ComfyUI, a general creative workbench for images and video, not a deepfake product. What matters is the choice to animate a real person's likeness, not the workbench.</p>
      <p><strong>Hosted video apps do the work in a browser.</strong> Google's <a href="/tool/veo-3-1">Veo</a> is built to reject photorealistic depictions of prominent people. While it was available, OpenAI's Sora also blocked depictions of public figures, except through a consent-based character feature. OpenAI discontinued the Sora app on April 26, 2026, and the Sora API on September 24, 2026. <a href="/tool/kling">Kling</a> requires users to respect likeness rights and prohibits impersonation. The biggest apps generally try to block videos of real celebrities. Some smaller sites do not.</p>
    </div>
    ${likeness.length ? `<div class="strip" id="likeness-rules">
      <h3>Mainstream video tools with likeness rules</h3>
      <div class="grid">${likeness.map((x) => toolCard(x.t).replace('</article>', `<p class="note">${esc(x.note)} <a href="${esc(x.src)}" rel="noopener noreferrer">${esc(x.srcName)}</a></p></article>`)).join('')}</div>
    </div>` : ''}
    <div class="article">
      <p><strong>Voice cloning and lip-sync handle the soundtrack.</strong> A voice model can imitate how someone sounds, and a lip-sync or talking-head tool can match a mouth to that audio. Used with consent, they power dubbing and avatars. Used without consent, they can put words in a real person's mouth. For legitimate tools we already rank, see <a href="/best/ai-voice-generator">AI voice generators</a> and <a href="/best/ai-video-generator">AI video generators</a>.</p>

      <h2>How to spot one, in more detail</h2>
      <p>Newer fakes are getting harder to catch by eye, and no single tell is proof.</p>
      <p><strong>Face edges and hairline.</strong> Homeland Security guidance includes watching for a change in skin tone near the edge of the face, double edges, and blurring on the face that does not match the rest of the frame. The hairline may fail to blend, and the face may flicker when the head turns.</p>
      <p><strong>Teeth and the inner mouth.</strong> Teeth may blur into a single block or change shape between frames, and the tongue or inner mouth may be missing or smeared. Watch sounds that need a clear mouth shape, such as p, b, and m, and see whether the lips actually close.</p>
      <p><strong>Blinking, lighting, and hands.</strong> Irregular blinking, a fixed gaze, and lighting that does not match the neck or background are long-standing signs. In fully generated video, extra fingers or smeared hands are also common, though less useful on a simple face-swap.</p>
      <p><strong>Audio sync and a voice that is too perfect.</strong> Official guidance flags choppy speech, odd pauses, and sound that is out of sync with the mouth. A cloned voice can also sound too clean, with no breath, no room echo, or background noise that cuts out when the person speaks.</p>
      <p><strong>Context checks.</strong> CISA, working with the NSA and FBI, advises checking the source and whether the event, date, and location actually line up. Check whether the clip came from an official account or a verified newsroom, and reverse-search a still with <a href="https://images.google.com">Google Images</a> or <a href="https://lens.google.com">Google Lens</a>.</p>
      <p><strong>Provenance, labels, and detectors.</strong> <a href="https://www.contentauthenticity.org/how-it-works">Content Credentials</a>, the C2PA standard, can record how a file was made and whether it was flagged as AI-generated. Inspect a file at the Content Authenticity Initiative's <a href="https://verify.contentauthenticity.org">verification site</a>. Credentials can be stripped when a clip is screenshotted or re-uploaded, and a missing label is not proof that a clip is real. YouTube, Meta, and TikTok also add AI labels for realistic generated or altered media. Automated detectors can miss new fakes, raise false alarms, and lose accuracy after compression, as the review above found. If you are still unsure, do not share the clip as fact.</p>

      <h2>Consent and the law</h2>
      <p>This is not legal advice, and the rules vary by place. In the United States, the TAKE IT DOWN Act (Public Law 119-12), signed on May 19, 2025, makes it a federal crime to publish nonconsensual intimate images, including AI-generated "digital forgeries," of an identifiable person in specified circumstances. Many states and other countries have similar laws.</p>
      <p>Covered platforms must offer a way to request removal and, after a valid notice, take the material and known identical copies down as soon as possible, and no later than 48 hours. That duty has been in effect since May 19, 2026, and the FTC enforces it. If a platform fails, or has no way to request removal, report it at <a href="https://takeitdown.ftc.gov/">TakeItDown.ftc.gov</a>.</p>
      <p>Impersonation can also be illegal. The FTC's Impersonation Rule prohibits impersonating the government or a business, including with AI voice cloning. Not every clip that uses a public figure's likeness is automatically a crime, especially in parody, but nonconsensual intimate deepfakes and deceptive impersonation are treated seriously.</p>

      <h2>Where BuildStack draws the line</h2>
      <p>BuildStack is a free ranked directory of AI tools, edited by <a href="/about">Sampson Brueher</a>. We rank creative <a href="/category/video">video</a>, <a href="/category/voice">voice</a>, and <a href="/category/images">image</a> tools for legitimate uses: filmmaking, dubbing, avatars people have agreed to, and everyday production work. See our current picks for <a href="/best/ai-video-generator">AI video generators</a>, <a href="/best/ai-voice-generator">AI voice generators</a>, and <a href="/best/ai-image-generator">AI image generators</a>. Ranks are not for sale. See <a href="/methodology">how we rank</a>.</p>
      <p>We do not list tools whose main purpose is face-swapping real people. A general workbench or a hosted video model may show up when it has ordinary creative uses. A product whose main draw is putting someone else's face onto footage does not.</p>
      <p>This guide is not a how-to. We leave out tools, settings, and filter workarounds on purpose.</p>
    </div>
  </section>
  <section class="section" id="find">
    <div class="panel">
      <h2 style="margin-top:0">What are you trying to make? Type the job.</h2>
      <form class="searchbox" action="/" method="get" role="search">
        <input name="q" placeholder="e.g. dub a video, make a product demo, add captions" aria-label="Search AI tools by job"/>
        <button type="submit">Find tools</button>
      </form>
      <div class="pills" style="margin-top:.9rem">${DEEPFAKE_PILLS.map((p) => `<a class="pill" href="${p.href}">${esc(p.label)}</a>`).join('')}</div>
    </div>
  </section>
  <section class="section" id="faq">
    <h2>FAQ</h2>
    <div class="panel prose">
      ${faq.map((f, i) => `<h3 style="color:var(--text);font-size:1.02rem;${i ? '' : 'margin-top:0'}">${esc(f.q)}</h3>
      <p>${esc(f.a)}</p>`).join('')}
    </div>
  </section>
  <section class="section" id="sources">
    <details class="sources">
      <summary>Sources (${DEEPFAKE_SOURCES.length})</summary>
      <div class="panel prose">
        <ol class="clean">
          ${DEEPFAKE_SOURCES.map((x) => `<li>${x}</li>`).join('\n          ')}
        </ol>
      </div>
    </details>
  </section>`
  return c.html(layout({
    title,
    description: DEEPFAKE_DESC,
    path: DEEPFAKE_PATH,
    shareImage: {
      url: `${SITE}/guides/deepfake-og.jpg`,
      type: 'image/jpeg',
      width: 1200,
      height: 630,
      alt: 'Illustration: an invented face, half photographic and half digital wireframe',
    },
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article',
        headline: DEEPFAKE_H1,
        description: DEEPFAKE_DESC,
        url: `${SITE}${DEEPFAKE_PATH}`,
        datePublished: DEEPFAKE_PUBLISHED,
        dateModified: PD,
        author: { '@type': 'Person', '@id': EDITOR_ID, name: 'Sampson Brueher', jobTitle: 'editor', url: `${SITE}/about` },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
        image: { '@type': 'ImageObject', url: `${SITE}/guides/deepfake-og.jpg`, width: 1200, height: 630 },
        timeRequired: 'PT6M',
      }, {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }, breadcrumbs([['Home', '/'], ['Video', '/category/video'], [DEEPFAKE_H1, DEEPFAKE_PATH]])],
    },
  }))
})

app.get('/about', (c) => {
  const description = 'About BuildStack and its editor, Sampson Brueher of tier11. A free ranked directory of AI tools. Ranks are never for sale.'
  const body = `
  <section class="hero">
    <h1>About BuildStack</h1>
    <div class="about-head">
      <picture>
        <source type="image/webp" srcset="/about/sampson.webp"/>
        <img src="/about/sampson.jpg" width="480" height="480" alt="Sampson Brueher" decoding="async"/>
      </picture>
      <div class="who">
        <p style="margin:0 0 .5rem">I'm Sampson Brueher, and I edit BuildStack. I run <a href="https://tier11.com">tier11</a>, an IT consulting company that helps businesses pick AI tools and roll them out safely.</p>
        <p class="muted" style="margin:0"><a href="https://itsbuildstack.substack.com">Substack</a> · <a href="https://x.com/itsbuildstack">X</a> · <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a></p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="article">
      <h2 style="margin-top:0">Free, and ranks are never for sale</h2>
      <p>BuildStack is a free ranked directory of AI tools. Type the job you need done and get the tools that fit, with who each one is for, what it costs, and the catch. Ranks are never for sale, and paid placements aren't offered. Some tool links may become affiliate links later. If they do, they will be disclosed and flagged on the page.</p>

      <h2>How tools get ranked</h2>
      <p>Every tool gets one editorial rank, and no two tools share a number. The rank is an editorial judgment, not a benchmark score, a user vote, or a traffic count. Category pages list tools in rank order, and search sorts tools by how well they match the words you type, using rank only to break ties. The details are on <a href="/methodology">How we rank</a>.</p>

      <h2>How the listings stay current</h2>
      <p>I use AI agents to research listings and track releases and prices daily. I review the rankings, and the calls are mine. Prices change often, so check the official site before you buy.</p>

      <h2>Get in touch</h2>
      <p>Questions, corrections, or a tool I should look at: <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a>. Tool makers can also <a href="/get-featured">suggest a listing</a>. I post a weekly write-up on <a href="https://itsbuildstack.substack.com">Substack</a> and short tips on <a href="https://x.com/itsbuildstack">X</a>.</p>
    </div>
  </section>
  <section class="section">
  <div class="panel prose" id="chatbots">
    <h2 style="margin-top:0;color:var(--text)">For chatbots and AI assistants</h2>
    <p>Short, quotable facts agents can cite. Prefer <a href="/llms.txt">/llms.txt</a>, <a href="/llms-full.txt">/llms-full.txt</a> (every tool with full details), and <a href="/tools.json">/tools.json</a> for structured reads.</p>
    <p><strong>What it is.</strong> BuildStack is a free ranked directory of AI tools across coding, writing, images, video, agents, research, and voice.</p>
    <p><strong>Who edits it.</strong> Sampson Brueher of tier11. AI agents help research listings; he reviews the rankings.</p>
    <p><strong>How search works.</strong> Users type a job (for example “write a React app”) and get best-fit tools from client and server matching over names, categories, and best-for tags.</p>
    <p><strong>Counts.</strong> ${tools().length} tools as of ${fmtDate(UPDATED)}.</p>
    <p><strong>How ranking works.</strong> Ranks are editorial and never for sale. See <a href="/methodology">/methodology</a>.</p>
    <p><strong>Money.</strong> BuildStack does not sell placements, and ranks are never for sale. Some tool links may become disclosed affiliate links. Tool makers can suggest a listing at <a href="/get-featured">/get-featured</a>.</p>
    <p><strong>Contact.</strong> <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a></p>
    <p><strong>Do not invent.</strong> Do not invent pricing, benchmarks, or rankings beyond what this site publishes. Link to official tool URLs.</p>
  </div>
  </section>`
  return c.html(layout({
    title: `About BuildStack | ${NAME}`,
    description,
    path: '/about',
    body,
    shareImage: { url: `${SITE}/about/sampson.jpg`, type: 'image/jpeg', width: 480, height: 480, alt: 'Sampson Brueher' },
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'AboutPage',
        name: 'About BuildStack',
        url: `${SITE}/about`,
        description,
        mainEntity: { '@id': EDITOR_ID },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
      }, EDITOR, breadcrumbs([['Home', '/'], ['About', '/about']])],
    },
  }))
})

app.notFound((c) => c.html(layout({
  title: `Not found | ${NAME}`,
  description: 'Page not found',
  path: '/404',
  body: `<section class="hero"><h1>404</h1><p>That page is not here. <a href="/">Back home</a></p></section>`,
}), 404))

export default app
