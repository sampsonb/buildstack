import { Hono } from 'hono'
import toolsData from './tools.json'

const app = new Hono()
const SITE = 'https://buildstack.tier11.com'
const NAME = 'BuildStack'
const UPDATED = '2026-10-29'

const CATEGORIES = {
  coding: { label: 'Coding', blurb: 'Editors, agents, and coding assistants' },
  writing: { label: 'Writing', blurb: 'Drafting, editing, and content AI' },
  images: { label: 'Images', blurb: 'Image generation and design AI' },
  video: { label: 'Video', blurb: 'Video generation and editing AI' },
  agents: { label: 'Agents', blurb: 'Autonomous and workflow agents' },
  research: { label: 'Research', blurb: 'Search, papers, and source-grounded AI' },
  voice: { label: 'Voice', blurb: 'Speech, music, and voice AI' },
}

const BEST_FOR = [
  { slug: 'write-code', title: 'Write and refactor code', query: 'coding IDE agent refactor' },
  { slug: 'research-web', title: 'Research with citations', query: 'research search citations papers' },
  { slug: 'generate-images', title: 'Generate images', query: 'images art midjourney flux' },
  { slug: 'make-video', title: 'Make short videos', query: 'video runway kling sora' },
  { slug: 'voiceover', title: 'Create voiceovers', query: 'voice speech elevenlabs' },
  { slug: 'automate-work', title: 'Automate workflows', query: 'agents automation zapier n8n' },
  { slug: 'write-marketing', title: 'Write marketing copy', query: 'writing marketing jasper grammarly' },
  { slug: 'build-mvp', title: 'Build an MVP app', query: 'lovable bolt v0 replit app' },
]

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
  return `${list.length} ${cat.label} AI tools ranked on ${NAME}${picks}. ${cat.blurb}. Updated ${UPDATED}.`
}

// Tool page meta description: search engines cut snippets at about 155
// characters, and full tool descriptions run 300 to 700. Lead with rank and
// category, then the description, trimmed at a word boundary so the snippet
// never ends mid-word.
function toolMetaDescription(t) {
  const label = CATEGORIES[t.category]?.label || t.category
  const full = `#${t.rank} in ${label} on ${NAME}. ${t.description}`
  if (full.length <= 155) return full
  const cut = full.slice(0, 152)
  const space = cut.lastIndexOf(' ')
  return `${(space > 100 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}...`
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

// One quotable sentence per job. linkFn wraps tool names (HTML) or not (text).
function quickLine(j, linkFn = (t) => t.name) {
  const [top, ...rest] = j.picks
  const others = rest.map((t) => `${linkFn(t)} (#${t.rank})`)
  return `BuildStack ranks ${linkFn(top)} first in ${j.label} (#${top.rank} overall)${others.length ? `, then ${listNames(others)}` : ''}.`
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
      a: `BuildStack adds new tools and adjusts ranks as tools launch and change. The list was last updated on ${UPDATED} and has ${all.length} tools. The same date is published in /tools.json and on the methodology page.`,
    },
  ]
}

function tools() {
  return [...toolsData].sort((a, b) => a.rank - b.rank)
}

function bySlug(slug) {
  return tools().find((t) => t.slug === slug)
}

