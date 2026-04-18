// Service Worker – 野球のびノート
// ネットワーク優先・キャッシュフォールバック方式（シンプル安定型）

const CACHE_NAME = 'yakyuu-nobi-note-v1'

// インストール時にプリキャッシュするファイル（app shell 最小限）
const APP_SHELL = [
  '/yakyuu-nobi-note/',
  '/yakyuu-nobi-note/icons/icon-192.png',
  '/yakyuu-nobi-note/icons/apple-touch-icon-180.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // プリキャッシュ失敗してもインストールは続行
      })
  )
  // 既存の SW を即座に置き換え
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 古いキャッシュを削除
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // GET 以外は何もしない
  if (event.request.method !== 'GET') return

  // Chrome の DevTools リクエストは無視
  if (event.request.url.includes('chrome-extension')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 正常レスポンスをキャッシュに保存
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // ネットワーク失敗時はキャッシュから返す
        return caches.match(event.request)
      })
  )
})
