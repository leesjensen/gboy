import { useMemo, useState } from 'react'
import { createRecipe, deleteRecipe, sendSignInLink, updateRecipe } from './supabase.js'
import { Breadcrumbs, Icon } from './ui.jsx'

const blockTypes = [
  { id: 'ingredient', label: 'Ingredient' },
  { id: 'step', label: 'Step' },
  { id: 'note', label: 'Note' },
  { id: 'label', label: 'Label' },
  { id: 'meta', label: 'Time / yield' },
]

const inputClass = 'w-full rounded-xl border border-forest/12 bg-white px-3.5 py-2.5 text-sm text-forest outline-none transition placeholder:text-forest/35 focus:border-forest/40 focus:ring-2 focus:ring-sage-pale'
const labelClass = 'mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-forest/55'
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50'
const quietButton = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-forest/70 ring-1 ring-forest/12 transition hover:bg-white hover:text-forest'

export function slugify(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const validId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)

function AdminShell({ crumb, title, eyebrow, children }) {
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
      <Breadcrumbs>{crumb}</Breadcrumbs>
      <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.21em] text-coral">{eyebrow}</p>
      <h1 className="mb-8 font-serif text-4xl font-semibold tracking-tight text-forest sm:text-5xl">{title}</h1>
      {children}
    </main>
  )
}

function ErrorNote({ message }) {
  if (!message) return null
  return <p role="alert" className="rounded-2xl bg-coral-pale px-4 py-3 text-sm text-forest">{message}</p>
}