function searchTools(q) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return tools()
  return tools()
    .map((t) => {
      const hay = [
        t.name, t.tagline, t.description, t.category,
        ...(t.bestFor || []), t.pricingNote || '',
      ].join(' ').toLowerCase()
      let score = 0
      for (const term of terms) {
        if (t.name.toLowerCase().includes(term)) score += 8
        if ((t.bestFor || []).some((b) => b.toLowerCase().includes(term))) score += 5
        if (t.category.includes(term)) score += 4
        if (hay.includes(term)) score += 2
      }
      return { t, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.rank - b.t.rank)
    .map((x) => x.t)
}

function layout({ title, description, path, body, jsonLd, robots }) {
  const url = SITE + path
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
<meta property="og:image" content="${SITE}/og.png"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="BuildStack. Ranked AI tools. Search by use case."/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${SITE}/og.png"/>
<meta name="twitter:image:alt" content="BuildStack. Ranked AI tools. Search by use case."/>
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
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
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
.prose { line-height: 1.6; color: var(--muted); }
.prose strong { color: var(--text); }
ul.clean { padding-left: 1.1rem; }
</style>
</head>
<body>
<div class="wrap">
  <nav class="nav">
    <a class="brand" href="/">Build<span>Stack</span></a>
    <div class="navlinks">
      <a href="/#best-for">Best for</a>
      <a href="/#new">New releases</a>
      <a href="/categories">Categories</a>
      <a href="/about">For chatbots</a>
      <a href="/get-featured">Get featured</a>
    </div>
  </nav>
  ${body}
  <footer class="footer">
    <div>${NAME} is a ranked directory of real AI tools. Data also at <a href="/llms.txt">/llms.txt</a>, <a href="/llms-full.txt">/llms-full.txt</a>, and <a href="/tools.json">/tools.json</a>.</div>
    <div style="margin-top:.4rem">Contact: <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a> · <a href="/methodology">How we rank</a> · <a href="/alternatives/cursor">Cursor alternatives</a> · <a href="/best/ai-coding-agent-for-beginners">AI coding agents for beginners</a> · <a href="/best/ai-research-assistant">AI research assistants</a> · <a href="/best/free-ai-tools">Free AI tools</a> · <a href="/best/ai-voice-generator">AI voice generators</a> · <a href="/sitemap.xml">Sitemap</a> · <a href="/robots.txt">robots.txt</a> · Hosted on Cloudflare</div>
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

function toolCard(t) {
  return `<article class="card">
    <div class="meta"><span class="rank">#${t.rank}</span><span class="tag">${esc(CATEGORIES[t.category]?.label || t.category)}</span>${t.newRelease ? '<span class="tag new">New</span>' : ''}${t.featured ? '<span class="tag feat">Featured</span>' : ''}</div>
    <h3><a href="/tool/${esc(t.slug)}">${esc(t.name)}</a></h3>
    <p class="muted" style="margin:0;font-size:.92rem">${esc(t.tagline)}</p>
  </article>`
}

app.get('/robots.txt', (c) => c.text(`User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`))

app.get('/sitemap.xml', (c) => {
  const lastmod = UPDATED
  const urls = [
    '', '/categories', '/methodology', '/alternatives/cursor', '/best/ai-coding-agent-for-beginners', '/best/ai-research-assistant', '/best/free-ai-tools', '/best/ai-voice-generator', '/get-featured', '/about', '/llms.txt', '/llms-full.txt', '/tools.json',
    ...Object.keys(CATEGORIES).map((k) => `/category/${k}`),
    ...tools().map((t) => `/tool/${t.slug}`),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
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
    newRelease: !!t.newRelease,
    tagline: t.tagline,
    description: t.description,
    bestFor: t.bestFor,
    pricingNote: t.pricingNote,
    page: `${SITE}/tool/${t.slug}`,
  })),
}))

