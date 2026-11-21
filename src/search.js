const CLOSED_CLASS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'at', 'by', 'from',
  'ai', 'my', 'best', 'tool', 'tools',
])

const CATEGORY_SLUGS = ['coding', 'writing', 'images', 'video', 'agents', 'research', 'voice']

const HYPHEN_PREFIXES = new Set(['pre', 'post', 'non', 'mid', 'anti', 'sub', 'multi', 'over', 'under', 'auto'])

const LEMMA_GROUPS = [
  ['edit', 'editor', 'editing', 'edits', 'edited'],
  ['site', 'sites', 'website', 'websites', 'webpage', 'webpages'],
  ['transcribe', 'transcription', 'transcribing', 'transcribed'],
  ['translate', 'translation', 'translator', 'translating', 'translated', 'translations'],
  ['presentation', 'presentations'],
  ['logo', 'logos'],
  ['email', 'emails'],
  ['pdf', 'pdfs'],
  ['chatbot', 'chatbots'],
  ['phone', 'phones', 'telephony', 'telephone'],
  ['podcast', 'podcasts'],
  ['background', 'backgrounds'],
  ['inbox', 'inboxes'],
  ['summarize', 'summarise', 'summarizes', 'summarizing', 'summarized', 'summary', 'summaries', 'brief', 'briefs'],
  ['photo', 'photos', 'photograph', 'photographs', 'picture', 'pictures', 'image', 'images'],
]

const JOB_HINTS = [
  { any: ['blog', 'blogs'], add: ['write'], category: 'writing' },
  { any: ['logo', 'logos'], add: ['logo'], category: 'images' },
  { any: ['presentation', 'presentations', 'slides', 'deck', 'decks'], add: ['presentation'] },
  { any: ['podcast', 'podcasts'], add: ['podcast'] },
  { any: ['phone'], add: ['phone'] },
  { any: ['chatbot', 'chatbots'], add: ['chatbot'], category: 'agents' },
  { any: ['browser'], add: ['browser'], category: 'agents' },
  { any: ['translate', 'translation', 'translator'], add: ['translate'], category: 'writing' },
  { any: ['website', 'websites', 'webpage', 'webpages'], add: ['website'] },
  { all: ['video', 'text'], add: ['text-to-video'] },
  // Building an app is app-builder work, which BuildStack files under coding. R4 would otherwise
  // drop the group, since "app" spreads across most categories.
  { all: ['build', 'app'], add: [], category: 'coding' },
]

const LIGHT_VERBS = new Set(['write', 'make', 'create', 'build', 'get', 'use', 'find'])

const ACTION_STEMS = new Set(['transcribe', 'edit', 'translate', 'summarize', 'remove'])

const PRICE_TERMS = new Set(['cheapest', 'cheap', 'free', 'budget', 'affordable', 'inexpensive'])

const KEY_TERMS = new Set([
  'phone', 'chatbot', 'chatbots', 'browser', 'logo', 'logos', 'presentation', 'presentations',
  'website', 'websites', 'webpage', 'webpages', 'site', 'sites',
  'podcast', 'podcasts', 'pdf', 'pdfs', 'inbox', 'inboxes', 'translate', 'translation',
  'translator', 'email', 'emails', 'background', 'backgrounds',
])

const GENERIC_NAME_TOKENS = new Set([
  'make', 'write', 'create', 'build', 'get', 'use', 'find', 'run', 'flow', 'can', 'app', 'apps',
])

const DEV_QUERY_TERMS = new Set([
  'api', 'model', 'models', 'openweight', 'weights', 'inference', 'finetune', 'selfhosted',
])

