import { createClient } from '@supabase/supabase-js'

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

export async function fetchCategories() {
  return check(await supabase.from('categories').select('id, name, sortOrder:sort_order').order('sort_order'))
}

// Every recipe without its body, for the home page, category lists and counts.
export async function fetchRecipeSummaries() {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const page = check(await supabase.from('recipes').select(summaryColumns)
      .order('title').order('id').range(from, from + pageSize - 1))
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export async function fetchRecipe(id) {
  return check(await supabase.from('recipes').select(detailColumns).eq('id', id).maybeSingle())
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
  if (error?.code === '23505') return new Error('A recipe with that ID already exists. Choose a different ID.')
  if (error?.code === '42501') return new Error('Your account is not allowed to make this change.')
  return error
}

export async function createRecipe(recipe) {
  const { data, error } = await supabase.from('recipes')
    .insert({ id: recipe.id, ...toRow(recipe), source_text: recipe.sourceText || '' }).select(detailColumns).single()
  if (error) throw friendlyError(error)
  return data
}

// RLS silently skips rows the user can't change, so an empty result means no access.
export async function updateRecipe(recipe) {
  const { data, error } = await supabase.from('recipes')
    .update(toRow(recipe)).eq('id', recipe.id).select(detailColumns)
  if (error) throw friendlyError(error)
  if (!data.length) throw new Error('Your account is not allowed to edit this recipe.')
  return data[0]
}

export async function deleteRecipe(id) {
  const { data, error } = await supabase.from('recipes').delete().eq('id', id).select('id')
  if (error) throw friendlyError(error)
  if (!data.length) throw new Error('Your account is not allowed to delete this recipe.')
}

export async function canEditRecipes() {
  return Boolean(check(await supabase.rpc('has_role', { p_predicate: 'admin', p_object: 'recipe/*' })))
}

export async function sendSignInLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

// Ranked full-text search (install/supabase/migrations/*_search_recipes.sql).
export async function searchRecipes(query, limit = 50) {
  const rows = check(await supabase.rpc('search_recipes', { p_query: query, p_limit: limit }))
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category_id,
    subcategory: row.subcategory,
    sourcePage: row.source_page,
    match: row.match,
  }))
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
