import { createClient } from '@supabase/supabase-js'
import {
  deleteOfflineRecipe, getOfflineCategories, getOfflineMeta, getOfflineRecipe, getOfflineRecipes, isNetworkError,
  putOfflineRecipe, saveOfflineCollection, searchOffline, setOfflineRating,
} from './offline.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// PKCE returns the sign-in code in ?code=..., which leaves the #/ routes alone.
export const supabase = isConfigured
  ? createClient(url, anonKey, { auth: { flowType: 'pkce' } })
  : null

// PostgREST aliases map the table columns onto the app's camelCase shape.
const summaryColumns = 'id, title, category:category_id, subcategory, sourcePage:source_page'
const detailColumns = `${summaryColumns}, source, sourceEndPage:source_end_page, blocks, sourceText:source_text`
const pageSize = 1000

function check({ data, error }) {
  if (error) throw error
  return data
}

// How long a read may take before falling back to the downloaded copy.
const offlineFallbackMs = 8000
const asIs = (builder) => builder

// Reads go to the downloaded copy (src/offline.js) right away when the browser
// reports it is offline; otherwise they try the network first and fall back
// to the copy if the request fails. With a copy to fall back on, requests
// skip supabase-js's automatic retries (about 7 seconds of backoff on a
// network failure) and give up after offlineFallbackMs. `online(tune)` must
// pass each query builder through `tune`.
async function withOfflineFallback(online, offline) {
  const hasCopy = Boolean(await getOfflineMeta().catch(() => null))
  if (hasCopy && navigator.onLine === false) {
    const local = await offline().catch(() => null)
    if (local != null) return local
  }
  const tune = hasCopy ? (builder) => builder.retry(false).abortSignal(AbortSignal.timeout(offlineFallbackMs)) : asIs
  try {
    return await online(tune)
  } catch (error) {
    if (!isNetworkError(error)) throw error
    const local = await offline().catch(() => null)
    if (local == null) throw error
    return local
  }
}

function toSummary({ id, title, category, subcategory, sourcePage, ratingAverage, ratingCount }) {
  return { id, title, category, subcategory, sourcePage, ratingAverage, ratingCount }
}

// Rating totals (install/supabase/migrations/*_recipe_ratings.sql) as
// { [recipeId]: { ratingAverage, ratingCount } }. Unrated recipes are absent.
async function fetchRatingTotals(tune = asIs) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const page = check(await tune(supabase.from('recipe_rating_stats')
      .select('recipe_id, rating_count, rating_average').order('recipe_id').range(from, from + pageSize - 1)))
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return Object.fromEntries(rows.map((row) => [row.recipe_id, { ratingAverage: Number(row.rating_average), ratingCount: row.rating_count }]))
}

// Ratings are extra: if their totals can't load, recipes still do (unrated).
function optionalRatingTotals(tune) {
  return fetchRatingTotals(tune).catch((error) => {
    console.warn('Rating totals unavailable', error)
    return {}
  })
}

const unrated = { ratingAverage: null, ratingCount: 0 }
const withRatings = (recipes, totals) => recipes.map((recipe) => ({ ...recipe, ...(totals[recipe.id] || unrated) }))

async function fetchAllPages(columns, { size = pageSize, onPage, tune = asIs } = {}) {
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error, count } = await tune(supabase.from('recipes').select(columns, { count: from ? undefined : 'exact' })
      .order('title').order('id').range(from, from + size - 1))
    if (error) throw error
    rows.push(...data)
    onPage?.(rows.length, count)
    if (data.length < size) return rows
  }
}

export async function fetchCategories() {
  return withOfflineFallback(
    async (tune) => check(await tune(supabase.from('categories').select('id, name, sortOrder:sort_order').order('sort_order'))),
    getOfflineCategories,
  )
}

// Every recipe without its body, for the home page, category lists and counts.
export async function fetchRecipeSummaries() {
  return withOfflineFallback(
    async (tune) => {
      const [recipes, totals] = await Promise.all([fetchAllPages(summaryColumns, { tune }), optionalRatingTotals(tune)])
      return withRatings(recipes, totals)
    },
    async () => (await getOfflineRecipes())?.map(toSummary) ?? null,
  )
}

export async function fetchRecipe(id) {
  return withOfflineFallback(
    async (tune) => check(await tune(supabase.from('recipes').select(detailColumns).eq('id', id).maybeSingle())),
    () => getOfflineRecipe(id),
  )
}

// Downloads every category and full recipe for offline reading.
// onProgress(done, total) reports recipes received so far.
export async function downloadForOffline(onProgress) {
  const categories = check(await supabase.from('categories').select('id, name, sortOrder:sort_order').order('sort_order'))
  const [recipes, totals] = await Promise.all([fetchAllPages(detailColumns, { size: 200, onPage: onProgress }), optionalRatingTotals()])
  await saveOfflineCollection(categories, withRatings(recipes, totals))
  return recipes.length
}

