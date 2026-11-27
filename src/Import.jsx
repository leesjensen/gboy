import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminShell, RecipeEditor, inputClass, labelClass, primaryButton, quietButton } from './Admin.jsx'
import { readRecipePhoto } from './supabase.js'
import { Icon } from './ui.jsx'

// Phone photos are often 4000px+ and several MB. 2000px keeps small print
// legible for Gemini while keeping uploads quick and calls cheap.
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.85

async function prepareImage(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('That file could not be opened as a photo. Try a JPEG or PNG (on iPhone, a screenshot of the photo works).')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The photo could not be read.'))
    reader.readAsDataURL(blob)
  })
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), previewUrl: URL.createObjectURL(blob) }
}

// Typical Gemini read time. The bar eases toward 90% around this point and
// only fills once the draft has actually arrived.
const TYPICAL_SECONDS = 12

function useElapsedSeconds(startedAt, running) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  return Math.max(0, (now - startedAt) / 1000)
}

function ProgressStep({ state, label, detail }) {
  const marker = {
    done: <span className="grid size-6 place-items-center rounded-full bg-forest text-[0.7rem] font-bold text-white">✓</span>,
    active: <span className="grid size-6 place-items-center rounded-full bg-gold-pale ring-2 ring-gold"><span className="size-2 animate-pulse rounded-full bg-coral" /></span>,
    pending: <span className="size-6 rounded-full border-2 border-forest/15" />,
  }[state]
  return (
    <li className="flex items-center gap-3">
      {marker}
      <span className={`text-sm ${state === 'pending' ? 'text-forest/40' : 'font-semibold text-forest'}`}>{label}</span>
      {detail && <span className="ml-auto font-mono text-xs tabular-nums text-forest/50">{detail}</span>}
    </li>
  )
}

function ReadingProgress({ photo, startedAt, done, onCancel }) {
  const elapsed = useElapsedSeconds(startedAt, !done)
  const progress = done ? 100 : 90 * (1 - Math.exp(-elapsed / TYPICAL_SECONDS))
  const message = done
    ? 'Got it. Opening your draft…'
    : elapsed < 30
      ? 'Gemini is reading the print and handwriting. This usually takes 10–30 seconds.'
      : elapsed < 90
        ? 'Still reading. Handwritten or busy pages can take up to a minute.'
        : 'This is taking much longer than usual. You can keep waiting, or cancel and try a clearer photo.'
  return (
    <section aria-busy={!done} className="grid gap-6 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center">
      <div className={`relative overflow-hidden rounded-2xl bg-cream ring-1 ring-forest/8 ${done ? '' : 'photo-scan'}`}>
        <img src={photo.previewUrl} alt="The recipe being read" className={`max-h-80 w-full object-contain transition duration-500 ${done ? '' : 'opacity-90'}`} />
      </div>
      <div>
        <h2 className="font-serif text-2xl font-semibold text-forest">{done ? 'Recipe read' : 'Reading your recipe'}</h2>
        <ol className="mt-5 space-y-3.5">
          <ProgressStep state="done" label="Photo prepared" />
          <ProgressStep state={done ? 'done' : 'active'} label="Reading ingredients and directions" detail={`${Math.floor(elapsed)}s`} />
          <ProgressStep state={done ? 'active' : 'pending'} label="Opening your draft to review" />
        </ol>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-sage-pale" aria-hidden="true">
          <div className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 min-h-10 text-sm leading-5 text-forest/60" role="status" aria-live="polite">{message}</p>
        {!done && <button type="button" onClick={onCancel} className={`${quietButton} mt-3`}>Cancel</button>}
      </div>
    </section>
  )
}

function PhotoReview({ previewUrl, warnings, onStartOver }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[1.65rem] bg-white p-4 shadow-sm ring-1 ring-forest/8 sm:flex-row sm:p-5">
      <a href={previewUrl} target="_blank" rel="noreferrer" className="shrink-0" title="Open the photo full size">
        <img src={previewUrl} alt="The recipe photo" className="h-40 w-full rounded-xl object-cover sm:h-36 sm:w-28" />
      </a>
      <div className="min-w-0 flex-1 text-sm leading-6 text-forest/70">
        <p className="font-semibold text-forest">Check the draft against the photo before saving.</p>
        <p>The text was read automatically, so look closely at amounts, temperatures, and times.</p>
        {warnings.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-xl bg-gold-pale/70 px-3 py-2">
            {warnings.map((warning, index) => <li key={index}>⚠︎ {warning}</li>)}
          </ul>
        )}
        <button type="button" onClick={onStartOver} className="mt-3 text-sm font-semibold text-coral">Use a different photo</button>
      </div>
    </div>
  )
}

