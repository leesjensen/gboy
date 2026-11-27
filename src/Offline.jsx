import { useEffect, useState } from 'react'
import { AdminShell, primaryButton, quietButton } from './Admin.jsx'
import { clearOffline, refreshAfterMs, useInstallPrompt, useOfflineMeta, useOnlineStatus } from './offline.js'
import { downloadForOffline } from './supabase.js'
import { Icon } from './ui.jsx'

// Download progress shared by the offline page and the background refresh.
let download = { status: 'idle', done: 0, total: 0, error: '' }
const downloadListeners = new Set()

function setDownload(next) {
  download = { ...download, ...next }
  downloadListeners.forEach((listener) => listener(download))
}

export async function startDownload() {
  if (download.status === 'downloading') return
  setDownload({ status: 'downloading', done: 0, total: 0, error: '' })
  try {
    await downloadForOffline((done, total) => setDownload({ done, total: total ?? download.total }))
    setDownload({ status: 'idle' })
  } catch (error) {
    setDownload({
      status: 'error',
      error: navigator.onLine ? 'The download didn’t finish. Try again in a moment.' : 'You’re offline. Connect to download the recipes.',
    })
    console.error('Offline download failed', error)
  }
}

function useDownload() {
  const [state, setState] = useState(download)
  useEffect(() => {
    downloadListeners.add(setState)
    return () => downloadListeners.delete(setState)
  }, [])
  return state
}

// Re-downloads quietly when the app opens online and the copy is over a day old.
export function useOfflineAutoRefresh() {
  const online = useOnlineStatus()
  const { meta } = useOfflineMeta()
  const downloadedAt = meta?.downloadedAt
  useEffect(() => {
    if (!online || !downloadedAt) return
    if (Date.now() - new Date(downloadedAt).getTime() > refreshAfterMs) startDownload()
  }, [online, downloadedAt])
}

