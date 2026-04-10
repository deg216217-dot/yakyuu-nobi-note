// ===== バッジ・達成システム =====
// 子どもの「続ける力」「挑戦する力」「振り返る力」を可視化する

export const BADGE_DEFS = [
  // --- 継続バッジ ---
  { id: 'streak3',   category: 'streak',  icon: '🔥', name: '3日連続！',     desc: '3日続けて記録した',           check: (s) => s.streak >= 3 },
  { id: 'streak7',   category: 'streak',  icon: '⭐', name: '1週間達成！',   desc: '7日連続で記録した',           check: (s) => s.streak >= 7 },
  { id: 'streak14',  category: 'streak',  icon: '🥇', name: '2週間の鉄人！', desc: '14日連続で記録した',          check: (s) => s.streak >= 14 },
  { id: 'streak30',  category: 'streak',  icon: '🏅', name: '1ヶ月の伝説！', desc: '30日連続で記録した',          check: (s) => s.streak >= 30 },

  // --- 振り返り力バッジ ---
  { id: 'goal5',     category: 'mindset', icon: '📝', name: 'もくひょう5回',  desc: '目標を5回以上書いた',         check: (s) => s.totalGoals >= 5 },
  { id: 'goal20',    category: 'mindset', icon: '🎯', name: 'もくひょうマスター', desc: '目標を20回以上書いた',    check: (s) => s.totalGoals >= 20 },
  { id: 'play5',     category: 'mindset', icon: '✨', name: '100点プレー5回', desc: '100点プレーを5回以上書いた',   check: (s) => s.totalPlays >= 5 },
  { id: 'reflect5',  category: 'mindset', icon: '💭', name: 'ふりかえり上手', desc: 'モヤっとを5回以上書いた',     check: (s) => s.totalConcerns >= 5 },
]

const CATEGORY_NAMES = {
  streak: '🔥 つづける力',
  mindset: '🧠 ふりかえる力',
}

export function getCategoryName(cat) {
  return CATEGORY_NAMES[cat] || cat
}

export function evaluateBadges(stats, previouslyEarnedIds = []) {
  const earned = []
  const locked = []
  const newlyEarned = []

  for (const badge of BADGE_DEFS) {
    if (badge.check(stats)) {
      earned.push(badge)
      if (!previouslyEarnedIds.includes(badge.id)) {
        newlyEarned.push(badge)
      }
    } else {
      locked.push(badge)
    }
  }

  return { earned, locked, newlyEarned }
}

export function groupByCategory(badges) {
  const groups = {}
  for (const b of badges) {
    if (!groups[b.category]) groups[b.category] = []
    groups[b.category].push(b)
  }
  return groups
}

const BADGE_KEY = 'nobi_earned_badges'

export function getEarnedBadgeIds() {
  const raw = localStorage.getItem(BADGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveEarnedBadgeIds(ids) {
  localStorage.setItem(BADGE_KEY, JSON.stringify([...new Set(ids)]))
}
