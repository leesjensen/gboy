import { useEffect, useRef, useState } from 'react'
import { searchRecipes } from './supabase.js'
import { Breadcrumbs, Icon } from './ui.jsx'

const minLength = 2
const debounceMs = 250

export function searchHref(query) {
  return `#/search/${encodeURIComponent(query.trim())}`
}

// Highlights the start of each searched word, loosely enough that "potatoes"
// still marks "potato" (the database matches word stems).
function Highlight({ text, words }) {
  if (!text || !words.length) return text || null
  const stems = words.map((word) => word.slice(0, Math.max(3, word.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b((?:${stems.join('|')})[\\p{L}\\p{N}]*)`, 'giu')
  return text.split(pattern).map((part, index) => (index % 2 ? <mark key={index} className="rounded bg-gold-pale px-0.5 text-forest">{part}</mark> : part))
}

function queryWords(query) {
  return query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1)
}

export function SearchPage({ initialQuery, categoriesMap }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState(null)
  const [status, setStatus] = useState('idle')
  const latest = useRef(0)
  const trimmed = query.trim()

  useEffect(() => {
    // Keep the address shareable without adding a history entry per keystroke.
    window.history.replaceState(null, '', trimmed ? searchHref(trimmed) : '#/search')
    const request = ++latest.current
    if (trimmed.length < minLength) {
      setResults(null)
      setStatus('idle')
      return undefined
    }
    setStatus('loading')
    const timer = setTimeout(() => {
      searchRecipes(trimmed)
        .then((rows) => {
          if (request !== latest.current) return
          setResults(rows)
          setStatus('done')
        })
        .catch(() => request === latest.current && setStatus('error'))
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [trimmed])

  const words = queryWords(trimmed)

  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
      <Breadcrumbs><span className="text-forest">Search</span></Breadcrumbs>
      <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.21em] text-coral">The recipe collection</p>
      <h1 className="mb-6 font-serif text-4xl font-semibold tracking-tight text-forest sm:text-5xl">Search recipes</h1>
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-forest/40" />
        <input
          type="search"
          autoFocus
          aria-label="Search recipes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “zucchini bread”, “chicken”, or “waffles”"
          className="w-full rounded-2xl border border-forest/12 bg-white py-4 pl-12 pr-4 text-base text-forest shadow-sm outline-none transition placeholder:text-forest/35 focus:border-forest/40 focus:ring-2 focus:ring-sage-pale"
        />
      </form>
      <p className="mt-3 min-h-5 text-xs text-forest/50" aria-live="polite">
        {trimmed.length < minLength && 'Search titles, ingredients, and directions.'}
        {trimmed.length >= minLength && status === 'loading' && 'Searching…'}
        {status === 'error' && 'Search is not available right now. Try again in a moment.'}
        {status === 'done' && results && `${results.length === 50 ? 'Top 50' : results.length} ${results.length === 1 ? 'recipe' : 'recipes'} for “${trimmed}”`}
      </p>

      {status === 'done' && results?.length === 0 && (
        <div className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-forest/8">
          <p className="font-serif text-xl font-semibold text-forest">No recipes match “{trimmed}”.</p>
          <p className="mt-2 text-sm text-forest/60">Try fewer words, or <a href="#/category/all" className="font-semibold text-coral">browse every recipe</a>.</p>
        </div>
      )}

      {results?.length > 0 && (
        <ul className={`mt-6 space-y-2.5 transition ${status === 'loading' ? 'opacity-60' : ''}`}>
          {results.map((recipe) => {
            const category = categoriesMap[recipe.category]
            return (
              <li key={recipe.id}>
                <a href={`#/recipe/${recipe.id}`} className="group flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-forest/8 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-forest/15 sm:p-5">
                  <span className={`category-pill tint-${category?.tint || 'sage'} grid size-11 shrink-0 place-items-center rounded-2xl font-serif text-xl text-forest`}>{category?.icon || '✦'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-coral">
                      {category?.name || recipe.category}{recipe.subcategory && ` · ${recipe.subcategory}`}
                    </span>
                    <span className="mt-1 block font-serif text-lg font-semibold leading-snug text-forest group-hover:text-coral"><Highlight text={recipe.title} words={words} /></span>
                    {recipe.match && <span className="mt-1.5 line-clamp-2 block text-sm leading-6 text-forest/60"><Highlight text={recipe.match} words={words} /></span>}
                  </span>
                  <Icon name="arrow" className="mt-1 size-4 shrink-0 text-forest/35 transition group-hover:translate-x-1 group-hover:text-coral" />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
