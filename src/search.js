const CLOSED_CLASS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'at', 'by', 'from',
])

function fieldWords(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) || []
}

function queryTerms(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !CLOSED_CLASS.has(term))
}

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

function hasWordForm(term, value) {
  if (/[^a-z0-9]/.test(term)) return String(value ?? '').toLowerCase().includes(term)
  const forms = wordForms(term)
  return fieldWords(value).some((word) => {
    if (forms.has(word)) return true
    return term.length >= 5 && word.length > term.length && word.startsWith(term)
  })
}

export function rankTools(list, query) {
  const ranked = [...list].sort((a, b) => a.rank - b.rank)
  const terms = queryTerms(query)
  if (!terms.length) return ranked
  return ranked
    .map((tool) => {
      const best = (tool.bestFor || []).join(' ')
      const hay = [
        tool.name, tool.tagline, tool.description, tool.category,
        best, tool.pricingNote || '',
      ].join(' ')
      let score = 0
      for (const term of terms) {
        if (hasWordForm(term, tool.name)) score += 8
        if (hasWordForm(term, best)) score += 5
        if (hasWordForm(term, tool.category)) score += 4
        if (hasWordForm(term, hay)) score += 2
      }
      return { tool, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.rank - b.tool.rank)
    .map((row) => row.tool)
}
