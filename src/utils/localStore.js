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

// ----- 下書き（記録ページの未保存入力） -----
// キー形式: nobi_draft_{date}
// 例: nobi_draft_2025-04-12
// 別の日付と混ざらないよう、日付をキーに含める。

const DRAFT_KEY_PREFIX = PREFIX + 'draft_'

/**
 * 指定日の下書きを取得する。
 * @param {string} date - 'YYYY-MM-DD' 形式
 * @returns {object|null}
 */
export function getDraft(date) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + date)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * 指定日の下書きを保存する。
 * @param {string} date - 'YYYY-MM-DD' 形式
 * @param {object} data - フォーム内容
 */
export function saveDraft(date, data) {
  try {
    localStorage.setItem(DRAFT_KEY_PREFIX + date, JSON.stringify({
      ...data,
      _savedAt: Date.now(),
    }))
  } catch (e) {
    // localStorage がフル等の場合は静かに無視
    console.warn('下書き保存に失敗:', e)
  }
}

/**
 * 指定日の下書きを消去する（保存完了時に呼ぶ）。
 * @param {string} date - 'YYYY-MM-DD' 形式
 */
export function clearDraft(date) {
  localStorage.removeItem(DRAFT_KEY_PREFIX + date)
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
  // ナッジ dismissal
  localStorage.removeItem(PREFIX + 'nudge_dismissed')
  localStorage.removeItem('nudgeDismissed')

  // 下書き：全キーをスキャンして nobi_draft_ を消す
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(DRAFT_KEY_PREFIX)) keysToRemove.push(key)
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}