function toRow(recipe) {
  return {
    title: recipe.title.trim(),
    category_id: recipe.category,
    subcategory: recipe.subcategory.trim(),
    source: recipe.source.trim(),
    source_page: recipe.sourcePage || null,
    source_end_page: recipe.sourceEndPage || null,
    blocks: recipe.blocks,
  }
}

function friendlyError(error) {
  if (isNetworkError(error)) return new Error("You're offline. Editing needs a connection.")
  if (error?.code === '23505') return new Error('A recipe with that ID already exists. Choose a different ID.')
  if (error?.code === '42501') return new Error('Your account is not allowed to make this change.')
  return error
}

export async function createRecipe(recipe) {
  const { data, error } = await supabase.from('recipes')
    .insert({ id: recipe.id, ...toRow(recipe), source_text: recipe.sourceText || '' }).select(detailColumns).single()
  if (error) throw friendlyError(error)
  await putOfflineRecipe(data).catch(() => {})
  return data
}

// RLS silently skips rows the user can't change, so an empty result means no access.
export async function updateRecipe(recipe) {
  const { data, error } = await supabase.from('recipes')
    .update(toRow(recipe)).eq('id', recipe.id).select(detailColumns)
  if (error) throw friendlyError(error)
  if (!data.length) throw new Error('Your account is not allowed to edit this recipe.')
  await putOfflineRecipe(data[0]).catch(() => {})
  return data[0]
}

export async function deleteRecipe(id) {
  const { data, error } = await supabase.from('recipes').delete().eq('id', id).select('id')
  if (error) throw friendlyError(error)
  if (!data.length) throw new Error('Your account is not allowed to delete this recipe.')
  await deleteOfflineRecipe(id).catch(() => {})
}

export async function canEditRecipes() {
  return Boolean(check(await supabase.rpc('has_role', { p_predicate: 'admin', p_object: 'recipe/*' })))
}

// Anyone can sign in (to rate recipes); new accounts confirm their email
// first. The email link returns to the site root, so a "Sign in" link
// remembers the page it was tapped on (rememberSignInReturn) and the app goes
// back there after sign-in (takeSignInReturn).
const returnKey = 'gboy-sign-in-return'
const returnMaxAgeMs = 60 * 60 * 1000

export function rememberSignInReturn(hash = window.location.hash) {
  if (!hash || /^#\/(account|admin)/.test(hash)) return
  localStorage.setItem(returnKey, JSON.stringify({ hash, at: Date.now() }))
}

export function takeSignInReturn() {
  const saved = localStorage.getItem(returnKey)
  localStorage.removeItem(returnKey)
  try {
    const { hash, at } = JSON.parse(saved)
    return Date.now() - at < returnMaxAgeMs ? hash : null
  } catch {
    return null
  }
}

export async function sendSignInLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

export async function deleteMyAccount() {
  check(await supabase.rpc('delete_my_account'))
  await supabase.auth.signOut({ scope: 'local' })
}

// The signed-in user's own rating of a recipe (1-5), or null.
export async function fetchMyRating(recipeId, userId) {
  const row = check(await supabase.from('ratings').select('stars').eq('recipe_id', recipeId).eq('user_id', userId).maybeSingle())
  return row?.stars ?? null
}

// Sets (1-5) or removes (null) the user's rating, then returns the recipe's
// new totals.
export async function rateRecipe(recipeId, stars) {
  const { error } = await supabase.rpc('rate_recipe', { p_recipe_id: recipeId, p_stars: stars })
  if (error) throw friendlyError(error)
  const row = check(await supabase.from('recipe_rating_stats').select('rating_count, rating_average').eq('recipe_id', recipeId).maybeSingle())
  const totals = row ? { ratingAverage: Number(row.rating_average), ratingCount: row.rating_count } : unrated
  await setOfflineRating(recipeId, totals).catch(() => {})
  return totals
}

// Ranked full-text search (install/supabase/migrations/*_search_recipes.sql).
export async function searchRecipes(query, limit = 50) {
  return withOfflineFallback(async (tune) => {
    const rows = check(await tune(supabase.rpc('search_recipes', { p_query: query, p_limit: limit })))
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category_id,
      subcategory: row.subcategory,
      sourcePage: row.source_page,
      match: row.match,
    }))
  }, async () => ((await getOfflineRecipes()) ? searchOffline(query, limit) : null))
}

// Sends a photo to the import-recipe Edge Function, which reads it with Gemini
// and returns { recipe, warnings }: a draft for the editor, not a saved recipe.
export async function readRecipePhoto({ image, mimeType, category, subcategories }) {
  const { data, error } = await supabase.functions.invoke('import-recipe', {
    body: { image, mimeType, category, subcategories },
  })
  if (error) {
    const details = await error.context?.json?.().catch(() => null)
    throw new Error(details?.error || 'The photo could not be read. Try again in a moment.')
  }
  return data
}
