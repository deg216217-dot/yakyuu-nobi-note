// ===== 文脈に応じた応援メッセージシステム =====
// 根拠：即時フィードバック＋承認が内発的動機を高める（自己決定理論）
// 毎日同じメッセージでは飽きる → ランダム＋文脈対応

/** 記録完了時の応援（気分に応じて変える） */
const SAVE_MESSAGES = {
  best: [
    'その調子！最高の1日だったね！',
    '自信を持っていいよ。今日はキラキラだ！',
    '100点の気持ち、明日も続くといいね！',
  ],
  good: [
    'いい感じ！コツコツが一番強い。',
    '「まあまあ」も立派な1日だよ。',
    '毎日続けてるだけですごい。',
  ],
  frustrate: [
    'くやしいってことは、本気ってことだ。',
    'プロも毎日くやしい思いをしてる。大事な気持ちだよ。',
    'くやしさをバネにできる人は強くなる。',
  ],
  tired: [
    'おつかれさま！休むのも練習のうちだよ。',
    '疲れてるのに記録したの、えらい！',
    '体を休めて、明日また元気に！',
  ],
  moody: [
    'モヤモヤしてても、書き出すだけでスッキリするよ。',
    'こういう日もある。大丈夫。',
    '気持ちを言葉にできるのは、すごい力だよ。',
  ],
}

/** 保存完了時のメッセージをランダム取得 */
export function getSaveMessage(mood) {
  const msgs = SAVE_MESSAGES[mood] || SAVE_MESSAGES.good
  return msgs[Math.floor(Math.random() * msgs.length)]
}

/** ストリーク応援メッセージ */
export function getStreakMessage(streak) {
  if (streak >= 30) return { icon: '🏅', text: '30日の伝説！プロ級の継続力だ！' }
  if (streak >= 14) return { icon: '🥇', text: '2週間！もう立派な習慣だ！' }
  if (streak >= 7)  return { icon: '⭐', text: '1週間達成！この調子！' }
  if (streak >= 3)  return { icon: '🔥', text: 'いい感じ！3日坊主を超えたぞ！' }
  return null
}

/** 「昨日のモヤっと」に対するフォローアップ質問 */
export function getFollowUpQuestion(concern) {
  if (!concern) return null
  // 短縮表示（50文字以内）
  const short = concern.length > 50 ? concern.slice(0, 50) + '…' : concern
  return `前回「${short}」って書いたね。その後どうかな？`
}

// ===== 親向け「声かけヒント」 =====
// 根拠：「がんばれ」だけの声かけは逆効果になりうる（心理学研究）
// 子どもの具体的な行動や気持ちに基づく声かけが効果的

/**
 * 子どもの記録データから、親向けの声かけヒントを生成
 * @param {object} opts - { mood, myPlay, concern, nextGoal, streak, totalMinutes }
 */
export function getParentHints(opts) {
  const hints = []

  // 気分に応じたヒント
  if (opts.mood === 'frustrate') {
    hints.push({
      icon: '💬',
      hint: '「くやしい」と感じています。「何がくやしかった？」と聞いてあげると、言語化する力が育ちます。',
      avoid: '「気にするな」「大丈夫」と流さないでください。くやしさは成長のサインです。',
    })
  }
  if (opts.mood === 'moody') {
    hints.push({
      icon: '🤗',
      hint: '「モヤモヤ」しています。無理に聞き出さず「何かあったら話してね」くらいで見守ってください。',
      avoid: '「何があったの？」としつこく聞くと、アプリに書くこと自体を嫌がります。',
    })
  }
  if (opts.mood === 'tired') {
    hints.push({
      icon: '☕',
      hint: '疲れているようです。「今日も記録えらいね」と記録した事実をほめてあげてください。',
      avoid: '「疲れてるならもっと早く寝なさい」は逆効果です。',
    })
  }
  if (opts.mood === 'best') {
    hints.push({
      icon: '🎉',
      hint: '最高の気分です！「何が一番うれしかった？」と具体的に聞くと、成功体験が定着します。',
    })
  }

  // 100点プレーがあればほめるヒント
  if (opts.myPlay) {
    const short = opts.myPlay.length > 30 ? opts.myPlay.slice(0, 30) + '…' : opts.myPlay
    hints.push({
      icon: '⭐',
      hint: `「${short}」と書いています。この内容について「すごいね！」と声をかけてあげてください。`,
    })
  }

  // モヤっとがあれば
  if (opts.concern) {
    hints.push({
      icon: '💭',
      hint: '悩んでいることがあるようです。「どうしたらできるようになると思う？」と一緒に考えてみてください。',
      avoid: '「こうすればいい」と正解を教えるより、自分で考える時間をあげてください。',
    })
  }

  // 目標があれば
  if (opts.nextGoal) {
    const short = opts.nextGoal.length > 30 ? opts.nextGoal.slice(0, 30) + '…' : opts.nextGoal
    hints.push({
      icon: '🎯',
      hint: `次の目標に「${short}」を挙げています。数日後に「あの目標どう？」と聞いてあげると自己管理力が育ちます。`,
    })
  }

  // ストリーク
  if (opts.streak >= 7) {
    hints.push({
      icon: '🔥',
      hint: `${opts.streak}日連続で記録しています！「毎日続けてるね」と継続そのものをほめてください。結果より過程が大事です。`,
    })
  }

  // 何もなければデフォルト
  if (hints.length === 0) {
    hints.push({
      icon: '👀',
      hint: '今日は特別な変化はありません。「記録見たよ」と一言伝えるだけで、子どもは見守られていると感じます。',
    })
  }

  return hints
}

/** 練習バランスの分析コメント */
export function getBalanceComment(menuCounts) {
  const entries = Object.entries(menuCounts)
  if (entries.length === 0) return null
  if (entries.length === 1) return '1種類の練習に集中しています。他のメニューも試してみるとバランスが良くなります。'
  if (entries.length >= 5) return 'いろいろな練習をバランスよくやっています！すばらしい！'

  const sorted = entries.sort((a, b) => b[1] - a[1])
  const top = sorted[0][0]
  const LABELS = {
    swing: '素振り', tee: 'ティー', catch: 'キャッチボール',
    wall: '壁当て', ground: 'ゴロ捕球', fly: 'フライ捕球',
    dash: 'ダッシュ', core: '体幹', stretch: 'ストレッチ', other: 'その他',
  }
  return `${LABELS[top] || top}が多めです。守備・走塁・体づくりもバランスよく取り入れると成長が加速します。`
}
