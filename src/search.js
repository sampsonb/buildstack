export function rankTools(list, query) {
  const ranked = [...list].sort((a, b) => a.rank - b.rank)
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return ranked
  return ranked
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
