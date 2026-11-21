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
  ['translate', 'translation', 'translator', 'translating', 'translated', 'translations', 'localize', 'localise', 'localization', 'localisation'],
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
  ['remove', 'removal', 'remover', 'removes', 'removing', 'removed'],
]

// Query synonyms: a search word also matches these listing words. They score and count as the
// same matched word, but the category group is chosen from the literal words only.
const SYNONYM_GROUPS = [
  ['presentation', 'presentations', 'slides', 'slide', 'slideshow', 'slideshows', 'deck', 'decks', 'powerpoint'],
  ['pdf', 'pdfs', 'document', 'documents', 'paper', 'papers'],
  ['chatbot', 'chatbots', 'helpdesk', 'helpdesks'],
  ['blog', 'blogs', 'article', 'articles'],
]

// Two-word ideas that count as one matched word (R1) when a listing says them any of these ways.
// Query-side patterns follow the Nov 21 synonym map (search phrase -> also match).
const CONCEPTS = [
  { query: /\b(ai|agentic|web)[\s-]+browsers?\b/i, listing: /\b(ai|agentic|web|ai-powered)[\s-]+browsers?\b/i },
  { query: /\b((without|no)[\s-]+code|nocode|no-code)\b/i, listing: /\b((without|no)[\s-]+code|nocode|no-code)\b/i, websiteBuild: true },
  { query: /\bnote[\s-]*takers?\b/i, listing: /\b(note[\s-]*takers?|meeting[\s-]+notes)\b/i },
  { query: /\b(slide[\s-]+decks?|pitch[\s-]+decks?)\b/i, listing: /\b(slide[\s-]+decks?|pitch[\s-]+decks?)\b/i },
  { query: /\bcustomer[\s-]+support\b/i, listing: /\b(customer[\s-]+support|customer[\s-]+service|support[\s-]+desk|helpdesks?)\b/i },
  { query: /\bphone[\s-]+calls?\b/i, listing: /\b(phone[\s-]+calls?|voice[\s-]+agents?|outbound[\s-]+calls?|receptionists?|calling)\b/i },
  { query: /\bremove[\s-]+backgrounds?\b|\bbackground[\s-]+removers?\b/i, listing: /\b(remove[\s-]+backgrounds?|background[\s-]+removers?|cutouts?|transparent[\s-]+backgrounds?)\b/i },
  { query: /\blanding[\s-]+pages?\b/i, listing: /\b(landing[\s-]+pages?|web[\s-]+pages?)\b/i },
  { query: /\bblog[\s-]+posts?\b/i, listing: /\b(blog[\s-]+posts?|articles?|blogs?)\b/i },
  { query: /\bchatbots?\b|\bchat[\s-]+bots?\b|\blive[\s-]+chats?\b|\bsupport[\s-]+agents?\b/i, listing: /\b(chatbots?|chat[\s-]+bots?|live[\s-]+chats?|support[\s-]+agents?|helpdesks?)\b/i },
]

// One-way phrase aliases for a query word (the review's "also match" phrases).
const TERM_PHRASES = {
  presentation: ['slide deck', 'pitch deck'],
  presentations: ['slide deck', 'pitch deck'],
  website: ['landing page'],
  websites: ['landing page'],
}

const JOB_HINTS = [
  { any: ['blog', 'blogs'], add: ['write'], category: 'writing' },
  { any: ['logo', 'logos'], add: ['logo'], category: 'images' },
  { any: ['presentation', 'presentations', 'slides', 'deck', 'decks'], add: ['presentation'] },
  { any: ['podcast', 'podcasts'], add: ['podcast'] },
  { any: ['phone'], add: ['phone'] },
  { any: ['notetaker', 'notetakers'], add: [], category: 'voice' },
  { all: ['note', 'taker'], add: [], category: 'voice' },
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

const PRICE_TERMS = new Set(['cheapest', 'cheap', 'cheaper', 'free', 'budget', 'affordable', 'inexpensive', 'lowcost'])

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
  'api', 'apis', 'model', 'models', 'openweight', 'weights', 'inference', 'finetune', 'selfhosted',
  'sdk', 'sdks', 'local', 'locally', 'offline', 'opensource', 'selfhost', 'self-host', 'self-hosting',
])

