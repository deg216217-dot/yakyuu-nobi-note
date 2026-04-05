// ===== 日付ユーティリティ =====
// 【重要】すべてローカル時間（端末のタイムゾーン）基準で日付を生成する。
// toISOString() は UTC 基準のため、日本時間 0:00〜8:59 に前日扱いになるバグがあった。
// この修正により、深夜でも正しく「今日」が判定される。

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

/** Date オブジェクトからローカル時間の YYYY-MM-DD を返す（UTC変換しない） */
function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 今日を YYYY-MM-DD で返す（ローカル時間基準） */
export function todayStr() {
  return toLocalDateStr(new Date())
}

/** n日前を YYYY-MM-DD で返す（ローカル時間基準） */
export function nDaysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateStr(d)
}

/** 今週月曜の YYYY-MM-DD を返す（ローカル時間基準） */
export function weekStartStr() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  return toLocalDateStr(mon)
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

/** 直近 n 日分の日付配列を返す（古い順、ローカル時間基準） */
export function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return toLocalDateStr(d)
  })
}

/** 時間帯でのあいさつ */
export function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'おはよう！'
  if (h < 17) return 'こんにちは！'
  return 'おつかれさま！'
}

/** YYYY-MM-DD 文字列から1日前の YYYY-MM-DD を返す（ローカル時間基準） */
export function prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const dt = new Date(+y, +m - 1, +d)
  dt.setDate(dt.getDate() - 1)
  return toLocalDateStr(dt)
}