export function ImportPage({ defaultCategory, categories, summaries, onSaved, onDeleted }) {
  const [category, setCategory] = useState(defaultCategory || '')
  const [photo, setPhoto] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [startedAt, setStartedAt] = useState(0)
  // Each read gets a number, so a cancelled read's late answer is ignored.
  const readId = useRef(0)

  useEffect(() => () => photo && URL.revokeObjectURL(photo.previewUrl), [photo])

  const subcategories = useMemo(
    () => [...new Set(summaries.filter((item) => item.category === category).map((item) => item.subcategory).filter(Boolean))].sort(),
    [summaries, category],
  )

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    setError('')
    setPhoto(null)
    if (!file) return
    setStatus('preparing')
    try {
      setPhoto(await prepareImage(file))
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  async function readPhoto(event) {
    event.preventDefault()
    const chosen = categories.find((item) => item.id === category)
    if (!photo || !chosen) return
    const id = ++readId.current
    setStartedAt(Date.now())
    setStatus('reading')
    setError('')
    try {
      const draft = await readRecipePhoto({
        image: photo.base64,
        mimeType: 'image/jpeg',
        category: { id: chosen.id, name: chosen.name },
        subcategories,
      })
      if (id !== readId.current) return
      // Let the finished state register before the editor replaces it.
      setStatus('done')
      setTimeout(() => {
        if (id !== readId.current) return
        setResult(draft)
        setStatus('idle')
      }, 700)
    } catch (err) {
      if (id !== readId.current) return
      setError(err.message)
      setStatus('idle')
    }
  }

  function cancelRead() {
    readId.current += 1
    setStatus('idle')
  }

  if (result) {
    return (
      <RecipeEditor
        draft={result.recipe}
        intro={<PhotoReview previewUrl={photo.previewUrl} warnings={result.warnings || []} onStartOver={() => setResult(null)} />}
        categories={categories}
        summaries={summaries}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    )
  }

  if (status === 'reading' || status === 'done') {
    return (
      <AdminShell crumb={<span className="text-forest">Add from a photo</span>} eyebrow="Add to the collection" title="Add a recipe from a photo">
        <ReadingProgress photo={photo} startedAt={startedAt} done={status === 'done'} onCancel={cancelRead} />
      </AdminShell>
    )
  }

  return (
    <AdminShell crumb={<span className="text-forest">Add from a photo</span>} eyebrow="Add to the collection" title="Add a recipe from a photo">
      <form onSubmit={readPhoto} className="space-y-6">
        <section className="grid gap-6 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7 md:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-5">
            <p className="text-sm leading-6 text-forest/65">
              Take or choose a photo of a recipe card, cookbook page, or printout. The recipe is read from the photo and opened as a draft for you to check before it's saved. The photo itself isn't kept.
            </p>
            <div>
              <label htmlFor="photo" className={labelClass}>Photo</label>
              <input id="photo" type="file" accept="image/*" onChange={choosePhoto} className="block w-full text-sm text-forest/70 file:mr-4 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-forest-light" />
              <p className="mt-1.5 text-xs text-forest/45">Fill the frame with the recipe, in good light, and keep the text sharp.</p>
            </div>
            <div>
              <label htmlFor="import-category" className={labelClass}>Category</label>
              <select id="import-category" required value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                <option value="" disabled>Choose a category…</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid min-h-44 place-items-center overflow-hidden rounded-2xl bg-cream ring-1 ring-forest/8">
            {photo
              ? <img src={photo.previewUrl} alt="The chosen recipe" className="max-h-72 w-full object-contain" />
              : <span className="flex flex-col items-center gap-2 p-6 text-center text-xs text-forest/45"><Icon name="camera" className="size-8" />{status === 'preparing' ? 'Opening photo…' : 'Your photo will show here'}</span>}
          </div>
        </section>

        {error && <p role="alert" className="rounded-2xl bg-coral-pale px-4 py-3 text-sm text-forest">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!photo || !category} className={primaryButton}>
            Read recipe
          </button>
          <a href="#/new" className={quietButton}>Type it in instead</a>
        </div>
      </form>
    </AdminShell>
  )
}
