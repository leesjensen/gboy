import { useEffect, useMemo, useState } from 'react'
import { AdminShell, inputClass, labelClass, primaryButton, quietButton, slugify } from './Admin.jsx'
import { createCategory, deleteCategory, reorderCategories, updateCategory } from './supabase.js'
import { Icon } from './ui.jsx'

// Glyphs that render as text (not emoji) in the serif font, including the
// ones the original categories use.
const iconChoices = ['✳', '⌁', '✦', '⌂', '☀', '♡', '◌', '❋', '◉', '✿', '◒', '❄', '✧', '❀', '✶', '◆', '✺', '❖', '✹', '◈', '⁂', '※', '♧', '☼']
// Colors from src/index.css (.tint-*), in color-wheel order.
const tints = [
  { id: 'coral', label: 'Coral' },
  { id: 'peach', label: 'Peach' },
  { id: 'gold', label: 'Gold' },
  { id: 'lemon', label: 'Lemon' },
  { id: 'sage', label: 'Sage' },
  { id: 'mint', label: 'Mint' },
  { id: 'blue', label: 'Sea glass' },
  { id: 'sky', label: 'Sky' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'rose', label: 'Rose' },
  { id: 'sand', label: 'Sand' },
  { id: 'slate', label: 'Slate' },
]
const descriptionLimit = 200
const validId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)

function ErrorNote({ message }) {
  if (!message) return null
  return <p role="alert" className="rounded-2xl bg-coral-pale px-4 py-3 text-sm text-forest">{message}</p>
}

