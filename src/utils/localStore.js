// ===== おためしモード用 localStorage 操作 =====
// 全データを「nobi_」プレフィックスで保存する
// 【重要】clearAllLocal は「nobi_」キーだけを消す。localStorage.clear() は絶対に使わない。

const PREFIX = 'nobi_'

// ----- プロフィール -----
export function getLocalProfile() {
  const raw = localStorage.getItem(PREFIX + 'profile')
  return raw ? JSON.parse(raw) : null
}

export function setLocalProfile(profile) {
  localStorage.setItem(PREFIX + 'profile', JSON.stringify(profile))
}

// ----- 日次レコード -----
/** 全レコードを取得 */
export function getAllRecords() {
  const raw = localStorage.getItem(PREFIX + 'records')
  return raw ? JSON.parse(raw) : []
}

/** 特定日のレコードを取得 */
export function getRecordByDate(date) {
  return getAllRecords().find(r => r.date === date) || null
}

/** レコードを保存（既存は上書き、なければ追加） */
export function saveRecord(record) {
  const records = getAllRecords()
  const idx = records.findIndex(r => r.date === record.date)
  if (idx >= 0) {
    records[idx] = { ...records[idx], ...record, updatedAt: Date.now() }
  } else {
    records.push({ ...record, createdAt: Date.now(), updatedAt: Date.now() })
  }
  localStorage.setItem(PREFIX + 'records', JSON.stringify(records))
}

// ----- 練習メニュー -----
/** 全メニューを取得 */
export function getAllMenus() {
  const raw = localStorage.getItem(PREFIX + 'menus')
  return raw ? JSON.parse(raw) : []
}

/** 特定日のメニューを取得 */
export function getMenusByDate(date) {
  return getAllMenus().filter(m => m.date === date)
}

/** メニューを1件追加 */
export function addMenu(menu) {
  const menus = getAllMenus()
  menus.push({ ...menu, id: Date.now().toString(), createdAt: Date.now() })
  localStorage.setItem(PREFIX + 'menus', JSON.stringify(menus))
}

/** メニューを1件削除 */
export function deleteMenu(id) {
  const menus = getAllMenus().filter(m => m.id !== id)
  localStorage.setItem(PREFIX + 'menus', JSON.stringify(menus))
}

// ----- 全データエクスポート（本登録時の移行用） -----
export function exportAllLocal() {
  return {
    profile: getLocalProfile(),
    records: getAllRecords(),
    menus: getAllMenus(),
  }
}

/**
 * 移行完了後 or データ消去時にこのアプリ専用データだけを消す。
 * 【修正】localStorage.clear() は他サイトのデータまで消すので絶対に使わない。
 * このアプリが使っている全キーを列挙して個別に消す。
 */
export function clearAllLocal() {
  // 基本データ
  localStorage.removeItem(PREFIX + 'profile')
  localStorage.removeItem(PREFIX + 'records')
  localStorage.removeItem(PREFIX + 'menus')
  // バッジ獲得状況
  localStorage.removeItem(PREFIX + 'earned_badges')
  // 週間もくひょう
  localStorage.removeItem(PREFIX + 'weekly_goals')
  // 念のため旧キー名も消す（badges.js が 'nobi_earned_badges' を直接使っている）
  localStorage.removeItem('nobi_earned_badges')
  localStorage.removeItem('nobi_weekly_goals')
}
