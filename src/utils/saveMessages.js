/**
 * 保存完了時のメッセージ生成
 * 気分・記入内容・状況に応じたランダム応援メッセージ
 */

const MOOD_MESSAGES = {
  best: [
    '最高の日だったね！その気持ち、大事にしよう！',
    'キラキラしてる！明日もいい日になりそう！',
    'ノッてるね！この調子でいこう！',
    'その最高の気分、忘れないようにしよう！',
  ],
  good: [
    'いい感じだね！コツコツ続けてるのがすごい。',
    'いい1日だったね！明日もがんばろう。',
    'その調子！毎日のふりかえりが力になるよ。',
    '安定していい感じ。それって実力だよ！',
  ],
  frustrate: [
    'くやしいって思えるのは、本気の証拠だよ！',
    'くやしさをバネにできる人は強くなる！',
    'くやしい日も書けたのがえらい！次はきっとうまくいく。',
    'その悔しさが、明日のエネルギーになるよ。',
  ],
  tired: [
    'つかれてるのに書けたのがえらい！ゆっくり休もうね。',
    'がんばった証拠だよ。しっかり休んで明日に備えよう！',
    '今日はおつかれさま。体を休めるのも大事な練習だよ。',
    'つかれた日に振り返れる君はすごいよ。おやすみ！',
  ],
  moody: [
    'モヤモヤを言葉にできたのがすごい！それだけで一歩前進。',
    'モヤモヤしてても書けたね。えらいよ！',
    '気持ちを整理できたね。明日はきっとスッキリするよ！',
    'モヤモヤは成長のサイン。大丈夫、前に進んでるよ。',
  ],
}

const CONTENT_MESSAGES = {
  allFilled: [
    '全部書けたね！最高のふりかえりだ！',
    'しっかり振り返れたね。これが成長の第一歩！',
    'すごい！4つとも考えて書けてるね！',
    'パーフェクト！考える力がついてきてる！',
  ],
  hasGoalAndPlay: [
    '100点プレーも目標もあるね！完璧！',
    'いいプレーを見つけて、次の目標も立てた。すばらしい！',
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
    '100点プレー、覚えておこうね！自信になるよ。',
    'いいプレーを見つけられる目がすごい！',
  ],
  minimal: [
    '書けただけですごい！続けることが一番大事！',
    '今日も記録できたね！えらい！',
    'ナイスふりかえり！明日もやってみよう！',
    '一行でもOK！続けてるのがかっこいい。',
    'ちゃんと向き合えたね。それだけで十分！',
  ],
}

/**
 * 気分と記入内容をもとに保存メッセージを返す
 * @param {string} mood - 気分キー
 * @param {{ myPlay: string, concern: string, nextGoal: string }} content
 * @returns {string}
 */
export function getSaveMessage(mood, content) {
  const { myPlay, concern, nextGoal } = content || {}
  const candidates = []

  // 気分メッセージ
  if (mood && MOOD_MESSAGES[mood]) {
    candidates.push(...MOOD_MESSAGES[mood])
  }

  // 内容ベース
  const filled = [myPlay, concern, nextGoal].filter(Boolean).length
  if (filled === 3) {
    candidates.push(...CONTENT_MESSAGES.allFilled)
  } else if (myPlay && nextGoal) {
    candidates.push(...CONTENT_MESSAGES.hasGoalAndPlay)
  } else if (nextGoal) {
    candidates.push(...CONTENT_MESSAGES.hasGoal)
  } else if (concern) {
    candidates.push(...CONTENT_MESSAGES.hasConcern)
  } else if (myPlay) {
    candidates.push(...CONTENT_MESSAGES.hasPlay)
  }

  // フォールバック
  if (candidates.length === 0) {
    candidates.push(...CONTENT_MESSAGES.minimal)
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}
