// ===== バッジ・達成システム =====
// 子どもの「続ける力」「挑戦する力」「振り返る力」を可視化する

/**
 * バッジ定義
 * category: streak(継続), effort(努力), mindset(振り返り力), team(チーム力)
 */
export const BADGE_DEFS = [
  // --- 継続バッジ ---
  { id: 'streak3',   category: 'streak',  icon: '🔥', name: '3日連続！',     desc: '3日続けて記録した',           check: (s) => s.streak >= 3 },
  { id: 'streak7',   category: 'streak',  icon: '⭐', name: '1週間達成！',   desc: '7日連続で記録した',           check: (s) => s.streak >= 7 },
  { id: 'streak14',  category: 'streak',  icon: '🥇', name: '2週間の鉄人！', desc: '14日連続で記録した',          check: (s) => s.streak >= 14 },
  { id: 'streak30',  category: 'streak',  icon: '🏅', name: '1ヶ月の伝説！', desc: '30日連続で記録した',          check: (s) => s.streak >= 30 },

  // --- 努力バッジ ---
  { id: 'first30',   category: 'effort',  icon: '💪', name: 'はじめの30分！', desc: '1日30分以上練習した',         check: (s) => s.todayMinutes >= 30 },
  { id: 'first60',   category: 'effort',  icon: '🏋️', name: '1時間チャレンジ', desc: '1日60分以上練習した',       check: (s) => s.todayMinutes >= 60 },
  { id: 'week120',   category: 'effort',  icon: '🚀', name: '週間2時間！',   desc: '1週間で合計120分以上練習した', check: (s) => s.weekMinutes >= 120 },
  { id: 'week300',   category: 'effort',  icon: '🌟', name: '週間5時間！',   desc: '1週間で合計300分以上練習した', check: (s) => s.weekMinutes >= 300 },
  { id: 'variety3',  category: 'effort',  icon: '🎯', name: 'バランス練習',  desc: '1週間で3種類以上の練習をした', check: (s) => s.weekMenuTypes >= 3 },
  { id: 'variety5',  category: 'effort',  icon: '🌈', name: 'オールラウンダー', desc: '1週間で5種類以上の練習をした', check: (s) => s.weekMenuTypes >= 5 },

  // --- 振り返り力バッジ ---
  { id: 'goal5',     category: 'mindset', icon: '📝', name: 'もくひょう5回',  desc: '目標を5回以上書いた',         check: (s) => s.totalGoals >= 5 },
  { id: 'goal20',    category: 'mindset', icon: '🎯', name: 'もくひょうマスター', desc: '目標を20回以上書いた',    check: (s) => s.totalGoals >= 20 },
  { id: 'play5',     category: 'mindset', icon: '✨', name: '100点プレー5回', desc: '100点プレーを5回以上書いた',   check: (s) => s.totalPlays >= 5 },
  { id: 'reflect5',  category: 'mindset', icon: '💭', name: 'ふりかえり上手', desc: 'モヤっとを5回以上書いた',     check: (s) => s.totalConcerns >= 5 },

  // --- チーム力バッジ ---
  { id: 'nice10',    category: 'team',    icon: '👍', name: 'ナイス10回！',   desc: '仲間にナイスを10回送った',    check: (s) => s.nicesSent >= 10 },
  { id: 'nice50',    category: 'team',    icon: '🤝', name: 'チームの太陽',   desc: '仲間にナイスを50回送った',    check: (s) => s.nicesSent >= 50 },
  { id: 'teammate5', category: 'mindset', icon: '👏', name: '仲間を見てる！', desc: 'ナイスプレーを5回以上書いた', check: (s) => s.totalTeammatePlays >= 5 },
]

const CATEGORY_NAMES = {
  streak: '🔥 つづける力',
  effort: '💪 がんばる力',
  mindset: '🧠 ふりかえる力',
  team: '🤝 チームの力',
}

export function getCategoryName(cat) {
  return CATEGORY_NAMES[cat] || cat
}

/**
 * 統計データからバッジの獲得状況を判定する
 * @param {object} stats - { streak, todayMinutes, weekMinutes, weekMenuTypes, totalGoals, totalPlays, totalConcerns, nicesSent, totalTeammatePlays }
 * @returns {{ earned: Badge[], locked: Badge[], newlyEarned: Badge[] }}
 */
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

/**
 * バッジをカテゴリ別にグループ化
 */
export function groupByCategory(badges) {
  const groups = {}
  for (const b of badges) {
    if (!groups[b.category]) groups[b.category] = []
    groups[b.category].push(b)
  }
  return groups
}

// ===== localStorage でバッジ獲得状況を保存 =====
const BADGE_KEY = 'nobi_earned_badges'

export function getEarnedBadgeIds() {
  const raw = localStorage.getItem(BADGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveEarnedBadgeIds(ids) {
  localStorage.setItem(BADGE_KEY, JSON.stringify([...new Set(ids)]))
}