// Filler words from /methodology. Phrase pairs (R3) skip these but keep short words like "ai".
const PHRASE_FILLER = new Set(['a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'at', 'by', 'from', 'my', 'your'])

// Head nouns that say what kind of thing you want, not what it should do ("coding assistant",
// "image generator"). They still score, but they do not count toward term coverage (R1) or phrases.
const GENERIC_HEADS = new Set(['assistant', 'assistants', 'generator', 'generators', 'maker', 'makers', 'software', 'platform', 'platforms'])

function isInflection(stem, word) {
  if (word === stem) return true
  if (stem.length < 3) return false
  if (!stem.endsWith('w') && word === `${stem}s`) return true
  if (/(?:s|x|z|ch|sh)$/.test(stem) && word === `${stem}es`) return true
  if (stem.endsWith('y') && stem.length > 3 && word === `${stem.slice(0, -1)}ies`) return true
  if (stem.endsWith('e')) {
    const root = stem.slice(0, -1)
    if (word === `${root}ing` || word === `${root}ed`) return true
  }
  if (word === `${stem}ing` || word === `${stem}ed`) return true
  if (word === `${stem}${stem.slice(-1)}ing`) return true
  return false
}

function lemmaRoot(word) {
  for (const group of LEMMA_GROUPS) {
    if (group.includes(word)) return group[0]
  }
  return null
}

function formsMatch(left, right) {
  if (isInflection(left, right) || isInflection(right, left)) return true
  const a = lemmaRoot(left)
  const b = lemmaRoot(right)
  return Boolean(a && a === b)
}

function rawWords(value) {
  const text = String(value ?? '').toLowerCase()
  const tokens = text.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []
  const words = []
  for (const token of tokens) {
    if (!token.includes('-')) {
      words.push(token)
      continue
    }
    const parts = token.split('-')
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 && HYPHEN_PREFIXES.has(parts[0])) continue
      words.push(parts[i])
    }
  }
  return words
}

function camelParts(piece) {
  const parts = piece
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || []
  if (parts.length < 2 || parts.some((part) => part.length < 4)) return []
  return parts
}

function wordsOf(value, splitNames) {
  const words = rawWords(value)
  if (!splitNames) return words
  const extra = []
  for (const piece of String(value ?? '').split(/[^A-Za-z0-9]+/)) extra.push(...camelParts(piece))
  return [...new Set([...words, ...extra])]
}

function stripNoCode(query) {
  const text = String(query ?? '')
  const nocode = /\b((without|no)\s+code|no-code|nocode)\b/i.test(text)
  const cleaned = text.replace(/\b((without|no)\s+code|no-code|nocode)\b/gi, ' ')
  return { text: cleaned, nocode }
}

function queryTerms(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !CLOSED_CLASS.has(term))
}

function textHit(term, value, splitNames = false) {
  const raw = String(value ?? '').toLowerCase()
  if (/[^a-z0-9]/.test(term)) return raw.includes(term)
  const words = wordsOf(value, splitNames)
  if (!words.some((word) => formsMatch(term, word))) return false
  if (lemmaRoot(term) === 'browser' || term === 'browser') {
    const stripped = raw
      .replace(/\b(in|inside|from|via|through|on|with)\s+(the|your|a|an)?\s*browser\b/g, ' ')
      .replace(/\bbrowser-based\b/g, ' ')
      .replace(/\bin-browser\b/g, ' ')
    if (!/\bbrowser/.test(stripped) && !wordsOf(stripped, splitNames).some((word) => formsMatch('browser', word))) {
      return false
    }
  }
  if (lemmaRoot(term) === 'email' || term === 'email' || term === 'emails') {
    const stripped = raw
      .replace(/\bconfirming your email\b/g, ' ')
      .replace(/\bemail address(es)?\b/g, ' ')
      .replace(/\bemail support\b/g, ' ')
      .replace(/\b(contact|by|via|per) email\b/g, ' ')
    if (!wordsOf(stripped, splitNames).some((word) => formsMatch('email', word) || formsMatch('emails', word))) {
      return false
    }
  }
  return true
}

function categorySlug(term) {
  return CATEGORY_SLUGS.find((slug) => formsMatch(term, slug)) || null
}

function namesCategory(term, slug) {
  return term === slug || `${term}s` === slug || term === `${slug}s`
}

function categoryLeader(categories) {
  const counts = new Map()
  for (const category of categories) counts.set(category, (counts.get(category) || 0) + 1)
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!ordered.length) return null
  const [leader, count] = ordered[0]
  const second = ordered[1]?.[1] || 0
  if (second === 0) return leader
  if (count >= 3 && count > second) return leader
  return null
}