export function formatDownloadDate(iso) {
  const date = new Date(iso)
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay
    ? `today at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Small header link to the offline page; marks when the device is offline.
export function OfflineHeaderLink() {
  const online = useOnlineStatus()
  return (
    <a href="#/offline" aria-label={online ? 'Use GBoy offline' : 'You’re offline. Manage downloaded recipes'} title={online ? 'Use offline' : 'You’re offline'} className="relative grid size-9 place-items-center rounded-full text-forest/70 transition hover:bg-white hover:text-forest">
      <Icon name={online ? 'download' : 'cloud-off'} className="size-5" />
      {!online && <span className="absolute right-1 top-1 size-2 rounded-full bg-coral ring-2 ring-cream" />}
    </a>
  )
}

// Slim notice under the header while offline.
export function OfflineBanner() {
  const online = useOnlineStatus()
  const { ready, meta } = useOfflineMeta()
  if (online || !ready) return null
  return (
    <div role="status" className="border-b border-gold/25 bg-gold-pale/70">
      <p className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-2 text-xs font-medium text-forest/75 sm:px-8 lg:px-12">
        <Icon name="cloud-off" className="size-4 shrink-0" />
        {meta
          ? <span>You’re offline. Showing recipes downloaded {formatDownloadDate(meta.downloadedAt)}.</span>
          : <span>You’re offline. <a href="#/offline" className="font-semibold underline underline-offset-2">Download the recipes</a> next time you’re connected to read them without a connection.</span>}
      </p>
    </div>
  )
}

function Card({ icon, title, children }) {
  return (
    <section className="rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-sage-pale text-forest"><Icon name={icon} className="size-5" /></span>
        <h2 className="font-serif text-2xl font-semibold text-forest">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function InstallCard() {
  const { canPrompt, installed, ios, install } = useInstallPrompt()
  let body
  if (installed) {
    body = <p className="text-sm leading-6 text-forest/70"><span className="font-semibold text-forest">Installed ✓</span> You’re using GBoy from your home screen.</p>
  } else if (canPrompt) {
    body = (
      <>
        <p className="mb-4 text-sm leading-6 text-forest/70">Add GBoy to your home screen or dock so it opens like an app, in its own window.</p>
        <button type="button" onClick={install} className={primaryButton}><Icon name="plus" className="size-4" /> Install GBoy</button>
      </>
    )
  } else if (ios) {
    body = (
      <p className="text-sm leading-6 text-forest/70">
        In Safari, tap <span className="font-semibold text-forest">Share</span>, then <span className="font-semibold text-forest">Add to Home Screen</span>. GBoy will open like an app, in its own window.
      </p>
    )
  } else {
    body = (
      <p className="text-sm leading-6 text-forest/70">
        Use your browser’s <span className="font-semibold text-forest">Install</span> or <span className="font-semibold text-forest">Add to Home Screen</span> option. In Chrome and Edge it’s in the address bar or the menu; in Safari on a Mac, choose File, then Add to Dock.
      </p>
    )
  }
  return <Card icon="leaf" title="Add to your home screen">{body}</Card>
}

function DownloadCard({ totalRecipes }) {
  const online = useOnlineStatus()
  const { ready, meta } = useOfflineMeta()
  const state = useDownload()
  const [confirmRemove, setConfirmRemove] = useState(false)

  const downloading = state.status === 'downloading'
  const percent = state.total ? Math.round((state.done / state.total) * 100) : 0

  async function remove() {
    await clearOffline()
    setConfirmRemove(false)
  }

  return (
    <Card icon="download" title="Read recipes offline">
      {!ready ? null : meta ? (
        <p className="text-sm leading-6 text-forest/70">
          <span className="font-semibold text-forest">Downloaded {formatDownloadDate(meta.downloadedAt)}</span> · {meta.count.toLocaleString()} recipes{meta.bytes ? `, ${formatBytes(meta.bytes)}` : ''}.
          {' '}The copy on this device refreshes itself about once a day when you’re online, and your own edits are added right away.
        </p>
      ) : (
        <p className="text-sm leading-6 text-forest/70">
          Save every recipe{totalRecipes ? `, all ${totalRecipes.toLocaleString()} of them,` : ''} on this device (about 2 MB) so you can browse and search them without a connection: in the kitchen, at the cabin, or on the trail.
        </p>
      )}

      {downloading && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-sage-pale" aria-hidden="true">
            <div className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out" style={{ width: `${Math.max(4, percent)}%` }} />
          </div>
          <p className="mt-2 text-xs text-forest/55" role="status" aria-live="polite">
            Downloading… {state.total ? `${state.done.toLocaleString()} of ${state.total.toLocaleString()} recipes` : ''}
          </p>
        </div>
      )}
      {state.status === 'error' && <p role="alert" className="mt-4 rounded-2xl bg-coral-pale px-4 py-3 text-sm text-forest">{state.error}</p>}
      {!online && !downloading && <p className="mt-4 text-xs text-forest/55">You’re offline. Connect to {meta ? 'update' : 'download'} the recipes.</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={startDownload} disabled={downloading || !online} className={primaryButton}>
          <Icon name="download" className="size-4" /> {meta ? 'Update now' : 'Download recipes'}
        </button>
        {meta && !confirmRemove && (
          <button type="button" onClick={() => setConfirmRemove(true)} disabled={downloading} className={quietButton}>Remove download</button>
        )}
        {meta && confirmRemove && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-forest/70">
            Remove the recipes from this device?
            <button type="button" onClick={remove} className={`${quietButton} text-coral`}>Remove</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className={quietButton}>Keep</button>
          </span>
        )}
      </div>
    </Card>
  )
}

export function OfflinePage({ totalRecipes }) {
  return (
    <AdminShell crumb={<span className="text-forest">Use offline</span>} eyebrow="Take GBoy with you" title="Use GBoy offline">
      <div className="grid gap-5">
        <InstallCard />
        <DownloadCard totalRecipes={totalRecipes} />
      </div>
    </AdminShell>
  )
}
