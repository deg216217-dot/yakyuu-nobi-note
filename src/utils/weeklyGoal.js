// ===== 週間もくひょう管理 =====
// 子どもが自分で「今週の目標」を立て、振り返る力を育てる

import { weekStartStr } from './dateUtils'

// ===== localStorage版（おためしモード用） =====
const KEY = 'nobi_weekly_goals'

export function getLocalWeeklyGoals() {
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}

export function getLocalCurrentWeekGoal() {
  const ws = weekStartStr()
  return getLocalWeeklyGoals().find(g => g.weekStart === ws) || null
}

export function saveLocalWeeklyGoal(goal) {
  const goals = getLocalWeeklyGoals()
  const ws = weekStartStr()
  const idx = goals.findIndex(g => g.weekStart === ws)
  const entry = {
    weekStart: ws,
    ...goal,
    updatedAt: Date.now(),
  }
  if (idx >= 0) {
    goals[idx] = { ...goals[idx], ...entry }
  } else {
    goals.push({ ...entry, createdAt: Date.now() })
  }
  localStorage.setItem(KEY, JSON.stringify(goals))
}

// ===== 目標テンプレート（子どもが選びやすいように） =====
export const GOAL_TEMPLATES = [
  { icon: '⚾', text: '毎日素振りをする' },
  { icon: '🏃', text: '毎日自主練をする' },
  { icon: '📝', text: '毎日ふりかえりを書く' },
  { icon: '💪', text: '週3回以上練習する' },
  { icon: '🧘', text: '毎日ストレッチをする' },
  { icon: '🎯', text: '新しい練習メニューに挑戦する' },
  { icon: '🤝', text: '仲間のいいところを見つける' },
  { icon: '⏰', text: '週合計2時間以上練習する' },
]

/**
 * 目標の達成度を自動判定するヒント
 * （最終的な達成判定は子ども自身がする＝自己評価力を育てる）
 */
export const ACHIEVEMENT_LEVELS = [
  { value: 'perfect',  emoji: '🌟', label: 'ばっちり達成！',       color: '#f59e0b' },
  { value: 'good',     emoji: '⭐', label: 'だいたいできた',       color: '#2563eb' },
  { value: 'half',     emoji: '🔵', label: '半分くらいできた',     color: '#6b7280' },
  { value: 'tried',    emoji: '💪', label: 'がんばったけど難しかった', color: '#16a34a' },
  { value: 'notyet',   emoji: '🔜', label: '来週リベンジ！',       color: '#9ca3af' },
]
