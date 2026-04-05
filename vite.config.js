import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REPO_NAME = '/yakyuu-nobi-note/'

export default defineConfig({
  plugins: [react()],
  base: REPO_NAME,
  build: {
    rollupOptions: {
      output: {
        // Firebase SDK を別チャンクに分離 → 初回読み込み後キャッシュされる
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // gzip 181KB → チャンク分割で初期ロード改善
    chunkSizeWarningLimit: 400,
  },
})