function queryIntent(list, terms) {
  const noted = terms.map((term) => {
    if (term.length < 3 && !/[^a-z0-9]/.test(term)) {
      return { term, count: 0, spread: 0, share: 0, lead: null, slug: null, specific: false, unanimous: false }
    }
    const distinctive = list.filter((tool) => (
      textHit(term, tool.name) || textHit(term, (tool.bestFor || []).join(' '))
    ))
    const lead = categoryLeader(distinctive.map((tool) => tool.category))
    const slug = LIGHT_VERBS.has(term) ? null : categorySlug(term)
    const unanimous = Boolean(lead) && distinctive.every((tool) => tool.category === lead)
    return {
      term,
      spread: new Set(distinctive.map((tool) => tool.category)).size,
      share: distinctive.length ? Math.max(...distinctive.map((tool) => distinctive.filter((other) => other.category === tool.category).length)) / distinctive.length : 0,
      count: distinctive.length,
      lead,
      slug,
      unanimous,
      specific: Boolean(lead) && (!slug || lead === slug),
    }
  })
  const family = noted.filter((item) => item.slug)
  const exactFamily = family.filter((item) => namesCategory(item.term, item.slug))
  const pointed = noted.filter((item) => item.specific && !item.slug && item.unanimous)
  const pointedAgrees = pointed.filter((item) => exactFamily.some((entry) => entry.slug === item.lead))
  const usablePointed = exactFamily.length ? pointedAgrees : pointed
  const familySpecific = noted.filter((item) => item.specific && item.slug)
  const fallback = noted.filter((item) => item.specific)
  const pool = usablePointed.length ? usablePointed : (familySpecific.length ? familySpecific : (family.length ? family : fallback))
  if (!pool.length) return null
  pool.sort((a, b) => a.count - b.count || a.term.localeCompare(b.term))
  const chosen = pool[0]
  // R4: when the narrowest word matches tools in 2+ categories and no category holds two thirds
  // of those matches, skip the category group, unless the word is itself a category word.
  if (!chosen.slug && chosen.spread >= 2 && chosen.share < 2 / 3) return null
  if (chosen.slug && chosen.lead !== chosen.slug) return chosen.slug
  return chosen.lead || chosen.slug
}