// The home page tile, as it will look.
function TilePreview({ category }) {
  return (
    <div className={`category-card tint-${category.tint} relative flex min-h-40 flex-col justify-between overflow-hidden rounded-[1.65rem] p-5`}>
      <div className="absolute -right-6 -top-10 size-36 rounded-full border border-current/10 opacity-70" />
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/70 font-serif text-2xl text-forest shadow-sm">{category.icon || '✦'}</span>
        <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-forest/65">
          {category.count ?? 0} {category.count === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      <div className="relative z-10 mt-6">
        <h3 className="font-serif text-xl font-semibold text-forest">{category.name || 'Category name'}</h3>
        <p className="mt-1 max-w-[16rem] text-xs leading-5 text-forest/65">{category.description || 'A short description for the home page.'}</p>
      </div>
    </div>
  )
}

function CategoryForm({ initial, isNew, takenIds, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [idEdited, setIdEdited] = useState(false)
  const [customIcon, setCustomIcon] = useState(!iconChoices.includes(initial.icon))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  function changeName(name) {
    setForm((current) => ({ ...current, name, id: isNew && !idEdited ? slugify(name) : current.id }))
  }

  const idProblem = isNew && (!validId(form.id)
    ? 'Use lowercase letters, numbers and single hyphens, like slow-cooker.'
    : takenIds.includes(form.id) ? 'Another category already uses this ID.' : '')

  async function submit(event) {
    event.preventDefault()
    if (idProblem) return
    setStatus('saving')
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setStatus('idle')
      setError(err.message || 'The category could not be saved.')
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-5">
        <h2 className="font-serif text-2xl font-semibold text-forest">{isNew ? 'Add a category' : `Edit ${initial.name}`}</h2>
        <div>
          <label htmlFor="category-name" className={labelClass}>Name</label>
          <input id="category-name" required maxLength={60} value={form.name} onChange={(event) => changeName(event.target.value)} className={inputClass} placeholder="Slow cooker" />
        </div>
        <div>
          <label htmlFor="category-id" className={labelClass}>ID</label>
          {isNew ? (
            <>
              <input id="category-id" required value={form.id} onChange={(event) => { setIdEdited(true); set('id', event.target.value.toLowerCase()) }} className={`${inputClass} font-mono`} placeholder="slow-cooker" aria-describedby="category-id-help" />
              <p id="category-id-help" className={`mt-1.5 text-xs ${idProblem && form.id ? 'text-coral' : 'text-forest/45'}`}>
                {idProblem && form.id ? idProblem : `Used in links (#/category/${form.id || 'slow-cooker'}). It can't be changed later.`}
              </p>
            </>
          ) : (
            <p className="font-mono text-sm text-forest/60">{form.id} <span className="font-sans text-xs text-forest/40">· used in links, so it stays the same</span></p>
          )}
        </div>
        <fieldset>
          <legend className={labelClass}>Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {iconChoices.map((glyph) => (
              <button
                key={glyph}
                type="button"
                aria-label={`Icon ${glyph}`}
                aria-pressed={!customIcon && form.icon === glyph}
                onClick={() => { setCustomIcon(false); set('icon', glyph) }}
                className={`grid size-10 place-items-center rounded-xl font-serif text-xl text-forest transition ${!customIcon && form.icon === glyph ? 'bg-forest text-white' : 'bg-cream hover:bg-sage-pale'}`}
              >
                {glyph}
              </button>
            ))}
            <button type="button" aria-pressed={customIcon} onClick={() => setCustomIcon(true)} className={`rounded-xl px-3 text-xs font-semibold transition ${customIcon ? 'bg-forest text-white' : 'bg-cream text-forest/70 hover:bg-sage-pale'}`}>
              Other…
            </button>
          </div>
          {customIcon && (
            <input aria-label="Custom icon" required maxLength={4} value={form.icon} onChange={(event) => set('icon', event.target.value)} className={`${inputClass} mt-2 w-24 text-center font-serif text-xl`} placeholder="✦" />
          )}
        </fieldset>
        <fieldset>
          <legend className={labelClass}>Color</legend>
          <div className="flex flex-wrap gap-2">
            {tints.map((tint) => (
              <button
                key={tint.id}
                type="button"
                aria-pressed={form.tint === tint.id}
                onClick={() => set('tint', tint.id)}
                className={`category-pill tint-${tint.id} flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-forest ring-2 transition ${form.tint === tint.id ? 'ring-forest' : 'ring-transparent hover:ring-forest/20'}`}
              >
                {tint.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="category-description" className={labelClass}>Description</label>
          <textarea id="category-description" rows={2} maxLength={descriptionLimit} value={form.description} onChange={(event) => set('description', event.target.value)} className={inputClass} placeholder="A short line for the home page tile." />
          <p className="mt-1 text-right text-xs text-forest/40">{form.description.length}/{descriptionLimit}</p>
        </div>
        <ErrorNote message={error} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={status === 'saving' || Boolean(idProblem)} className={primaryButton}>
            {status === 'saving' ? 'Saving…' : isNew ? 'Add category' : 'Save changes'}
          </button>
          <button type="button" onClick={onCancel} disabled={status === 'saving'} className={quietButton}>Cancel</button>
        </div>
      </div>
      <div>
        <p className={labelClass}>Preview</p>
        <TilePreview category={form} />
      </div>
    </form>
  )
}

function CategoryRow({ category, index, total, busy, onMove, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const inUse = category.count > 0
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-forest/8 sm:flex-nowrap">
      <div className="flex flex-col gap-1">
        <button type="button" aria-label={`Move ${category.name} up`} onClick={() => onMove(index, -1)} disabled={busy || index === 0} className="grid size-7 place-items-center rounded-full text-forest/60 transition hover:bg-cream hover:text-forest disabled:opacity-25">
          <Icon name="up" className="size-4" />
        </button>
        <button type="button" aria-label={`Move ${category.name} down`} onClick={() => onMove(index, 1)} disabled={busy || index === total - 1} className="grid size-7 place-items-center rounded-full text-forest/60 transition hover:bg-cream hover:text-forest disabled:opacity-25">
          <Icon name="down" className="size-4" />
        </button>
      </div>
      <span className={`category-pill tint-${category.tint} grid size-12 shrink-0 place-items-center rounded-2xl font-serif text-2xl text-forest`}>{category.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold text-forest">
          <a href={`#/category/${category.id}`} className="hover:text-coral">{category.name}</a>
          <span className="ml-2 font-sans text-xs font-normal text-forest/45">{category.count} {category.count === 1 ? 'recipe' : 'recipes'}</span>
        </p>
        <p className="truncate text-xs text-forest/55">{category.description || 'No description yet.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-forest/65">Delete {category.name}?</span>
            <button type="button" onClick={() => onDelete(category)} disabled={busy} className={`${quietButton} text-coral`}>Delete</button>
            <button type="button" onClick={() => setConfirming(false)} className={quietButton}>Keep</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(category.id)} disabled={busy} className={quietButton}><Icon name="edit" className="size-4" /> Edit</button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy || inUse}
              title={inUse ? 'Move or delete its recipes first.' : undefined}
              aria-label={`Delete ${category.name}`}
              className="grid size-10 place-items-center rounded-full text-forest/55 ring-1 ring-forest/12 transition hover:bg-coral-pale hover:text-forest disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Icon name="trash" className="size-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

const blankCategory = { id: '', name: '', icon: '✦', tint: 'sage', description: '', count: 0 }

// Admin page for adding, editing, reordering and deleting categories.
// `categories` carry counts; `onChanged` reloads the collection.
export function CategoriesPage({ categories, initialEditing, onChanged }) {
  const [order, setOrder] = useState(categories)
  const [editing, setEditing] = useState(initialEditing && categories.some((item) => item.id === initialEditing) ? initialEditing : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => setOrder(categories), [categories])
  const takenIds = useMemo(() => categories.map((item) => item.id), [categories])

  async function run(work, message) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      await onChanged()
      setNotice(message)
      return true
    } catch (err) {
      setError(err.message || 'That change could not be saved.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function move(index, step) {
    const next = [...order]
    ;[next[index], next[index + step]] = [next[index + step], next[index]]
    setOrder(next)
    const saved = await run(() => reorderCategories(next.map((item) => item.id)), 'Order saved.')
    if (!saved) setOrder(categories)
  }

  async function save(form) {
    if (editing === 'new') {
      await createCategory({ ...form, sortOrder: categories.length ? Math.max(...categories.map((item) => item.sortOrder ?? 0)) + 1 : 0 })
      await onChanged()
      setNotice(`Added ${form.name.trim()}.`)
    } else {
      await updateCategory(form)
      await onChanged()
      setNotice(`Saved ${form.name.trim()}.`)
    }
    setEditing(null)
  }

  const editingCategory = editing === 'new' ? blankCategory : order.find((item) => item.id === editing)

  return (
    <AdminShell crumb={<span className="text-forest">Categories</span>} eyebrow="Admin" title="Categories">
      <p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-forest/65">
        Categories organize the collection and appear on the home page in this order. A category can be deleted only when it has no recipes.
      </p>
      {editingCategory ? (
        <CategoryForm
          key={editing}
          initial={editingCategory}
          isNew={editing === 'new'}
          takenIds={takenIds}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => { setNotice(''); setEditing('new') }} className={primaryButton}>
          <Icon name="plus" className="size-4" /> Add a category
        </button>
      )}
      <div className="mt-6 space-y-3">
        <ErrorNote message={error} />
        {notice && <p role="status" className="rounded-2xl bg-sage-pale px-4 py-3 text-sm text-forest">{notice}</p>}
        <ul className="space-y-2.5">
          {order.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              index={index}
              total={order.length}
              busy={busy || Boolean(editing)}
              onMove={move}
              onEdit={(id) => { setNotice(''); setEditing(id) }}
              onDelete={(item) => run(() => deleteCategory(item.id), `Deleted ${item.name}.`)}
            />
          ))}
        </ul>
      </div>
    </AdminShell>
  )
}
