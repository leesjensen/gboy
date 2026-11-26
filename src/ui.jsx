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
  if (name === 'mail') return <svg {...shared}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>
  return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.8" /></svg>
}

export function Breadcrumbs({ children }) {
  return <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs font-medium text-forest/45"><a href="#/" className="transition hover:text-forest">Home</a><span>/</span>{children}</nav>
}
