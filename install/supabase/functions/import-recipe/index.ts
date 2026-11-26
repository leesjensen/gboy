// Reads a recipe from a photo with Gemini and returns it as a draft for the
// app's recipe editor. Nothing is saved here: an admin reviews the draft and
// saves it through the normal (RLS-protected) recipe insert.
//
// Request (POST, JSON, with the signed-in admin's Authorization header):
//   { image: base64, mimeType: "image/jpeg", category: { id, name }, subcategories: string[] }
// Response: { recipe: { title, source, subcategory, blocks, sourceText }, warnings: string[] }
//
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional).
//   supabase --workdir install secrets set GEMINI_API_KEY=...

import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_MODEL = 'gemini-3.8-flash'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BLOCK_TYPES = ['ingredient', 'step', 'note', 'label', 'meta']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const recipeSchema = {
  type: 'object',
  properties: {
    isRecipe: { type: 'boolean', description: 'False when the image does not show a recipe.' },
    title: { type: 'string', description: 'The dish name only, without the source or comments.' },
    source: {
      type: 'string',
      description: 'Where the recipe came from (cookbook, magazine and issue, website, or person) if the image shows it, else "".',
    },
    subcategory: { type: 'string', description: 'One of the listed subcategories, or "" if none fits.' },
    blocks: {
      type: 'array',
      description: 'The recipe content in reading order.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: BLOCK_TYPES },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
    transcription: { type: 'string', description: 'All recipe text in the image, verbatim, line by line.' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short notes for the person reviewing: illegible words, guessed values, other recipes in the image.',
    },
  },
  required: ['isRecipe', 'title', 'source', 'subcategory', 'blocks', 'transcription', 'warnings'],
}

function buildPrompt(category: { id: string; name: string }, subcategories: string[]) {
  return `You are transcribing a recipe for "GBoy, the Giant Book of Yum", a family cookbook of recipes Lisa Jensen
has collected from cookbooks, magazines, websites, friends, and family. The image is a photo or scan of one
recipe: a cookbook or magazine page, a printout, a recipe card, or handwriting.

The recipe belongs in the "${category.name}" category. Subcategories already used there:
${subcategories.length ? subcategories.map((name) => `- ${name}`).join('\n') : '- (none)'}

Return the recipe as JSON matching the schema. Rules:
- Transcribe faithfully. Keep the recipe's own wording, quantities, and abbreviations (c, T, t, oz, lb).
  Do not convert units, add ingredients, or fill in steps that aren't there.
- If a word or amount can't be read, write [illegible] in its place and add a warning.
- title: the dish name, in title case. Put "from ..." credits in source, not the title.
- source: the cookbook, magazine (with issue and page if shown), website, or person credited, without the
  word "from". Use "" if the image doesn't say.
- blocks, in the order they appear:
  - "meta" for servings, yield, and times ("Serves 4", "Makes 2 dozen", "Takes 25 minutes").
  - "label" for headings inside the recipe ("Filling", "For the sauce:", "Topping").
  - "ingredient": one per ingredient, with its quantity first ("1 c sugar", "2 eggs, beaten").
  - "step": one per direction. Keep the source's numbering ("1. ...") when it has numbers. Otherwise split a
    paragraph of directions into short steps of one or two sentences, without numbers.
  - "note": tips, variations, storage advice, and personal comments ("Kids love these").
- subcategory: pick the closest listed subcategory, or "" if none fits. Don't invent new ones.
- If the image holds more than one recipe, return the most complete one and name the others in warnings.
- If the image is not a recipe, set isRecipe to false and leave the other fields empty.
- transcription: every word of the recipe as it appears, line by line, for reference.`
}

async function callGemini(image: string, mimeType: string, prompt: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set for this function.')
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: image } }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: recipeSchema },
      }),
    },
  )
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Gemini error', response.status, JSON.stringify(result).slice(0, 2000))
    throw new Error(`Gemini returned ${response.status}: ${result?.error?.message ?? 'unknown error'}`)
  }
  const candidate = result?.candidates?.[0]
  const text = candidate?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? ''
  if (!text) {
    const reason = result?.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'no content'
    throw new Error(`Gemini did not return a recipe (${reason}).`)
  }
  return JSON.parse(text)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })

  // Only recipe admins may spend Gemini calls.
  const authorization = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )
  const token = authorization.replace(/^Bearer\s+/i, '')
  const { data: userData } = await supabase.auth.getUser(token)
  if (!userData?.user) return reply(401, { error: 'Sign in to import recipes.' })
  const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', { p_predicate: 'admin', p_object: 'recipe/*' })
  if (roleError || !isAdmin) return reply(403, { error: 'Only recipe admins can import recipes.' })

  let body: { image?: string; mimeType?: string; category?: { id?: string; name?: string }; subcategories?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Send JSON.' })
  }
  const { image, mimeType = 'image/jpeg', category } = body
  if (!image || typeof image !== 'string') return reply(400, { error: 'Include a photo.' })
  if (!IMAGE_TYPES.has(mimeType)) return reply(400, { error: 'Use a JPEG, PNG, or WebP photo.' })
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return reply(413, { error: 'That photo is too large.' })
  if (!category?.id || !category?.name) return reply(400, { error: 'Choose a category.' })
  const subcategories = Array.isArray(body.subcategories)
    ? body.subcategories.filter((item): item is string => typeof item === 'string').slice(0, 100)
    : []

  try {
    const draft = await callGemini(image, mimeType, buildPrompt({ id: category.id, name: category.name }, subcategories))
    if (!draft.isRecipe) {
      return reply(422, { error: "That photo doesn't look like a recipe. Try a clearer or closer photo." })
    }
    const blocks = (Array.isArray(draft.blocks) ? draft.blocks : [])
      .filter((block: { type?: string; text?: string }) => BLOCK_TYPES.includes(block?.type ?? '') && block.text?.trim())
      .map((block: { type: string; text: string }) => ({ type: block.type, text: block.text.trim() }))
    return reply(200, {
      recipe: {
        title: String(draft.title ?? '').trim(),
        source: String(draft.source ?? '').trim(),
        subcategory: subcategories.includes(draft.subcategory) ? draft.subcategory : '',
        category: category.id,
        blocks,
        sourceText: String(draft.transcription ?? '').trim(),
      },
      warnings: (Array.isArray(draft.warnings) ? draft.warnings : []).map(String).slice(0, 10),
    })
  } catch (error) {
    console.error(error)
    return reply(502, { error: error instanceof Error ? error.message : 'The photo could not be read.' })
  }
})
