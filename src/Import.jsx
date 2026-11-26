import { useEffect, useMemo, useState } from 'react'
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
    setStatus('reading')
    setError('')
    try {
      setResult(await readRecipePhoto({
        image: photo.base64,
        mimeType: 'image/jpeg',
        category: { id: chosen.id, name: chosen.name },
        subcategories,
      }))
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
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

  const reading = status === 'reading'
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
              <input id="photo" type="file" accept="image/*" onChange={choosePhoto} disabled={reading} className="block w-full text-sm text-forest/70 file:mr-4 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-forest-light" />
              <p className="mt-1.5 text-xs text-forest/45">Fill the frame with the recipe, in good light, and keep the text sharp.</p>
            </div>
            <div>
              <label htmlFor="import-category" className={labelClass}>Category</label>
              <select id="import-category" required value={category} onChange={(event) => setCategory(event.target.value)} disabled={reading} className={inputClass}>
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
          <button type="submit" disabled={!photo || !category || reading} className={primaryButton}>
            {reading ? 'Reading the recipe…' : 'Read recipe'}
          </button>
          <a href="#/new" className={quietButton}>Type it in instead</a>
          {reading && <span className="text-xs text-forest/50" aria-live="polite">This usually takes 10–30 seconds.</span>}
        </div>
      </form>
    </AdminShell>
  )
}