// R5: listing types that wait behind apps. A search that names the kind of tool keeps it in place.
const NON_APP_TYPES = new Set(['api-model', 'open-weight-model', 'infrastructure', 'developer-tool', 'extension'])
const TYPE_WORDS = {
  extension: ['extension', 'plugin', 'addon', 'chrome', 'mcp'],
  'developer-tool': ['cli', 'terminal', 'sdk', 'devtool', 'mcp'],
  infrastructure: ['api', 'crawl', 'crawler', 'scrape', 'scraper', 'scraping', 'rag', 'markdown', 'infrastructure'],
}

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

function synonymRoot(word) {
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(word)) return group[0]
  }
  return null
}

function formsMatch(left, right, literal = false) {
  if (isInflection(left, right) || isInflection(right, left)) return true
  const a = lemmaRoot(left)
  const b = lemmaRoot(right)
  if (a && a === b) return true
  if (literal) return false
  const c = synonymRoot(left)
  return Boolean(c && c === synonymRoot(right))
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
  const extra = []
  if (splitNames) {
    for (const piece of String(value ?? '').split(/[^A-Za-z0-9]+/)) extra.push(...camelParts(piece))
  }
  for (const word of words) {
    if (word === 'notetaker' || word === 'notetakers') extra.push('note', 'taker')
  }
  return extra.length ? [...new Set([...words, ...extra])] : words
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

function textHit(term, value, splitNames = false, literal = false) {
  const raw = String(value ?? '').toLowerCase()
  if (/[^a-z0-9]/.test(term)) return raw.includes(term)
  const words = wordsOf(value, splitNames)
  if (!words.some((word) => formsMatch(term, word, literal))) {
    const phrases = !literal && (TERM_PHRASES[term] || TERM_PHRASES[lemmaRoot(term) || ''] || TERM_PHRASES[synonymRoot(term) || ''])
    if (!phrases || !phrases.some((phrase) => raw.includes(phrase))) return false
  }
  if (lemmaRoot(term) === 'browser' || term === 'browser') {
    const stripped = raw
      .replace(/\b(in|inside|from|via|through|on|with)\s+(the|your|a|an)?\s*browser\b/g, ' ')
      .replace(/\bbrowser-based\b/g, ' ')
      .replace(/\bin-browser\b/g, ' ')
    if (!/\bbrowser/.test(stripped) && !wordsOf(stripped, splitNames).some((word) => formsMatch('browser', word))) {
      return false
    }
  }
  if (synonymRoot(term) === 'presentation') {
    const stripped = raw.replace(/\b(turn|turns|turning|convert|converts|converting)\b[^.;|]{0,80}?\binto\b/g, ' ')
    if (!wordsOf(stripped, splitNames).some((word) => formsMatch(term, word))) return false
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

// Coverage hits: inflections and lemma families, plus TERM_PHRASES, but not broad synonyms
// (document/paper for pdf, article for blog). Those still score through textHit.
function contentHit(term, value, splitNames = false) {
  const raw = String(value ?? '').toLowerCase()
  if (/[^a-z0-9]/.test(term)) return raw.includes(term)
  const words = wordsOf(value, splitNames)
  if (words.some((word) => formsMatch(term, word, true))) return true
  const phrases = TERM_PHRASES[term] || TERM_PHRASES[lemmaRoot(term) || '']
  return Boolean(phrases && phrases.some((phrase) => raw.includes(phrase)))
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
      textHit(term, tool.name, false, true) || textHit(term, (tool.bestFor || []).join(' '), false, true)
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
  if (terms.some((term, i) => term === 'open' && ['source', 'weight', 'weights'].includes(terms[i + 1]))) return true
  return terms.some((term) => DEV_QUERY_TERMS.has(term) || formsMatch(term, 'model') || term === 'open-weight' || term === 'open-source' || term === 'self-hosted' || term === 'fine-tune')
}

// R5: a listing's type decides whether it is an app. Listings without a type fall back to the
// older model and API checks. Raw models wait behind apps; developer tools, extensions, and
// infrastructure wait behind apps unless they match the search better than every app.
const MODEL_TYPES = new Set(['api-model', 'open-weight-model'])
function isModelListing(tool) {
  return tool.type ? MODEL_TYPES.has(tool.type) : isModelTool(tool)
}
function isToolListing(tool, terms) {
  if (!tool.type || MODEL_TYPES.has(tool.type) || !NON_APP_TYPES.has(tool.type)) return false
  return !(TYPE_WORDS[tool.type] || []).some((word) => terms.some((term) => formsMatch(term, word)))
}

function keywordsOf(tool) {
  return Array.isArray(tool.keywords) ? tool.keywords : (tool.keywords ? String(tool.keywords).split(/\s*,\s*/) : [])
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

// R7: discontinued tools are left out; waitlists and APIs that are not live come after live tools.
function isDiscontinued(tool) {
  return tool.status === 'discontinued' || /^discontinued$/i.test(String(tool.priceFrom || '').trim())
}

function isAvailabilityLimited(tool) {
  if (tool.status === 'api-not-live' || tool.status === 'waitlist') return true
  if (tool.status === 'live') return false
  const blob = [tool.pricingNote, tool.description].join(' ')
  return /api[^.!?]{0,100}not live/i.test(blob)
}

// R6: price words sort by plan first: a free plan with the AI included, then a free plan whose
// model use is not confirmed, then a listed free tier, then a free plan that needs your own
// model, then the rest. Inside a group, the lowest starting price comes first.
function priceTier(tool) {
  const price = String(tool.priceFrom || '').trim()
  const freeish = tool.freeTier === true || /^free\b/i.test(price)
  if (tool.freePlan === true && tool.byoModel === false) return 0
  if (tool.freePlan === true && tool.byoModel !== true) return 1
  if (tool.freePlan == null && freeish && tool.byoModel !== true) return 2
  if ((tool.freePlan === true || (tool.freePlan == null && freeish)) && tool.byoModel === true) return 3
  return 4
}

function priceCost(tool) {
  const price = String(tool.priceFrom || '').trim()
  if (/^free\b/i.test(price)) return 0
  if (/^api\b/i.test(price)) return 1e9
  const m = price.match(/\$\s?([\d,]+(?:\.\d+)?)/)
  return m ? Number(m[1].replace(/,/g, '')) : 1e9
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
  query = String(query ?? '').replace(/\blow[\s-]+cost\b/gi, 'lowcost')
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
  const concepts = CONCEPTS.filter((concept) => concept.query.test(query) || concept.query.test(stripped.text))
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
    const keywords = keywordsOf(tool)
    const kw = keywords.join(' | ')
    const hay = [tool.name, tool.tagline, tool.description, tool.category, best, kw, tool.pricingNote || ''].join(' ')
    let score = 0
    let specific = 0
    for (const term of scoredTerms) {
      const rawName = nameTokenBonus(term, tool, exact)
      // R2: a name match on the word for the chosen category scores as a category match.
      const name = rawName && !exact && intent && categorySlug(term) === intent ? 4 : rawName
      const bestHit = textHit(term, best)
      const kwHit = keywords.length ? textHit(term, kw) : false
      const category = textHit(term, tool.category)
      const anywhere = textHit(term, hay, true)
      if (name) score += name
      if (bestHit) score += 5
      if (kwHit) score += 5
      if (category) score += 4
      if (anywhere) score += 2
      if (!categorySlug(term) && (name || bestHit || kwHit)) specific += 1
    }
    if (!score) continue
    const covered = new Set(contentTerms.filter((term) => contentHit(term, hay, true)))
    const fields = [tool.name, tool.tagline, ...(tool.bestFor || []), ...keywords]
    for (const pair of pairs) {
      if (fields.some((field) => phraseHit(pair, field))) score += 6
    }
    let conceptHits = 0
    for (const concept of concepts) {
      const listed = concept.listing.test(hay) || (concept.websiteBuild && textHit('website', hay, true) && textHit('build', hay, true))
      if (!listed) continue
      conceptHits += 1
      if (fields.some((field) => concept.listing.test(field)) || (concept.websiteBuild && fields.some((field) => textHit('website', field, true) && textHit('build', field, true)))) score += 5
    }
    const cover = covered.size + conceptHits
    if (!named && keyTerms.length && !keyTerms.some((term) => textHit(term, hay, true))) continue
    const strong = scoredTerms.some((term) => textHit(term, tool.name, true) || textHit(term, best) || (keywords.length && textHit(term, kw)))
    if (!named && intent && tool.category !== intent && !strong) continue
    const band = named ? 0 : (intent && tool.category === intent ? 1 : 2)
    const job = actions.length ? (actions.some((term) => textHit(term, hay, true)) ? 1 : 0) : 1
    const surface = (!devQuery && !named && isModelListing(tool)) ? 1 : 0
    const toolish = (!devQuery && !named && isToolListing(tool, asked)) ? 1 : 0
    const limited = (!named && isAvailabilityLimited(tool)) ? 1 : 0
    const price = priceIntent ? priceTier(tool) : 0
    const cost = priceIntent ? priceCost(tool) : 0
    const exactness = exact ? 0 : (named ? 1 : 2)
    rows.push({ tool, score, specific, band, job, surface, toolish, limited, price, cost, exactness, cover, named })
  }
  // R1: when any tool matches 2+ of the query's words, tools that match only 1 are weak: they sort
  // after the rest and stay out of the numbered results. Apps come before raw models and APIs
  // unless the query asks for one; when no app is a strong match, models are not held back.
  const most = Math.max(0, ...rows.filter((row) => !row.named).map((row) => row.cover))
  for (const row of rows) row.weak = !row.named && most >= 2 && row.cover < 2 ? 1 : 0
  const apps = rows.filter((row) => !row.named && !row.weak && !row.surface && !row.toolish)
  const appsStrong = apps.length > 0
  const appCover = Math.max(-1, ...apps.map((row) => row.cover))
  const appScore = Math.max(-1, ...apps.filter((row) => row.cover === appCover).map((row) => row.score))
  for (const row of rows) {
    row.held = appsStrong ? row.surface : 0
    // R5: a developer tool, extension, or infrastructure listing that beats every strong app on
    // words matched, or ties on words and outscores them, keeps its place; otherwise it follows apps.
    const ahead = row.cover > appCover || (row.cover === appCover && row.score > appScore)
    row.behind = row.surface || (row.toolish && appsStrong && !ahead) ? 1 : 0
  }
  // R1: do not leave fewer than 3 numbered results when more relevant tools exist. If fewer than
  // 3 strong (2+ word) matches remain after models are held back, fill up to 3 from the best
  // 1-term matches, preferring the chosen category.
  const coreN = rows.filter((row) => !row.held && (row.named || row.cover >= 2)).length
  if (most >= 2 && coreN < 3) {
    const broad = new Set(['website', 'websites', 'site', 'sites', 'webpage', 'webpages', 'page', 'pages'])
    const wanted = contentTerms.filter((term) => !broad.has(term) && !GENERIC_HEADS.has(term))
    const fillers = rows.filter((row) => row.weak && !row.held && (!wanted.length || wanted.some((term) => contentHit(term, [row.tool.name, row.tool.tagline, (row.tool.bestFor || []).join(' '), (Array.isArray(row.tool.keywords) ? row.tool.keywords : []).join(' ')].join(' '), true)))).sort((a, b) => (
      a.band - b.band || b.cover - a.cover || b.specific - a.specific || b.score - a.score || a.tool.rank - b.tool.rank
    ))
    for (const row of fillers.slice(0, 3 - coreN)) row.weak = 0
  }
  rows.sort((a, b) => (
    (a.named ? 0 : 1) - (b.named ? 0 : 1)
    || a.exactness - b.exactness
    || a.held - b.held
    || a.weak - b.weak
    || a.behind - b.behind
    || a.limited - b.limited
    || a.band - b.band
    || b.cover - a.cover
    || a.price - b.price
    || a.cost - b.cost
    || b.job - a.job
    || b.specific - a.specific
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
