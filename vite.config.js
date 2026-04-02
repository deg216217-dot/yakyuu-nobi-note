import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ★ GitHub PagesのリポジトリURLに合わせて変更してください
// 例: https://deg216217-dot.github.io/yakyuu-nobi-note/ なら '/yakyuu-nobi-note/'
const REPO_NAME = '/yakyuu-nobi-note/'

export default defineConfig({
  plugins: [react()],
  base: REPO_NAME,
})
