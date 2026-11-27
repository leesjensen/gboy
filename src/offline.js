// The downloaded recipe collection, kept in IndexedDB for offline reading.
// One object store holds three keys: categories, recipes (full records in the
// app's camelCase shape) and meta ({ downloadedAt, count, bytes }).
import { useCallback, useEffect, useState } from 'react'

const dbName = 'gboy-offline'
const storeName = 'collection'
export const refreshAfterMs = 24 * 60 * 60 * 1000

let dbPromise
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(storeName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    dbPromise.catch(() => {
      dbPromise = undefined
    })
  }
  return dbPromise
}

async function withStore(mode, work) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const result = work(tx.objectStore(storeName))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const read = (key) => withStore('readonly', (store) => store.get(key))

// In-memory copy so offline browsing doesn't re-read 2 MB per page.
let cache = null
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener())
}

async function load() {
  if (cache) return cache
  if (typeof indexedDB === 'undefined') return null
  const [meta, categories, recipes] = await Promise.all([read('meta'), read('categories'), read('recipes')])
  cache = meta && categories && recipes ? { meta, categories, recipes } : null
  return cache
}

async function writeCollection(categories, recipes, downloadedAt) {
  // Approximate size of the download itself (the origin may hold other data).
  const bytes = new Blob([JSON.stringify(categories), JSON.stringify(recipes)]).size
  const meta = { downloadedAt, count: recipes.length, bytes }
  await withStore('readwrite', (store) => {
    store.put(categories, 'categories')
    store.put(recipes, 'recipes')
    store.put(meta, 'meta')
  })
  cache = { meta, categories, recipes }
  notify()
}

export async function getOfflineMeta() {
  return (await load())?.meta ?? null
}

export async function getOfflineCategories() {
  return (await load())?.categories ?? null
}

export async function getOfflineRecipes() {
  return (await load())?.recipes ?? null
}

export async function getOfflineRecipe(id) {
  const recipes = await getOfflineRecipes()
  return recipes ? recipes.find((recipe) => recipe.id === id) ?? null : null
}

export async function saveOfflineCollection(categories, recipes) {
  await writeCollection(categories, recipes, new Date().toISOString())
  // Ask the browser not to evict the download under storage pressure.
  navigator.storage?.persist?.().catch(() => {})
}

// Keep an existing download in step with an admin's own edits.
export async function putOfflineRecipe(recipe) {
  const current = await load()
  if (!current) return
  const recipes = current.recipes.filter((item) => item.id !== recipe.id).concat(recipe)
  recipes.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  await writeCollection(current.categories, recipes, current.meta.downloadedAt)
}

export async function deleteOfflineRecipe(id) {
  const current = await load()
  if (!current) return
  await writeCollection(current.categories, current.recipes.filter((item) => item.id !== id), current.meta.downloadedAt)
}

export async function clearOffline() {
  await withStore('readwrite', (store) => store.clear())
  cache = null
  notify()
}

function words(text) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1)
}

// Every query word must appear somewhere; title matches rank above
// subcategory matches, which rank above matches in the recipe text.
export async function searchOffline(query, limit = 50) {
  const recipes = (await getOfflineRecipes()) || []
  const terms = words(query)
  if (!terms.length) return []
  const results = []
  for (const recipe of recipes) {
    const title = recipe.title.toLowerCase()
    const subcategory = (recipe.subcategory || '').toLowerCase()
    const lines = (recipe.blocks || []).map((block) => block.text || '')
    const body = lines.join('\n').toLowerCase()
    let score = 0
    let matched = true
    for (const term of terms) {
      if (title.includes(term)) score += 10
      else if (subcategory.includes(term)) score += 4
      else if (body.includes(term)) score += 1
      else {
        matched = false
        break
      }
    }
    if (!matched) continue
    const match = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term))) || ''
    results.push({
      id: recipe.id,
      title: recipe.title,
      category: recipe.category,
      subcategory: recipe.subcategory,
      sourcePage: recipe.sourcePage,
      match,
      score,
    })
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return results.slice(0, limit)
}

// Network-ish failure: the device is offline, the request never completed,
// or it timed out (src/supabase.js aborts slow reads when a copy exists).
export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = `${error?.name || ''} ${error?.message || error || ''} ${error?.details || ''}`
  return error instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network|AbortError|TimeoutError|aborted|timed out/i.test(message)
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

// The download's metadata, kept current across the app.
export function useOfflineMeta() {
  const [state, setState] = useState({ ready: false, meta: null })
  useEffect(() => {
    let active = true
    const refresh = () => getOfflineMeta()
      .then((meta) => active && setState({ ready: true, meta }))
      .catch(() => active && setState({ ready: true, meta: null }))
    refresh()
    listeners.add(refresh)
    return () => {
      active = false
      listeners.delete(refresh)
    }
  }, [])
  return state
}

// Captures the browser's install prompt (Chrome, Edge, Android) and whether
// the app is already running from the home screen.
let deferredPrompt = null
const installListeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    installListeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installListeners.forEach((listener) => listener())
  })
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function useInstallPrompt() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1)
    installListeners.add(listener)
    return () => installListeners.delete(listener)
  }, [])
  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    const prompt = deferredPrompt
    deferredPrompt = null
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    installListeners.forEach((listener) => listener())
    return outcome === 'accepted'
  }, [])
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return { canPrompt: Boolean(deferredPrompt), installed: isStandalone(), ios, install }
}
