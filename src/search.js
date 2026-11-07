const CLOSED_CLASS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'at', 'by', 'from',
])

const CATEGORY_SLUGS = ['coding', 'writing', 'images', 'video', 'agents', 'research', 'voice']

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

function formsMatch(left, right) {
  return isInflection(left, right) || isInflection(right, left)
}

function rawWords(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) || []
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

function queryTerms(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !CLOSED_CLASS.has(term))
}

function textHit(term, value, splitNames = false) {
  const raw = String(value ?? '').toLowerCase()
  if (/[^a-z0-9]/.test(term)) return raw.includes(term)
  return wordsOf(value, splitNames).some((word) => formsMatch(term, word))
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
      return { term, count: 0, lead: null, slug: null, specific: false, unanimous: false }
    }
    const distinctive = list.filter((tool) => (
      textHit(term, tool.name) || textHit(term, (tool.bestFor || []).join(' '))
    ))
    const lead = categoryLeader(distinctive.map((tool) => tool.category))
    const slug = categorySlug(term)
    const unanimous = Boolean(lead) && distinctive.every((tool) => tool.category === lead)
    return {
      term,
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
  if (chosen.slug && chosen.lead !== chosen.slug) return chosen.slug
  return chosen.lead || chosen.slug
}

function compact(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function rankTools(list, query) {
  const ranked = [...list].sort((a, b) => a.rank - b.rank)
  const terms = queryTerms(query)
  if (!terms.length) return ranked
  const intent = queryIntent(list, terms)
  const full = compact(query)
  const rows = []
  for (const tool of ranked) {
    const best = (tool.bestFor || []).join(' ')
    const hay = [tool.name, tool.tagline, tool.description, tool.category, best, tool.pricingNote || ''].join(' ')
    let score = 0
    let specific = 0
    for (const term of terms) {
      const name = textHit(term, tool.name, true)
      const bestHit = textHit(term, best)
      const category = textHit(term, tool.category)
      const anywhere = textHit(term, hay, true)
      if (name) score += 8
      if (bestHit) score += 5
      if (category) score += 4
      if (anywhere) score += 2
      if (!categorySlug(term) && (name || bestHit)) specific += 1
    }
    if (!score) continue
    const exact = Boolean(full) && full === compact(tool.name)
    const band = exact ? 0 : (intent && tool.category === intent ? 1 : 2)
    rows.push({ tool, score, specific, band })
  }
  rows.sort((a, b) => a.band - b.band || b.specific - a.specific || b.score - a.score || a.tool.rank - b.tool.rank)
  return rows.map((row) => row.tool)
}
