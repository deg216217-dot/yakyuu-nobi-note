/**
 * 保存完了時のメッセージ生成
 * 気分と記録内容に応じて、ランダムかつ文脈に合った応援メッセージを返す
 */

// --- 気分別メッセージ ---
const MOOD_MESSAGES = {
  best: [
    '最高の日だったね！その気持ち、大事にしよう！',
    'キラキラしてる！明日もいい日になりそう！',
    'ノッてるね！この調子でいこう！',
  ],
  good: [
    'いい感じだね！コツコツ続けてるのがすごい！',
    'いい1日だったね！明日もがんばろう！',
    'その調子！毎日のふりかえりが力になるよ！',
  ],
  frustrate: [
    'くやしいって思えるのは、本気で頑張ってる証拠だよ！',
    'くやしさをバネにできる人は強くなる！',
    'くやしい日も書けたのがえらい！次はきっとうまくいくよ！',
  ],
  tired: [
    'つかれてるのに書けたのがえらい！ゆっくり休もうね。',
    'がんばった証拠だよ。しっかり休んで明日に備えよう！',
    '今日はおつかれさま！体を休めるのも大事な練習だよ。',
  ],
  moody: [
    'モヤモヤを言葉にできたのがすごい！それだけで一歩前進！',
    'モヤモヤしてても書けたね。えらいよ！',
    '気持ちを整理できたね。明日はきっとスッキリするよ！',
  ],
}

// --- 内容ベースメッセージ ---
const CONTENT_MESSAGES = {
  allFilled: [
    '全部書けたね！最高のふりかえりだ！',
    'しっかり振り返れたね！これが成長の第一歩！',
    'すごい！ちゃんと考えて書けてるね！',
  ],
  hasGoal: [
    '目標を決められるのがかっこいい！',
    '次のゴールがあると、練習が楽しくなるね！',
    '目標があるって最強だよ！',
  ],
  hasConcern: [
    'モヤっとを書き出せたね。それが成長の種だよ！',
    '悩めるってことは、ちゃんと考えてる証拠！',
  ],
  hasPlay: [
    '100点プレー、覚えておこうね！自信になるよ！',
    'いいプレーを見つけられる目がすごい！',
  ],
  minimal: [
    '書けただけですごい！続けることが一番大事！',
    '今日も記録できたね！えらい！',
    'ナイスふりかえり！明日もやってみよう！',
    '一行でもOK！続けてるのがかっこいい！',
  ],
}

/**
 * 気分と記入内容をもとに保存メッセージを返す
 * @param {string} mood - 気分キー ('best','good','frustrate','tired','moody','')
 * @param {{ myPlay: string, concern: string, nextGoal: string }} content
 * @returns {string}
 */
export function getSaveMessage(mood, content) {
  const { myPlay, concern, nextGoal } = content || {}
  const candidates = []

  // 気分メッセージがあれば候補に追加（優先度高め）
  if (mood && MOOD_MESSAGES[mood]) {
    candidates.push(...MOOD_MESSAGES[mood])
  }

  // 内容ベースのメッセージ
  const filled = [myPlay, concern, nextGoal].filter(Boolean).length
  if (filled === 3) {
    candidates.push(...CONTENT_MESSAGES.allFilled)
  } else if (nextGoal) {
    candidates.push(...CONTENT_MESSAGES.hasGoal)
  } else if (concern) {
    candidates.push(...CONTENT_MESSAGES.hasConcern)
  } else if (myPlay) {
    candidates.push(...CONTENT_MESSAGES.hasPlay)
  }

  // 最低限のフォールバック
  if (candidates.length === 0) {
    candidates.push(...CONTENT_MESSAGES.minimal)
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}