export function SignInPage({ session, canEdit, onSignOut }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  if (session) {
    return (
      <AdminShell crumb={<span className="text-forest">Admin</span>} eyebrow="Admin" title="You're signed in">
        <div className="space-y-5 rounded-[1.65rem] bg-white p-6 shadow-sm ring-1 ring-forest/8 sm:p-8">
          <p className="text-sm leading-6 text-forest/70">
            Signed in as <strong className="font-semibold text-forest">{session.user.email}</strong>.{' '}
            {canEdit ? 'You can add, edit, and delete recipes.' : 'This account can browse recipes but not edit them.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {canEdit && <a href="#/new" className={primaryButton}><Icon name="plus" className="size-4" /> Add a recipe</a>}
            <button type="button" onClick={onSignOut} className={quietButton}>Sign out</button>
          </div>
        </div>
      </AdminShell>
    )
  }

  async function submit(event) {
    event.preventDefault()
    setStatus('sending')
    setError('')
    try {
      await sendSignInLink(email.trim())
      setStatus('sent')
    } catch (err) {
      setStatus('idle')
      setError(/signup|not allowed|not found/i.test(err.message)
        ? 'That email is not set up as an admin.'
        : err.message || 'The sign-in email could not be sent.')
    }
  }

  return (
    <AdminShell crumb={<span className="text-forest">Admin sign in</span>} eyebrow="Admin" title="Sign in to edit recipes">
      <div className="rounded-[1.65rem] bg-white p-6 shadow-sm ring-1 ring-forest/8 sm:p-8">
        {status === 'sent' ? (
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sage-pale text-forest"><Icon name="mail" className="size-5" /></span>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-forest">Check your email</h2>
              <p className="mt-2 text-sm leading-6 text-forest/65">We sent a sign-in link to <strong className="font-semibold text-forest">{email}</strong>. Open it in this browser within 10 minutes.</p>
              <button type="button" onClick={() => setStatus('idle')} className="mt-4 text-sm font-semibold text-coral">Use a different email</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm leading-6 text-forest/65">Recipe admins get a one-time sign-in link by email. Anyone can browse without signing in.</p>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" />
            </div>
            <ErrorNote message={error} />
            <button type="submit" disabled={status === 'sending'} className={primaryButton}>
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </AdminShell>
  )
}

let nextKey = 1
const withKey = (block) => ({ ...block, key: nextKey++ })

export function RecipeEditor({ recipe, defaultCategory, categories, summaries, onSaved, onDeleted }) {
  const isNew = !recipe
  const [form, setForm] = useState(() => ({
    title: recipe?.title || '',
    id: recipe?.id || '',
    category: recipe?.category || defaultCategory || categories[0]?.id || '',
    subcategory: recipe?.subcategory || '',
    sourcePage: recipe?.sourcePage ?? '',
    sourceEndPage: recipe?.sourceEndPage ?? '',
  }))
  const [idTouched, setIdTouched] = useState(false)
  const [blocks, setBlocks] = useState(() => (recipe?.blocks?.length ? recipe.blocks : [{ type: 'ingredient', text: '' }, { type: 'step', text: '' }]).map(withKey))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const id = isNew && !idTouched ? slugify(form.title) : form.id
  const subcategories = useMemo(
    () => [...new Set(summaries.filter((item) => item.category === form.category).map((item) => item.subcategory).filter(Boolean))].sort(),
    [summaries, form.category],
  )

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const updateBlock = (key, changes) => setBlocks((current) => current.map((block) => (block.key === key ? { ...block, ...changes } : block)))
  const removeBlock = (key) => setBlocks((current) => current.filter((block) => block.key !== key))
  const addBlock = (type) => setBlocks((current) => [...current, withKey({ type, text: '' })])
  const moveBlock = (index, offset) => setBlocks((current) => {
    const next = [...current]
    const [block] = next.splice(index, 1)
    next.splice(index + offset, 0, block)
    return next
  })

  async function save(event) {
    event.preventDefault()
    setError('')
    if (!form.title.trim()) return setError('Give the recipe a title.')
    if (isNew && !validId(id)) return setError('The ID can only use lowercase letters, numbers, and single dashes.')
    if (isNew && summaries.some((item) => item.id === id)) return setError('A recipe with that ID already exists. Change the title or ID.')
    setSaving(true)
    try {
      const payload = {
        ...form,
        id,
        sourcePage: Number(form.sourcePage) || null,
        sourceEndPage: Number(form.sourceEndPage) || null,
        blocks: blocks.map(({ type, text }) => ({ type, text: text.trim() })).filter((block) => block.text),
      }
      onSaved(isNew ? await createRecipe(payload) : await updateRecipe(payload))
    } catch (err) {
      setError(err.message || 'The recipe could not be saved.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${recipe.title}"? This can't be undone.`)) return
    setSaving(true)
    setError('')
    try {
      await deleteRecipe(recipe.id)
      onDeleted(recipe)
    } catch (err) {
      setError(err.message || 'The recipe could not be deleted.')
      setSaving(false)
    }
  }

  const crumb = isNew
    ? <span className="text-forest">New recipe</span>
    : <><a href={`#/recipe/${recipe.id}`} className="max-w-[15rem] truncate transition hover:text-forest">{recipe.title}</a><span>/</span><span className="text-forest">Edit</span></>

  return (
    <AdminShell crumb={crumb} eyebrow={isNew ? 'Add to the collection' : 'Edit recipe'} title={isNew ? 'New recipe' : recipe.title}>
      <form onSubmit={save} className="space-y-6">
        <section className="grid gap-5 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:grid-cols-2 sm:p-7">
          <div className="sm:col-span-2">
            <label htmlFor="title" className={labelClass}>Title</label>
            <input id="title" required value={form.title} onChange={set('title')} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="recipe-id" className={labelClass}>ID (used in links)</label>
            {isNew ? (
              <input id="recipe-id" value={id} onChange={(event) => { setIdTouched(true); setForm((current) => ({ ...current, id: event.target.value })) }} className={`${inputClass} font-mono`} placeholder="made-from-the-title" />
            ) : (
              <p id="recipe-id" className="rounded-xl bg-cream px-3.5 py-2.5 font-mono text-sm text-forest/60">{recipe.id}</p>
            )}
            <p className="mt-1.5 text-xs text-forest/45">{isNew ? 'Made from the title. It can’t be changed after saving, so links keep working.' : 'IDs stay the same when the title changes, so links keep working.'}</p>
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>Category</label>
            <select id="category" value={form.category} onChange={set('category')} className={inputClass}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subcategory" className={labelClass}>Subcategory (optional)</label>
            <input id="subcategory" list="subcategory-options" value={form.subcategory} onChange={set('subcategory')} className={inputClass} />
            <datalist id="subcategory-options">{subcategories.map((name) => <option key={name} value={name} />)}</datalist>
          </div>
          <div>
            <label htmlFor="source-page" className={labelClass}>Book page (optional)</label>
            <input id="source-page" type="number" min="1" value={form.sourcePage} onChange={set('sourcePage')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="source-end-page" className={labelClass}>Ends on page (optional)</label>
            <input id="source-end-page" type="number" min="1" value={form.sourceEndPage} onChange={set('sourceEndPage')} className={inputClass} />
          </div>
        </section>

        <section className="rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7">
          <h2 className="font-serif text-2xl font-semibold text-forest">Recipe text</h2>
          <p className="mt-1 text-sm leading-6 text-forest/55">Each line is an ingredient, a step, a note, a label such as “For the sauce:”, or a time or yield. Empty lines are dropped when you save.</p>
          <ol className="mt-5 space-y-2.5">
            {blocks.map((block, index) => (
              <li key={block.key} className="flex flex-col gap-2 rounded-2xl bg-cream/70 p-2.5 sm:flex-row sm:items-start">
                <select aria-label={`Line ${index + 1} type`} value={block.type} onChange={(event) => updateBlock(block.key, { type: event.target.value })} className={`${inputClass} sm:w-36 sm:shrink-0`}>
                  {blockTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
                <textarea aria-label={`Line ${index + 1} text`} rows={block.type === 'step' || block.type === 'note' ? 2 : 1} value={block.text} onChange={(event) => updateBlock(block.key, { text: event.target.value })} className={`${inputClass} min-h-[2.75rem] resize-y`} />
                <div className="flex shrink-0 gap-1 self-end sm:self-start">
                  <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveBlock(index, -1)} className="grid size-10 place-items-center rounded-xl text-forest/55 transition hover:bg-white hover:text-forest disabled:opacity-30"><Icon name="up" className="size-4" /></button>
                  <button type="button" aria-label="Move down" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} className="grid size-10 place-items-center rounded-xl text-forest/55 transition hover:bg-white hover:text-forest disabled:opacity-30"><Icon name="down" className="size-4" /></button>
                  <button type="button" aria-label="Remove line" onClick={() => removeBlock(block.key)} className="grid size-10 place-items-center rounded-xl text-forest/55 transition hover:bg-white hover:text-coral"><Icon name="close" className="size-4" /></button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {blockTypes.map((type) => (
              <button key={type.id} type="button" onClick={() => addBlock(type.id)} className="inline-flex items-center gap-1.5 rounded-full bg-sage-pale/70 px-3.5 py-2 text-xs font-semibold text-forest transition hover:bg-sage-pale">
                <Icon name="plus" className="size-3.5" /> {type.label}
              </button>
            ))}
          </div>
        </section>

        <ErrorNote message={error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : isNew ? 'Add recipe' : 'Save changes'}</button>
            <a href={isNew ? `#/category/${defaultCategory || 'all'}` : `#/recipe/${recipe.id}`} className={quietButton}>Cancel</a>
          </div>
          {!isNew && (
            <button type="button" disabled={saving} onClick={remove} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-coral transition hover:bg-coral-pale disabled:opacity-50">
              <Icon name="trash" className="size-4" /> Delete recipe
            </button>
          )}
        </div>
      </form>
    </AdminShell>
  )
}
