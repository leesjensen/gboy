import { useMemo, useState } from 'react'
import { createRecipe, deleteMyAccount, deleteRecipe, sendSignInCode, updateRecipe, verifySignInCode } from './supabase.js'
import { Breadcrumbs, Icon } from './ui.jsx'

const blockTypes = [
  { id: 'ingredient', label: 'Ingredient' },
  { id: 'step', label: 'Step' },
  { id: 'note', label: 'Note' },
  { id: 'label', label: 'Label' },
  { id: 'meta', label: 'Time / yield' },
]

export const inputClass = 'w-full rounded-xl border border-forest/12 bg-white px-3.5 py-2.5 text-sm text-forest outline-none transition placeholder:text-forest/35 focus:border-forest/40 focus:ring-2 focus:ring-sage-pale'
export const labelClass = 'mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-forest/55'
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50'
export const quietButton = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-forest/70 ring-1 ring-forest/12 transition hover:bg-white hover:text-forest'

export function slugify(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const validId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)

export function AdminShell({ crumb, title, eyebrow, children }) {
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [code, setCode] = useState('')

  async function removeAccount() {
    setStatus('deleting')
    setError('')
    try {
      await deleteMyAccount()
      window.location.hash = '#/'
    } catch (err) {
      setStatus('idle')
      setError(err.message || 'Your account could not be deleted. Try again in a moment.')
    }
  }

  if (session) {
    return (
      <AdminShell crumb={<span className="text-forest">Account</span>} eyebrow="Your account" title="You're signed in">
        <div className="space-y-5 rounded-[1.65rem] bg-white p-6 shadow-sm ring-1 ring-forest/8 sm:p-8">
          <p className="text-sm leading-6 text-forest/70">
            Signed in as <strong className="font-semibold text-forest">{session.user.email}</strong>.{' '}
            {canEdit ? 'You can rate recipes and add, edit, and delete them.' : 'You can rate any recipe from its page.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {canEdit && <a href="#/new" className={primaryButton}><Icon name="plus" className="size-4" /> Add a recipe</a>}
            {canEdit && <a href="#/import" className={quietButton}><Icon name="camera" className="size-4" /> Add from a photo</a>}
            <button type="button" onClick={onSignOut} className={quietButton}>Sign out</button>
          </div>
        </div>
        <div className="mt-5 rounded-[1.65rem] bg-white p-6 shadow-sm ring-1 ring-forest/8 sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-forest">Delete your account</h2>
          <p className="mt-2 text-sm leading-6 text-forest/65">
            This removes your account, your email address, and all of your ratings{canEdit ? ', along with your admin access' : ''}. It can’t be undone.
          </p>
          <ErrorNote message={error} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className={quietButton}>Delete my account…</button>
            ) : (
              <>
                <span className="text-sm text-forest/70">Delete your account and ratings for good?</span>
                <button type="button" onClick={removeAccount} disabled={status === 'deleting'} className={`${quietButton} text-coral`}>
                  {status === 'deleting' ? 'Deleting…' : 'Delete account'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={status === 'deleting'} className={quietButton}>Keep it</button>
              </>
            )}
          </div>
        </div>
      </AdminShell>
    )
  }

  function friendlySendError(err) {
    return /rate limit|too many|seconds/i.test(err.message)
      ? 'Too many codes have been sent recently. Wait a minute and try again.'
      : err.message || 'The sign-in code could not be sent.'
  }

  // `resend` keeps the code form showing while a new code is sent.
  async function sendCode(event, resend = false) {
    event?.preventDefault()
    setStatus(resend ? 'resending' : 'sending')
    setError('')
    try {
      await sendSignInCode(email.trim())
      setCode('')
      setStatus('sent')
    } catch (err) {
      setStatus(resend ? 'sent' : 'idle')
      setError(friendlySendError(err))
    }
  }

  async function verify(event) {
    event.preventDefault()
    setStatus('verifying')
    setError('')
    try {
      await verifySignInCode(email.trim(), code)
      // The session update re-renders this page as signed in.
    } catch (err) {
      setStatus('sent')
      setError(/expired|invalid|token/i.test(err.message)
        ? 'That code didn’t work. Check it, or send a new one.'
        : err.message || 'That code could not be checked. Try again in a moment.')
    }
  }

  return (
    <AdminShell crumb={<span className="text-forest">Sign in</span>} eyebrow="Your account" title="Sign in to rate recipes">
      <div className="rounded-[1.65rem] bg-white p-6 shadow-sm ring-1 ring-forest/8 sm:p-8">
        {status === 'sent' || status === 'verifying' || status === 'resending' ? (
          <form onSubmit={verify} className="space-y-5">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sage-pale text-forest"><Icon name="mail" className="size-5" /></span>
              <div>
                <h2 className="font-serif text-2xl font-semibold text-forest">Check your email</h2>
                <p className="mt-2 text-sm leading-6 text-forest/65">We sent a 6-digit code to <strong className="font-semibold text-forest">{email}</strong>. Enter it here. It expires in 10 minutes.</p>
              </div>
            </div>
            <div>
              <label htmlFor="code" className={labelClass}>Code</label>
              <input
                id="code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${inputClass} max-w-48 text-center font-mono text-2xl tracking-[0.4em]`}
                placeholder="••••••"
              />
            </div>
            <ErrorNote message={error} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={code.length !== 6 || status === 'verifying'} className={primaryButton}>
                {status === 'verifying' ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => sendCode(null, true)} disabled={status !== 'sent'} className={quietButton}>{status === 'resending' ? 'Sending…' : 'Send a new code'}</button>
              <button type="button" onClick={() => { setStatus('idle'); setError(''); setCode('') }} className="text-sm font-semibold text-coral">Use a different email</button>
            </div>
          </form>
        ) : (
          <form onSubmit={sendCode} className="space-y-5">
            <p className="text-sm leading-6 text-forest/65">Sign in with your email to rate recipes. There’s no password: we email you a 6-digit code. Browsing and searching never need an account.</p>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" />
            </div>
            <ErrorNote message={error} />
            <button type="submit" disabled={status === 'sending'} className={primaryButton}>
              {status === 'sending' ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        )}
      </div>
    </AdminShell>
  )
}

let nextKey = 1
const withKey = (block) => ({ ...block, key: nextKey++ })

// Edits a saved recipe, or creates one (from scratch, or from a `draft` such as
// a recipe read from a photo). `intro` is shown above the form.
export function RecipeEditor({ recipe, draft, intro, defaultCategory, categories, summaries, onSaved, onDeleted }) {
  const isNew = !recipe
  const initial = recipe || draft
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    id: recipe?.id || '',
    category: initial?.category || defaultCategory || categories[0]?.id || '',
    subcategory: initial?.subcategory || '',
    source: initial?.source || '',
    sourcePage: initial?.sourcePage ?? '',
    sourceEndPage: initial?.sourceEndPage ?? '',
  }))
  const [idTouched, setIdTouched] = useState(false)
  const [blocks, setBlocks] = useState(() => (initial?.blocks?.length ? initial.blocks : [{ type: 'ingredient', text: '' }, { type: 'step', text: '' }]).map(withKey))
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
        sourceText: draft?.sourceText || '',
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
    <AdminShell crumb={crumb} eyebrow={draft ? 'Read from a photo' : isNew ? 'Add to the collection' : 'Edit recipe'} title={isNew ? 'New recipe' : recipe.title}>
      {intro}
      {isNew && !draft && (
        <a href={`#/import${form.category ? `/${form.category}` : ''}`} className="mb-6 flex items-center gap-3 rounded-2xl bg-gold-pale/70 px-4 py-3 text-sm text-forest/75 transition hover:bg-gold-pale">
          <Icon name="camera" className="size-5 shrink-0 text-coral" />
          <span><strong className="font-semibold text-forest">Have it on paper?</strong> Take a photo and let the recipe be read for you.</span>
          <Icon name="arrow" className="ml-auto size-4 shrink-0" />
        </a>
      )}
      <form onSubmit={save} className="space-y-6">
        <section className="grid gap-5 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:grid-cols-2 sm:p-7">
          <div className="sm:col-span-2">
            <label htmlFor="title" className={labelClass}>Title</label>
            <input id="title" required value={form.title} onChange={set('title')} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="source" className={labelClass}>Source (optional)</label>
            <input id="source" value={form.source} onChange={set('source')} className={inputClass} placeholder="Good Housekeeping, Jan/Feb 2020, p. 110" />
            <p className="mt-1.5 text-xs text-forest/45">Where the recipe came from. Shown as “From …” under the title.</p>
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