function compact(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function nameLead(query, tool) {
  const q = compact(query)
  const n = compact(tool.name)
  if (!q || !n) return false
  if (n === q) return true
  if (q.length >= 3 && n.startsWith(q)) return true
  const terms = queryTerms(query).filter((term) => !LIGHT_VERBS.has(term) && !isPriceTerm(term))
  return terms.length >= 2 && terms.every((term) => textHit(term, tool.name, true))
}

function expandTerms(terms) {
  const seen = new Set(terms)
  const added = []
  const categories = []
  for (const hint of JOB_HINTS) {
    const pool = hint.any || hint.all || []
    const hit = hint.all
      ? hint.all.every((key) => terms.some((term) => formsMatch(term, key)))
      : pool.some((key) => terms.some((term) => formsMatch(term, key)))
    if (!hit) continue
    for (const extra of hint.add || []) {
      if (!seen.has(extra)) {
        seen.add(extra)
        added.push(extra)
      }
    }
    if (hint.category) categories.push(hint.category)
  }
  return { terms: [...terms, ...added], category: categories[0] || null }
}

function dropLightVerbs(terms, intent) {
  const heavy = terms.filter((term) => !LIGHT_VERBS.has(term))
  if (!heavy.length) return terms
  const kept = []
  for (const term of terms) {
    if (!LIGHT_VERBS.has(term)) {
      kept.push(term)
      continue
    }
    const family = categorySlug(term)
    // Keep "write" when the query is already in the writing category, since
    // write/writing is how general writing tools match "write blog posts".
    if (family && (!intent || intent === family)) {
      kept.push(term)
      continue
    }
    // Drop ordinary verbs like "make" and "build" so a tool name cannot win the job.
  }
  return kept.length ? kept : terms
}

function isActionTerm(term) {
  if (ACTION_STEMS.has(term)) return true
  return [...ACTION_STEMS].some((stem) => formsMatch(term, stem) || lemmaRoot(term) === stem)
}

function isPriceTerm(term) {
  return PRICE_TERMS.has(term)
}

function isKeyTerm(term) {
  if (KEY_TERMS.has(term)) return true
  return [...KEY_TERMS].some((key) => {
    if (formsMatch(term, key)) return true
    const a = lemmaRoot(term)
    const b = lemmaRoot(key)
    return Boolean(a && a === b)
  })
}

function isDevQuery(terms) {
  return terms.some((term) => DEV_QUERY_TERMS.has(term) || formsMatch(term, 'model') || term === 'open-weight' || term === 'self-hosted' || term === 'fine-tune')
}

function isModelTool(tool) {
  const tag = String(tool.tagline || '').toLowerCase()
  const price = String(tool.priceFrom || '')
  const best = (tool.bestFor || []).join(' ').toLowerCase()
  const note = String(tool.pricingNote || '')
  const blob = `${tag} ${best} ${note.toLowerCase()}`
  if (/\bopen-weight\b|\bopen weights?\b/.test(blob)) return true
  if (/^API\b/i.test(price) || /\bper 1M\b/i.test(price)) return true
  // When priceFrom is absent (tests strip it), still detect API models from the pricing note.
  // Do not use this fallback when a consumer plan price is present, or apps with an API
  // add-on (ChatGPT Images) get treated as raw models.
  if ((!price || /^see (pricing|site)$/i.test(price)) && /\bAPI\b/.test(note) && /\bper 1M\b/i.test(note)) return true
  if (/\bvoice agent model\b/.test(tag)) return true
  if (/\bself-hosted\b/.test(blob) && /\b(model|speech|pipeline|inference)\b/.test(blob)) return true
  if (/\bmodel for\b/.test(tag) && (/^API\b/i.test(price) || /\b(fine-tuning|harnesses|pipelines|self-hosted)\b/.test(blob))) return true
  return false
}

function isDiscontinued(tool) {
  return /^discontinued$/i.test(String(tool.priceFrom || '').trim())
}

function isAvailabilityLimited(tool) {
  const blob = [tool.pricingNote, tool.description].join(' ')
  return /api[^.!?]{0,100}not live/i.test(blob)
}

function priceBucket(tool) {
  const price = String(tool.priceFrom || '').trim().toLowerCase()
  if (price === 'free' || /^free\b/.test(price)) return 0
  if (tool.freeTier) return 1
  return 2
}

// R3: adjacent query words, including short ones like "ai", side by side in a field.
function phrasePairs(query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
  const pairs = []
  for (let i = 0; i + 1 < words.length; i++) {
    const [a, b] = [words[i], words[i + 1]]
    if (!a || !b || PHRASE_FILLER.has(a) || PHRASE_FILLER.has(b) || isPriceTerm(a) || isPriceTerm(b)) continue
    if (GENERIC_HEADS.has(a) || GENERIC_HEADS.has(b)) continue
    if (/[^a-z0-9]/.test(a) || /[^a-z0-9]/.test(b)) continue
    pairs.push([a, b])
  }
  return pairs
}

function phraseHit(pair, value) {
  const words = rawWords(value)
  for (let i = 0; i + 1 < words.length; i++) {
    if (formsMatch(pair[0], words[i]) && formsMatch(pair[1], words[i + 1])) return true
  }
  return false
}

function nameTokenBonus(term, tool, exactName) {
  if (!textHit(term, tool.name, true)) return 0
  if (exactName) return 8
  const compactName = compact(tool.name)
  if (compact(term) === compactName) return 8
  const nameWords = wordsOf(tool.name, true)
  const distinctive = nameWords.some((word) => formsMatch(term, word) && !LIGHT_VERBS.has(word) && !GENERIC_NAME_TOKENS.has(word) && !CLOSED_CLASS.has(word))
  return distinctive ? 8 : 0
}

export function rankTools(list, query) {
  const ranked = [...list].sort((a, b) => a.rank - b.rank)
  const stripped = stripNoCode(query)
  const expanded = expandTerms(queryTerms(stripped.text))
  let terms = expanded.terms
  if (stripped.nocode && !terms.includes('website') && terms.some((term) => formsMatch(term, 'website') || formsMatch(term, 'app'))) {
    // "without code" already removed the word "code"; keep the remaining job terms.
  }
  if (!terms.length) return ranked
  const full = compact(query)
  const priceIntent = terms.some(isPriceTerm)
  const devQuery = isDevQuery(terms)
  const matchTerms = terms.filter((term) => !isPriceTerm(term))
  const intent = expanded.category || queryIntent(list, matchTerms.length ? matchTerms : terms)
  const scoredTerms = dropLightVerbs(matchTerms.length ? matchTerms : terms, intent)
  if (!scoredTerms.length) return ranked
  const actions = scoredTerms.filter(isActionTerm)
  const asked = queryTerms(stripped.text)
  const keyTerms = scoredTerms.filter((term) => (
    isKeyTerm(term)
    && !isActionTerm(term)
    && !categorySlug(term)
    && asked.some((item) => item === term || formsMatch(item, term))
  ))
  // R1: the user's own scored words, one per word family. Words added by job hints, price words,
  // light verbs, filler, and generic head nouns do not count.
  const contentTerms = []
  for (const term of scoredTerms) {
    if (GENERIC_HEADS.has(term)) continue
    if (!asked.some((item) => item === term || formsMatch(item, term))) continue
    if (contentTerms.some((seen) => formsMatch(seen, term))) continue
    contentTerms.push(term)
  }
  const pairs = phrasePairs(stripped.text)
  const specificTerms = scoredTerms.filter((term) => (
    !LIGHT_VERBS.has(term)
    && !isActionTerm(term)
    && !categorySlug(term)
    && !isPriceTerm(term)
    && term.length >= 3
  ))
  const rows = []
  for (const tool of ranked) {
    const exact = Boolean(full) && full === compact(tool.name)
    const named = exact || nameLead(query, tool)
    if (isDiscontinued(tool) && !named) continue
    const best = (tool.bestFor || []).join(' ')
    const hay = [tool.name, tool.tagline, tool.description, tool.category, best, tool.pricingNote || ''].join(' ')
    let score = 0
    let specific = 0
    for (const term of scoredTerms) {
      const rawName = nameTokenBonus(term, tool, exact)
      // R2: a name match on the word for the chosen category scores as a category match.
      const name = rawName && !exact && intent && categorySlug(term) === intent ? 4 : rawName
      const bestHit = textHit(term, best)
      const category = textHit(term, tool.category)
      const anywhere = textHit(term, hay, true)
      if (name) score += name
      if (bestHit) score += 5
      if (category) score += 4
      if (anywhere) score += 2
      if (!categorySlug(term) && (name || bestHit)) specific += 1
    }
    if (!score) continue
    const covered = new Set(contentTerms.filter((term) => textHit(term, hay, true)))
    const fields = [tool.name, tool.tagline, ...(tool.bestFor || [])]
    for (const pair of pairs) {
      if (fields.some((field) => phraseHit(pair, field))) score += 6
    }
    const cover = covered.size
    if (!named && keyTerms.length && !keyTerms.some((term) => textHit(term, hay, true))) continue
    const strong = scoredTerms.some((term) => textHit(term, tool.name, true) || textHit(term, best))
    if (!named && intent && tool.category !== intent && !strong) continue
    const band = named ? 0 : (intent && tool.category === intent ? 1 : 2)
    const job = actions.length ? (actions.some((term) => textHit(term, hay, true)) ? 1 : 0) : 1
    const surface = (!devQuery && !named && isModelTool(tool)) ? 1 : 0
    const limited = (!named && isAvailabilityLimited(tool)) ? 1 : 0
    const price = priceIntent ? priceBucket(tool) : 0
    const exactness = exact ? 0 : (named ? 1 : 2)
    rows.push({ tool, score, specific, band, job, surface, limited, price, exactness, cover, named })
  }
  // R1: when any tool matches 2+ of the query's words, tools that match only 1 are weak: they sort
  // after the rest and stay out of the numbered results. Apps come before raw models and APIs
  // unless the query asks for one; when no app is a strong match, models are not held back.
  const most = Math.max(0, ...rows.filter((row) => !row.named).map((row) => row.cover))
  for (const row of rows) row.weak = !row.named && most >= 2 && row.cover < 2 ? 1 : 0
  const appsStrong = rows.some((row) => !row.named && !row.weak && !row.surface)
  for (const row of rows) row.held = appsStrong ? row.surface : 0
  rows.sort((a, b) => (
    (a.named ? 0 : 1) - (b.named ? 0 : 1)
    || a.exactness - b.exactness
    || a.held - b.held
    || a.weak - b.weak
    || a.band - b.band
    || b.cover - a.cover
    || a.limited - b.limited
    || a.surface - b.surface
    || b.job - a.job
    || b.specific - a.specific
    || a.price - b.price
    || b.score - a.score
    || a.tool.rank - b.tool.rank
  ))
  const out = rows.map((row) => row.tool)
  const shown = rows.filter((row) => row.named || (!row.weak && !row.held)).length
  Object.defineProperty(out, 'shownCount', { value: shown, enumerable: false })
  return out
}

// The numbered results a search shows: at most n, never a weak match (R1) or a held-back model.
// They are always the first results, so the rest follow under "Show all" in the same order.
export function topShown(results, n) {
  const shown = typeof results?.shownCount === 'number' && results.shownCount > 0 ? results.shownCount : results.length
  return results.slice(0, Math.min(n, shown))
}

// R8: how many of a related search's own words appear in the given text (word forms count).
export function sharedWords(phrase, text) {
  const own = [...new Set(rawWords(phrase))].filter((word) => !CLOSED_CLASS.has(word) && !PHRASE_FILLER.has(word) && !LIGHT_VERBS.has(word) && !GENERIC_HEADS.has(word))
  const words = rawWords(text)
  return own.filter((word) => words.some((other) => formsMatch(word, other))).length
}
