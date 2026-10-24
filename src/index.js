import { Hono } from 'hono'
import toolsData from './tools.json'

const app = new Hono()
const SITE = 'https://buildstack.tier11.com'
const NAME = 'BuildStack'
const UPDATED = '2026-10-24'

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
    <div style="margin-top:.4rem">Contact: <a href="mailto:buildstack@tier11.com">buildstack@tier11.com</a> · <a href="/methodology">How we rank</a> · <a href="/sitemap.xml">Sitemap</a> · <a href="/robots.txt">robots.txt</a> · Hosted on Cloudflare</div>
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
    '', '/categories', '/methodology', '/get-featured', '/about', '/llms.txt', '/llms-full.txt', '/tools.json',
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
