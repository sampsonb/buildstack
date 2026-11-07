const CLOSED_CLASS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'at', 'by', 'from',
])

const CATEGORY_SLUGS = ['coding', 'writing', 'images', 'video', 'agents', 'research', 'voice']

function wordForms(term) {
  const forms = new Set([term])
  if (term.length < 3) return forms
  forms.add(`${term}s`)
  forms.add(`${term}es`)
  if (term.endsWith('e')) {
    const stem = term.slice(0, -1)
    forms.add(`${stem}ing`)
    forms.add(`${stem}ed`)
  } else {
    forms.add(`${term}ing`)
    forms.add(`${term}ed`)
  }
  if (term.endsWith('y') && term.length > 3) forms.add(`${term.slice(0, -1)}ies`)
  return forms
}

function formsMatch(left, right) {
  if (left === right) return true
  if (left.length < 3 || right.length < 3) return false
  return wordForms(left).has(right) || wordForms(right).has(left)
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

function categoryLeader(categories) {
  const counts = new Map()
  for (const category of categories) counts.set(category, (counts.get(category) || 0) + 1)
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (!ordered.length) return null
  if (ordered.length === 1 || ordered[0][1] > ordered[1][1]) return ordered[0][0]
  return null
}

function queryIntent(list, terms) {
  const noted = terms.map((term) => {
    const distinctive = list.filter((tool) => (
      textHit(term, tool.name, true) || textHit(term, (tool.bestFor || []).join(' '))
    ))
    const lead = categoryLeader(distinctive.map((tool) => tool.category))
    const slug = categorySlug(term)
    return {
      term,
      count: distinctive.length,
      lead,
      slug,
      specific: Boolean(lead) && (!slug || lead === slug),
    }
  })
  const specific = noted.filter((item) => item.specific)
  const pool = specific.length ? specific : noted.filter((item) => item.slug)
  if (!pool.length) return null
  pool.sort((a, b) => a.count - b.count || a.term.localeCompare(b.term))
  const chosen = pool[0]
  return specific.length ? (chosen.lead || chosen.slug) : chosen.slug
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
    let named = false
    for (const term of terms) {
      const name = textHit(term, tool.name, true)
      const bestHit = textHit(term, best)
      const category = textHit(term, tool.category)
      const anywhere = textHit(term, hay, true)
      if (name) score += 8
      if (bestHit) score += 5
      if (category) score += 4
      if (anywhere) score += 2
      if (name) named = true
      if (!categorySlug(term) && (name || bestHit)) specific += 1
    }
    if (!score) continue
    const exact = Boolean(full) && full === compact(tool.name)
    const band = exact ? 0 : (intent && (tool.category === intent || named) ? 1 : 2)
    rows.push({ tool, score, specific, band })
  }
  rows.sort((a, b) => a.band - b.band || b.specific - a.specific || b.score - a.score || a.tool.rank - b.tool.rank)
  return rows.map((row) => row.tool)
}
