import { useState } from 'react'

export function Icon({ name, className = '' }) {
  const shared = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': true }
  if (name === 'arrow') return <svg {...shared}><path d="M4.5 12h14M13 5.5l6.5 6.5-6.5 6.5" /></svg>
  if (name === 'chevron') return <svg {...shared}><path d="m8 10 4 4 4-4" /></svg>
  if (name === 'clock') return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></svg>
  if (name === 'book') return <svg {...shared}><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12H7a2 2 0 0 1-2-2z" /><path d="M5 16.5A2.5 2.5 0 0 1 7.5 14H19M9 8h6m-6 3h6" /></svg>
  if (name === 'leaf') return <svg {...shared}><path d="M19.5 4.5c-7 .2-12.7 2.4-13.7 7.2-.7 3.1 1.6 5.7 4.7 5.2 4.9-.8 7.5-6.1 9-12.4Z" /><path d="M4.5 20c2.8-4.5 6.4-7.5 11-10" /></svg>
  if (name === 'spark') return <svg {...shared}><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg>
  if (name === 'search') return <svg {...shared}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
  if (name === 'camera') return <svg {...shared}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
  if (name === 'plus') return <svg {...shared}><path d="M12 5v14M5 12h14" /></svg>
  if (name === 'edit') return <svg {...shared}><path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z" /><path d="m13 7 4 4" /></svg>
  if (name === 'trash') return <svg {...shared}><path d="M5 7h14M10 4h4m-7 3 .8 12h8.4L17 7m-6.5 3.5v5m3-5v5" /></svg>
  if (name === 'up') return <svg {...shared}><path d="m7 14 5-5 5 5" /></svg>
  if (name === 'down') return <svg {...shared}><path d="m7 10 5 5 5-5" /></svg>
  if (name === 'close') return <svg {...shared}><path d="m6.5 6.5 11 11m0-11-11 11" /></svg>
  if (name === 'download') return <svg {...shared}><path d="M12 4.5v10m-4-4 4 4 4-4" /><path d="M5 15.5v2A2 2 0 0 0 7 19.5h10a2 2 0 0 0 2-2v-2" /></svg>
  if (name === 'cloud-off') return <svg {...shared}><path d="M8.5 6.6A5.5 5.5 0 0 1 17.3 10a3.8 3.8 0 0 1 2.4 6.3M15.5 18.5H7.2a4 4 0 0 1-1-7.9" /><path d="m4 4 16 16" /></svg>
  if (name === 'user') return <svg {...shared}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5a7 7 0 0 1 14 0" /></svg>
  if (name === 'mail') return <svg {...shared}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>
  return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.8" /></svg>
}

export function Breadcrumbs({ children }) {
  return <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs font-medium text-forest/45"><a href="#/" className="transition hover:text-forest">Home</a><span>/</span>{children}</nav>
}

const starPath = 'M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z'

function Star({ fill = 1, className = '' }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-full text-forest/15"><path d={starPath} fill="currentColor" /></svg>
      {fill > 0 && (
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.min(1, fill) * 100}%` }}>
          <svg viewBox="0 0 24 24" className="h-full text-gold" style={{ width: `${100 / Math.min(1, fill)}%`, maxWidth: 'none' }}><path d={starPath} fill="currentColor" /></svg>
        </span>
      )}
    </span>
  )
}

// Five stars filled to `value` (0-5, fractions allowed).
export function Stars({ value = 0, className = 'size-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => <Star key={index} fill={Math.max(0, Math.min(1, value - index))} className={className} />)}
    </span>
  )
}

export function formatRating(average) {
  return average == null ? '' : average.toFixed(1)
}

// Compact "★ 4.6 (12)" for cards and lists; nothing when unrated.
export function RatingBadge({ average, count, className = '' }) {
  if (!count) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold text-forest/70 ${className}`} title={`${formatRating(average)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`}>
      <Star className="size-3.5" />
      {formatRating(average)}
      <span className="font-normal text-forest/45">({count})</span>
      <span className="sr-only">{`${formatRating(average)} out of 5 stars from ${count} ${count === 1 ? 'rating' : 'ratings'}`}</span>
    </span>
  )
}

// Tappable 1-5 stars. `value` is the current choice (or null).
export function StarInput({ value, onChange, disabled = false, label = 'Your rating' }) {
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}`}
          disabled={disabled}
          onClick={() => onChange(stars)}
          onMouseEnter={() => setHover(stars)}
          onFocus={() => setHover(stars)}
          onBlur={() => setHover(null)}
          className="grid size-10 place-items-center rounded-full transition hover:bg-gold-pale focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star fill={stars <= shown ? 1 : 0} className="size-7" />
        </button>
      ))}
    </div>
  )
}
