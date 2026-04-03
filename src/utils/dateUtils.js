// ===== 日付ユーティリティ =====

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

/** 今日を YYYY-MM-DD で返す */
export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/** n日前を YYYY-MM-DD で返す */
export function nDaysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

/** 今週月曜の YYYY-MM-DD を返す */
export function weekStartStr() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().split('T')[0]
}

/** YYYY-MM-DD → "4月3日（木）" */
export function formatDateJP(str) {
  const [y, m, d] = str.split('-')
  const dt = new Date(+y, +m - 1, +d)
  return `${+m}月${+d}日（${DAYS_JP[dt.getDay()]}）`
}

/** YYYY-MM-DD → "4/3" */
export function formatShort(str) {
  const [, m, d] = str.split('-')
  return `${+m}/${+d}`
}

/** 直近 n 日分の日付配列を返す（古い順） */
export function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

/** 時間帯でのあいさつ */
export function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'おはよう！'
  if (h < 17) return 'こんにちは！'
  return 'おつかれさま！'
}