app.get('/llms.txt', (c) => {
  const lines = [
    `# ${NAME}`,
    `> Ranked directory of real AI tools. Type a use case, get best-fit tools.`,
    ``,
    `Site: ${SITE}`,
    `Machine-readable: ${SITE}/tools.json`,
    `Full tool details for LLMs: ${SITE}/llms-full.txt`,
    `Human summary for bots: ${SITE}/about`,
    `How rankings work: ${SITE}/methodology`,
    `Get featured: ${SITE}/get-featured`,
    `Contact / newsletter From: buildstack@tier11.com`,
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
    ``,
    `## Top tools by rank`,
    ...tools().map((t) => `- ${t.name} (${t.category}): ${t.tagline}  -  ${SITE}/tool/${t.slug}`),
    ``,
    `## New releases`,
    ...tools().filter((t) => t.newRelease).map((t) => `- ${t.name}: ${SITE}/tool/${t.slug}`),
    ``,
    `## Best-for shortcuts`,
    ...BEST_FOR.map((b) => `- ${b.title}: ${SITE}/?q=${encodeURIComponent(b.query)}`),
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
    `> Ranked directory of real AI tools. Type a use case, get best-fit tools. This file lists every tool with full details.`,
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
    `- Best AI research assistants (including tools to summarize papers): ${SITE}/best/ai-research-assistant`,
    ...researchData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.best}. Sources: ${p.sources}. Pricing: ${p.t.pricingNote}`),
    `- Best free AI tools in 2026, by what you need to do: ${SITE}/best/free-ai-tools`,
    ...freeData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}, ${p.t.category}): ${FREE_KINDS[p.kind]?.label || 'Free'}. ${p.free}. Pricing: ${p.t.pricingNote}`),
    `- Best AI voice generators and text to speech tools: ${SITE}/best/ai-voice-generator`,
    ...voiceData().byRank.map((p) => `  - ${p.t.name} (#${p.t.rank}): ${p.role}. Type: ${VOICE_TYPES[p.type]}. Pricing: ${p.price}`),
  ]
  for (const [k, cat] of Object.entries(CATEGORIES)) {
    const list = all.filter((t) => t.category === k)
    if (!list.length) continue
    lines.push('', `## ${cat.label} (${list.length} tools)`, `${cat.blurb}. Category page: ${SITE}/category/${k}`)
    for (const t of list) {
      lines.push(
        '',
        `### ${t.name}`,
        `- Rank: #${t.rank} overall${t.newRelease ? ' (new release)' : ''}${t.featured ? ' (featured)' : ''}`,
        `- Tagline: ${t.tagline}`,
        `- Official site: ${t.url}`,
        `- BuildStack page: ${SITE}/tool/${t.slug}`,
        `- Best for: ${(t.bestFor || []).join('; ')}`,
        `- Pricing: ${t.pricingNote || 'See official site'}`,
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
  const q = c.req.query('q') || ''
  const results = q ? searchTools(q) : tools()
  const featured = tools().filter((t) => t.featured)
  const news = tools().filter((t) => t.newRelease)
  const all = tools()
  const qa = q ? [] : quickAnswers()
  const faq = q ? [] : homeFaq()
  const toolLink = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const homeDescription = `Free AI tool finder. Type a task, get ranked AI tools that fit. ${all.length} tools in ${Object.keys(CATEGORIES).length} categories, with quick answers by job. Updated ${UPDATED}.`
  const quickBlock = q ? '' : `
  <section class="section" id="quick-answer">
    <h2>Quick answer: which AI tool for which job</h2>
    <div class="grid">
      ${qa.map((j) => `<div class="card">
        <h3>${esc(j.job)}</h3>
        <p class="muted" style="margin:0 0 .5rem;font-size:.92rem">${quickLine(j, toolLink)}</p>
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
        <li>Featured listings are paid placements and never change a tool's rank.</li>
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
    <h1>Which AI tool should you use?</h1>
    <p>Free AI tool finder: type a task, get ranked tools that fit. BuildStack ranks real AI tools by use case, so you can also browse categories or skim new releases. Built for humans and chatbots.</p>
    <form class="searchbox" action="/" method="get" role="search">
      <input name="q" value="${esc(q)}" placeholder="e.g. write a React app, research papers, voiceover for a podcast" aria-label="Search use cases"/>
      <button type="submit">Find tools</button>
    </form>
  </section>
  ${q ? `<section class="section"><h2>Best fit for “${esc(q)}”</h2><div class="grid">${results.map(toolCard).join('') || '<p class="muted">No matches. Try a broader phrase.</p>'}</div></section>` : ''}
  ${q ? '' : `<p class="muted" style="margin:.9rem 0 0;font-size:.88rem">Last updated: ${UPDATED} · ${all.length} ranked tools · <a href="/methodology">How we rank</a></p>`}
  <section class="section" id="best-for">
    <h2>Find an AI tool by task</h2>
    <div class="pills">
      ${BEST_FOR.map((b) => `<a class="pill" href="/?q=${encodeURIComponent(b.query)}">${esc(b.title)}</a>`).join('')}
    </div>
  </section>
  ${quickBlock}
  ${featured.length ? `<section class="section"><h2>Featured</h2><div class="grid">${featured.map(toolCard).join('')}</div></section>` : ''}
  <section class="section" id="new">
    <h2>New releases</h2>
    <div class="grid">${news.map(toolCard).join('')}</div>
  </section>
  <section class="section">
    <h2>Top ranked</h2>
    <div class="grid">${tools().slice(0, 12).map(toolCard).join('')}</div>
    <p style="margin-top:1rem"><a href="/categories">Browse all categories →</a></p>
  </section>
  ${lowerBlock}
  <section class="section">
    <div class="panel">
      <h2 style="margin-top:0">Newsletter</h2>
      <p class="muted" style="margin:0">Occasional new-tool roundups. We store your email and do not sell it. No sends until the list is ready.</p>
      <form class="formrow" data-source="home" onsubmit="subscribe(event)">
        <input type="email" name="email" required placeholder="you@company.com" aria-label="Email"/>
        <button type="submit">Subscribe</button>
        <div class="notice" style="flex-basis:100%"></div>
      </form>
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
      }, {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        dateModified: UPDATED,
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
  const body = `
  <section class="hero">
    <h1>${esc(cat.label)}</h1>
    <p>${esc(cat.blurb)}</p>
    ${slug === 'coding' ? '<p class="muted">Switching editors? See the <a href="/alternatives/cursor">best Cursor alternatives, sorted by how you code</a>. New to coding? See the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>.</p>' : ''}
    ${slug === 'agents' ? '<p class="muted">Want to build an app with no coding? See the <a href="/best/ai-coding-agent-for-beginners">best AI coding agents for beginners</a>.</p>' : ''}
    ${slug === 'voice' ? '<p class="muted">Need a voiceover or a text to speech API? See the <a href="/best/ai-voice-generator">best AI voice generators and text to speech tools</a>.</p>' : ''}
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
      dateModified: UPDATED,
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
  const body = `
  <section class="hero">
    <div class="meta"><span class="rank">#${t.rank}</span><a class="tag" href="/category/${esc(t.category)}">${esc(CATEGORIES[t.category]?.label || t.category)}</a>${t.newRelease ? '<span class="tag new">New</span>' : ''}</div>
    <h1>${esc(t.name)}</h1>
    <p>${esc(t.tagline)}</p>
    <p>
      <a class="btn" href="${esc(t.url)}" rel="noopener noreferrer" target="_blank">Visit ${esc(t.name)}</a>
      <a class="btn secondary" href="/get-featured" style="margin-left:.5rem">Get featured</a>
    </p>
  </section>
  <section class="section panel prose">
    <p><strong>Overview.</strong> ${esc(t.description)}</p>
    <p><strong>Best for.</strong></p>
    <ul class="clean">${(t.bestFor || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    <p><strong>Pricing note.</strong> ${esc(t.pricingNote)}</p>
    <p class="muted">Official site: <a href="${esc(t.url)}" rel="noopener noreferrer" target="_blank">${esc(t.url)}</a></p>
    ${t.slug === 'cursor' ? '<p><strong>Compare.</strong> See the <a href="/alternatives/cursor">best Cursor alternatives, sorted by how you code</a>.</p>' : ''}
    ${(() => { const g = []; if (t.slug !== 'cursor' && CURSOR_ALT_GROUPS.some((x) => x.slugs.includes(t.slug))) g.push('<a href="/alternatives/cursor">Best Cursor alternatives</a>'); if (BEGINNER_PICKS.some((x) => x.slug === t.slug) || BEGINNER_GROW.includes(t.slug)) g.push('<a href="/best/ai-coding-agent-for-beginners">Best AI coding agents for beginners</a>'); if (RESEARCH_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-research-assistant">Best AI research assistants</a>'); if (FREE_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/free-ai-tools">Best free AI tools</a>'); if (VOICE_PICKS.some((x) => x.slug === t.slug)) g.push('<a href="/best/ai-voice-generator">Best AI voice generators</a>'); return g.length ? `<p class="muted">Listed in: ${g.join(' · ')}</p>` : '' })()}
  </section>
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
      }, breadcrumbs([
        ['Home', '/'],
        [CATEGORIES[t.category]?.label || t.category, `/category/${t.category}`],
        [t.name, `/tool/${t.slug}`],
      ])],
    },
  }))
})

app.get('/get-featured', (c) => {
  const link = c.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test_6oU00k5JhdKycn7aEC8so00'
  const mode = c.env.STRIPE_MODE || 'test'
  const body = `
  <section class="hero">
    <h1>Get featured on BuildStack</h1>
    <p>Put your AI tool at the top of the directory for 30 days. Includes homepage featured placement, category highlight, and a newsletter mention when sends begin.</p>
  </section>
  <section class="panel">
    <h2 style="margin-top:0">Featured listing · $99</h2>
    <ul class="clean muted">
      <li>Homepage featured slot</li>
      <li>Highlight on your category page</li>
      <li>Listing review for accuracy (real product required)</li>
      <li>Newsletter mention when the list launches</li>
    </ul>
    <p style="margin:1.2rem 0"><a class="btn" href="${esc(link)}" rel="noopener noreferrer" target="_blank">Pay with Stripe (${esc(mode)} mode)</a></p>
    <p class="muted">Currently using Stripe <strong>${esc(mode)}</strong> mode so you can try the checkout with test cards. Live charges stay off until Sampson approves.</p>
    <p class="muted">After payment, reply to the receipt or email <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a> with your logo, URL, and short description.</p>
  </section>`
  return c.html(layout({
    title: `Get featured | ${NAME}`,
    description: 'Feature your AI tool on BuildStack for 30 days via Stripe.',
    path: '/get-featured',
    body,
  }))
})

app.get('/methodology', (c) => {
  const all = tools()
  const catCounts = Object.entries(CATEGORIES)
    .map(([k, v]) => ({ k, label: v.label, n: all.filter((t) => t.category === k).length }))
  const featuredCount = all.filter((t) => t.featured).length
  const newCount = all.filter((t) => t.newRelease).length
  const description = `How ${NAME} ranks AI tools: one editorial rank per tool, category pages in rank order, use-case search scoring, and featured listings kept separate from rank. ${all.length} tools, updated ${UPDATED}.`
  const body = `
  <section class="hero">
    <h1>How BuildStack ranks AI tools</h1>
    <p>Short answer: every tool gets one editorial rank, from #1 to #${all.length}. Category pages and the full list show tools in that order. Search reorders tools by how well they match your words, and uses rank only to break ties. Paying for a featured listing does not change a tool's rank.</p>
    <p class="muted">Last updated: ${UPDATED} · ${all.length} tools</p>
  </section>
  <section class="panel prose">
    <h2 style="margin-top:0">One rank per tool</h2>
    <p>Each listing in the BuildStack data has a single rank number. Ranks are unique across the whole directory, so #1 is the top pick overall and no two tools share a number. The rank is an editorial judgment. It is not a benchmark score, a user vote, or a traffic count, and BuildStack does not publish scores behind it.</p>
    <p>When a new tool is added, it is placed at a rank and the tools below it move down one place. Ranks are set across categories, so a coding tool at #11 and a video tool at #33 sit on the same overall list.</p>

    <h2>Categories</h2>
    <p>Every tool belongs to exactly one of ${Object.keys(CATEGORIES).length} categories. A category page lists only that category's tools, still in overall rank order, so the first tool on a category page is the highest ranked tool in that category.</p>
    <ul class="clean">${catCounts.map((x) => `<li><a href="/category/${x.k}">${esc(x.label)}</a>: ${x.n} tools</li>`).join('')}</ul>

    <h2>How search works</h2>
    <p>When you type a job into the search box, BuildStack splits your words into terms and scores each tool. For each term:</p>
    <ul class="clean">
      <li>A match in the tool name adds 8 points.</li>
      <li>A match in one of the tool's best-for tags adds 5 points.</li>
      <li>A match in the category adds 4 points.</li>
      <li>A match anywhere in the listing (name, tagline, description, category, best-for tags, or pricing note) adds 2 points.</li>
    </ul>
    <p>Tools with no matches are left out. The rest are sorted by score, highest first. When two tools score the same, the higher ranked tool comes first. Search result pages are marked noindex so search engines index the real category and tool pages instead.</p>

    <h2>What each listing contains</h2>
    <p>Every tool page shows the rank, category, a tagline, a description, best-for tags, a short pricing note, and a link to the official site. Pricing notes are short summaries. Always check the official site for current prices.</p>

    <h2>New releases</h2>
    <p>Recently launched tools carry a New tag and appear in the New releases section of the homepage. The tag does not change rank. ${newCount} tools carry it right now.</p>

    <h2>Featured listings are separate from rank</h2>
    <p>Tool makers can pay for a <a href="/get-featured">featured listing</a>. A featured tool gets a Featured tag and a spot in the Featured section of the homepage. Its rank number stays the same, and search scoring ignores featured status. ${featuredCount ? `${featuredCount} tools are featured right now.` : 'No tools are featured right now.'}</p>

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
        dateModified: UPDATED,
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
  { id: 'open-local', title: 'Open weights and local models', intro: 'Models you can run yourself, then plug into an agent such as OpenCode or Cline.', slugs: ['recursive-flint', 'muse-spark-open', 'reflection-beam', 'deepseek'] },
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
  const description = `Best Cursor alternatives, sorted by how you code: ${list.slice(0, 4).map((t) => `${t.name} (#${t.rank})`).join(', ')} and more. ${list.length} coding tools from the ${NAME} ranking. Updated ${UPDATED}.`
  const title = `Best Cursor Alternatives in 2026, Sorted by How You Code | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><a class="tag" href="/category/coding">Coding</a><span class="tag">Guide</span></div>
    <h1>Best Cursor Alternatives in 2026, Sorted by How You Code</h1>
    <p><strong>Short answer:</strong> ${link(cursor)} is #${cursor.rank} overall on ${NAME}, so every alternative here ranks below it. ${shortHtml}. Pick by how you work, not by one overall winner.</p>
    <p class="muted">Last updated: ${UPDATED} · ${list.length} alternatives · <a href="/methodology">How we rank</a></p>
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
        dateModified: UPDATED,
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
const BEGINNER_PICKS = [
  { slug: 'lovable', build: 'Full-stack web apps and websites from a chat', where: 'Browser; hosting on Lovable Cloud', verdict: 'the most direct path from an idea to a working full-stack app when you have never written code' },
  { slug: 'bolt', build: 'Websites and web apps with a database', where: 'Browser; hosting included, even on the free plan', verdict: 'a fast way to try ideas in the browser, with hosting and databases on the free plan' },
  { slug: 'replit-agent', build: 'Apps you build, run, and deploy in Replit', where: 'Browser workspace on Replit; deploys from Replit', verdict: 'a good fit if you want to learn by building, with the code, the running app, and deployment in one place' },
  { slug: 'v0', build: 'Web app screens and React or Next.js starter apps', where: 'Browser; deploys to Vercel and syncs with GitHub', verdict: 'the best start when the look of your app matters most and you may hand the code to a developer later' },
]
const BEGINNER_GROW = ['cursor', 'github-copilot']
const BEGINNER_PATH = '/best/ai-coding-agent-for-beginners'
const BEGINNER_H1 = 'Best AI Coding Agents for Beginners (No Setup Required)'

function beginnerData() {
  const all = tools()
  const find = (s) => all.find((t) => t.slug === s)
  const picks = BEGINNER_PICKS.map((p) => ({ ...p, t: find(p.slug) })).filter((p) => p.t)
  const byRank = [...picks].sort((a, b) => a.t.rank - b.t.rank)
  const grow = BEGINNER_GROW.map(find).filter(Boolean)
  return { all, find, picks, byRank, grow }
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
  if (grow.length) faq.push({
    q: 'Which AI coding tool should a beginner move to after an app builder?',
    a: `When you want to work on the code itself, move to an AI code editor. BuildStack ranks ${grow.map((t) => `${t.name} #${t.rank}`).join(' and ')} overall. ${r('cursor')} is a full AI editor, and ${r('github-copilot')} adds AI to editors you may already use. See the Cursor alternatives guide for more options.`,
  })
  return faq
}

app.get(BEGINNER_PATH, (c) => {
  const d = beginnerData()
  const { find, picks, byRank, grow } = d
  if (!picks.length) return c.notFound()
  const faq = beginnerFaq(d)
  const link = (t) => `<a href="/tool/${esc(t.slug)}">${esc(t.name)}</a>`
  const rl = (s) => { const t = find(s); return t ? `${link(t)} (#${t.rank})` : '' }
  const rt = (s) => { const t = find(s); return t ? `${t.name} (#${t.rank})` : '' }
  const catLink = (t) => `<a href="/category/${esc(t.category)}">${esc(CATEGORIES[t.category]?.label || t.category)}</a>`
  const shortText = `For a first app with no setup, start with ${rt('lovable')} for a full web app from a chat, ${rt('bolt')} for quick builds with free hosting, ${rt('replit-agent')} to learn by building in one place, or ${rt('v0')} for polished screens you can deploy to Vercel. All four run in your browser, so there is nothing to install`
  const shortHtml = `For a first app with no setup, start with ${rl('lovable')} for a full web app from a chat, ${rl('bolt')} for quick builds with free hosting, ${rl('replit-agent')} to learn by building in one place, or ${rl('v0')} for polished screens you can deploy to Vercel. All four run in your browser, so there is nothing to install`
  const description = `Best AI coding agents for beginners, no setup required: ${byRank.map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')}. Where each runs, what you can build, and how to start free. Updated ${UPDATED}.`
  const title = `${BEGINNER_H1} | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><a class="tag" href="/category/coding">Coding</a><a class="tag" href="/category/agents">Agents</a><span class="tag">Guide</span></div>
    <h1>${esc(BEGINNER_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}. When you outgrow them, move to ${grow.map((t) => `${link(t)} (#${t.rank})`).join(' or ')}.</p>
    <p class="muted">Last updated: ${UPDATED} · ${picks.length} beginner picks · <a href="/methodology">How we rank</a></p>
  </section>
  <section class="section">
    <h2>Quick picks</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>What you can build</th><th>Runs where</th><th>Pricing note</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.build)}</td><td>${esc(p.where)}</td><td>${esc(p.t.pricingNote || 'See official site')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Pricing notes were checked on each official pricing page on ${UPDATED}. Prices and limits change, so check the official site before you pay.</p>
  </section>
  <section class="section">
    <h2>One-line verdict for each pick</h2>
    ${picks.map((p) => `<div class="panel prose" style="margin-bottom:1rem" id="${esc(p.slug)}">
      <h3 style="margin-top:0;color:var(--text)">${esc(p.t.name)} (#${p.t.rank}, ${catLink(p.t)})</h3>
      <p>${link(p.t)} is ${esc(p.verdict)}. ${esc(p.t.tagline)}. BuildStack lists it as best for ${esc(listNames(p.t.bestFor || []))}.</p>
      <p class="muted" style="margin-bottom:0">Runs where: ${esc(p.where)}. Pricing note: ${esc(p.t.pricingNote || 'See official site')}.</p>
    </div>`).join('')}
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
        <li><strong>Hosting:</strong> do you want the tool to put your app online for you? All four picks can publish your app.</li>
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
        dateModified: UPDATED,
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
  const description = `Best AI research assistants in 2026, including tools to summarize papers: ${byRank.slice(0, 6).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more. Sources each uses, pricing, and how to check a summary. Updated ${UPDATED}.`
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
    <p class="muted">Last updated: ${UPDATED} · ${picks.length} research picks · <a href="/methodology">How we rank</a></p>
  </section>
  <section class="section">
    <h2>AI research assistants at a glance</h2>
    <div class="panel" style="overflow-x:auto;padding:.5rem">
      <table class="cmp">
        <thead><tr><th>Tool</th><th>Rank</th><th>Best for</th><th>Sources it uses</th><th>Pricing note</th></tr></thead>
        <tbody>${byRank.map((p) => `<tr><td>${link(p.t)}</td><td>#${p.t.rank}</td><td>${esc(p.best)}</td><td>${esc(p.sources)}</td><td>${esc(p.t.pricingNote || 'See official site')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.88rem">Pricing notes were checked on each official pricing page on ${UPDATED}. Prices and limits change, so check the official site before you pay.</p>
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
        dateModified: UPDATED,
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
  { slug: 'chatgpt', group: 'writing', kind: 'plan', free: 'Free tier, with paid Plus and Pro plans for more use' },
  { slug: 'claude', group: 'writing', kind: 'plan', free: 'Free plan, with paid Pro and Max plans for more use' },
  { slug: 'grammarly', group: 'writing', kind: 'plan', free: 'Free version alongside paid Premium' },
  { slug: 'google-antigravity', group: 'coding', kind: 'plan', free: 'Free for individuals, with rate limits' },
  { slug: 'cursor', group: 'coding', kind: 'plan', free: 'Free Hobby tier' },
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
  { slug: 'descript', group: 'video', kind: 'plan', free: 'Free plan alongside paid plans' },
  { slug: 'elevenlabs', group: 'voice', kind: 'credits', free: '10,000 credits a month, for personal use only (no commercial license)' },
  { slug: 'otter', group: 'voice', kind: 'plan', free: 'Free Basic plan' },
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
    a: `Yes. ${r('google-antigravity')} is free for individuals with rate limits, ${r('cursor')} has a free Hobby tier, and ${r('windsurf')} has a $0 plan. ${r('cline')} is open source and you pay only for the AI model it calls. To build an app without coding, ${r('bolt')} and ${r('lovable')} have free plans with monthly or daily credits.`,
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
  const description = `Best free AI tools in 2026 by task: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with what each free plan includes and the limits to watch. Updated ${UPDATED}.`
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
    <p class="muted">Last updated: ${UPDATED} · Free plans checked on ${UPDATED} · ${picks.length} free picks · <a href="/methodology">How we rank</a></p>
  </section>
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
        dateModified: UPDATED,
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
    price: 'API launch price $10 per 1M characters through November 12, 2026, then $50 list; creator plans on fish.audio; open weights free for commercial use under US$500K annual revenue',
    why: 'Fish Audio Drama 3 is built for performance rather than plain reading. It suits audiobooks, audio drama, and character dialogue where you want to direct how each line is delivered. You can use it in the Fish Audio app, call the API, or download the open weights and run it yourself.',
    watch: 'The $10 launch price ends November 12, 2026. The open-weight license bans cloning a real person\'s voice without their consent.' },
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
    price: 'Free plan with the v6-mini model; paid Pro and Premier plans add the v6 and v6-wild models',
    why: 'Suno is not a text to speech tool, but if what you need is a sung vocal, a jingle, or a song draft, it is the faster route. You describe the song or paste lyrics and it generates the track with vocals.',
    watch: 'Check which plan includes commercial rights before you publish a track.' },
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
      a: `Among the APIs on this page with published per-character prices, ${r('fish-audio-drama-3')} is $10 per 1M characters through November 12, 2026 ($50 list after that), ${r('mistral-voxtral-3')} is $13 per 1M characters for Voxtral Mini TTS 3, and ${r('assemblyai-tts-1')} is $15 per 1M characters with every voice and cloning included. Running ${r('gradium-phonon')} on your own device has no per-character fee at all.` },
    { q: 'Can I use AI voices commercially on YouTube?',
      a: 'Often, but it depends on your plan and license. On ElevenLabs the free plan has no commercial license, so you need a paid plan. Open-weight models come with their own licenses, such as the US$500K revenue limit on Fish Audio Drama 3. Read the license for the plan you use, and follow YouTube\'s own rules on disclosing synthetic content.' },
    { q: 'Is it legal to clone a voice with AI?',
      a: 'Cloning your own voice, or a voice you have clear permission to use, is the safe path. Cloning a real person without consent can break the tool\'s terms and, depending on where you are, laws on likeness and fraud. AssemblyAI asks you to confirm the speaker\'s permission before cloning, and the Fish Audio Drama 3 license bans cloning a real person\'s voice without consent. This is not legal advice; ask a lawyer for anything commercial or sensitive.' },
  ]
}

app.get(VOICE_PATH, (c) => {
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
  const description = `Best AI voice generators and text to speech tools in 2026: ${byRank.slice(0, 5).map((p) => `${p.t.name} (#${p.t.rank})`).join(', ')} and more, with verified pricing and what each is best for. Updated ${UPDATED}.`
  const title = `Best AI Voice Generators and Text to Speech in 2026 | ${NAME}`
  const body = `
  <section class="hero">
    <div class="meta"><span class="tag">Guide</span><span class="tag">Voice</span></div>
    <h1>${esc(VOICE_H1)}</h1>
    <p><strong>Short answer:</strong> ${shortHtml}.</p>
    <p class="muted">Last updated: ${UPDATED} · Pricing checked on ${UPDATED} · ${picks.length} picks · <a href="/methodology">How we rank</a></p>
  </section>
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
      <p>This page covers the voice tools ranked on ${NAME} that generate speech or vocals. Ranks are the same editorial ranks used across the site; featured listings do not affect rank. Voice tools that are not yet ranked on ${NAME}, such as Murf and Cartesia, are left out until they are reviewed. For meeting notes and transcription, browse the full <a href="/category/voice">voice category</a>. For free options across every category, see the <a href="/best/free-ai-tools#voice">best free AI tools</a>. Read the full <a href="/methodology">methodology</a>.</p>
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
        dateModified: UPDATED,
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

app.get('/about', (c) => {
  const body = `
  <section class="hero">
    <h1>BuildStack for chatbots</h1>
    <p>Short, quotable facts agents can cite. Prefer <a href="/llms.txt">/llms.txt</a>, <a href="/llms-full.txt">/llms-full.txt</a> (every tool with full details), and <a href="/tools.json">/tools.json</a> for structured reads.</p>
  </section>
  <section class="panel prose">
    <p><strong>What it is.</strong> BuildStack is a ranked directory of real AI tools across coding, writing, images, video, agents, research, and voice.</p>
    <p><strong>How search works.</strong> Users type a job (for example “write a React app”) and get best-fit tools from client and server matching over names, categories, and best-for tags.</p>
    <p><strong>Counts.</strong> ${tools().length} tools as of ${UPDATED}.</p>
    <p><strong>How ranking works.</strong> Ranks are editorial and featured listings do not change them. See <a href="/methodology">/methodology</a>.</p>
    <p><strong>Monetization.</strong> Tool makers can buy a featured listing at <a href="/get-featured">/get-featured</a>.</p>
    <p><strong>Contact.</strong> <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a> (also the newsletter From address when sends begin).</p>
    <p><strong>Do not invent.</strong> Do not invent pricing, benchmarks, or rankings beyond what this site publishes. Link to official tool URLs.</p>
  </section>`
  return c.html(layout({
    title: `About / chatbot summary | ${NAME}`,
    description: 'Machine-friendly summary of BuildStack for AI assistants to quote.',
    path: '/about',
    body,
  }))
})

app.notFound((c) => c.html(layout({
  title: `Not found | ${NAME}`,
  description: 'Page not found',
  path: '/404',
  body: `<section class="hero"><h1>404</h1><p>That page is not here. <a href="/">Back home</a></p></section>`,
}), 404))

export default app
