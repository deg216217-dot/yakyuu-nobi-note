import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { weekStartStr, formatDateJP, todayStr } from '../utils/dateUtils'
import {
  getLocalCurrentWeekGoal, saveLocalWeeklyGoal,
  GOAL_TEMPLATES, ACHIEVEMENT_LEVELS,
} from '../utils/weeklyGoal'
import SuccessOverlay from '../components/SuccessOverlay'

export default function WeeklyGoal() {
  const { user, profile, isTrial } = useAuth()
  const navigate = useNavigate()
  const ws = weekStartStr()

  const [goalText, setGoalText] = useState('')
  const [achievement, setAchievement] = useState('')
  const [reflection, setReflection] = useState('')
  const [isExisting, setIsExisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadGoal() }, [user, isTrial])

  async function loadGoal() {
    try {
      if (isTrial) {
        const g = getLocalCurrentWeekGoal()
        if (g) {
          setGoalText(g.goalText || '')
          setAchievement(g.achievement || '')
          setReflection(g.reflection || '')
          setIsExisting(true)
        }
      } else if (user) {
        const docId = `${user.uid}_${ws}`
        const snap = await getDoc(doc(db, 'weeklyGoals', docId))
        if (snap.exists()) {
          const d = snap.data()
          setGoalText(d.goalText || '')
          setAchievement(d.achievement || '')
          setReflection(d.reflection || '')
          setIsExisting(true)
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!goalText.trim()) { alert('もくひょうを書いてね！'); return }
    setSaving(true)
    try {
      const data = {
        goalText: goalText.trim(),
        achievement,
        reflection: reflection.trim(),
      }
      if (isTrial) {
        saveLocalWeeklyGoal(data)
      } else if (user) {
        const docId = `${user.uid}_${ws}`
        await setDoc(doc(db, 'weeklyGoals', docId), {
          uid: user.uid,
          nickname: profile?.nickname || '',
          teamCode: profile?.teamCode || 'default',
          weekStart: ws,
          ...data,
          updatedAt: serverTimestamp(),
          ...(!isExisting ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true })
      }
      setIsExisting(true)
      setShowSuccess(true)
    } catch (e) { console.error(e); alert('保存できませんでした') }
    finally { setSaving(false) }
  }

  // 今週の月曜と日曜
  const weekEnd = new Date(ws)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  const today = todayStr()
  const dayOfWeek = new Date().getDay()
  const isWeekEnd = dayOfWeek === 0 || dayOfWeek === 6 // 土日 = ふりかえりタイム

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>
    <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
  </div>

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 4 }}>
        🎯 今週のもくひょう
      </h2>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
        {formatDateJP(ws)} 〜 {formatDateJP(weekEndStr)}
      </p>

      {/* 目標設定 */}
      <div className="card">
        <div className="card-title">📝 今週がんばること</div>
        <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 12 }}>
          自分で決めた目標に向かって、1週間がんばろう！
        </p>

        {/* テンプレートから選ぶ */}
        {!goalText && (
          <>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
              えらんでもOK👇
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {GOAL_TEMPLATES.map((t, i) => (
                <button key={i}
                  onClick={() => setGoalText(t.text)}
                  style={{
                    padding: '8px 12px', borderRadius: 20,
                    border: '2px solid #e5e7eb', background: '#fff',
                    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', color: '#374151',
                  }}>
                  {t.icon} {t.text}
                </button>
              ))}
            </div>
          </>
        )}

        <textarea
          className="form-textarea"
          placeholder="例：毎日素振り50回する！"
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          maxLength={200}
          rows={2}
        />
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right' }}>{goalText.length}/200</p>
      </div>

      {/* 週末ふりかえり */}
      {isExisting && (
        <div className="card" style={{
          background: isWeekEnd ? '#fffbeb' : '#f9fafb',
          border: isWeekEnd ? '2px solid #f59e0b' : '1px solid #e5e7eb',
        }}>
          <div className="card-title">
            {isWeekEnd ? '🌟 週末ふりかえりタイム！' : '📊 ふりかえり（週末に書こう）'}
          </div>

          {isWeekEnd && (
            <p style={{ fontSize: '0.82rem', color: '#92400e', marginBottom: 12, fontWeight: 700 }}>
              今週の目標、どれくらいできたかな？
            </p>
          )}

          {/* 達成度セルフ評価 */}
          <div className="form-group">
            <label className="form-label">どれくらいできた？</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ACHIEVEMENT_LEVELS.map(a => (
                <button key={a.value}
                  onClick={() => setAchievement(a.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 12,
                    border: achievement === a.value ? `2px solid ${a.color}` : '2px solid #e5e7eb',
                    background: achievement === a.value ? `${a.color}15` : '#fff',
                    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', color: '#374151',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  <span style={{ fontSize: '1.1rem' }}>{a.emoji}</span> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* ふりかえりコメント */}
          <div className="form-group">
            <label className="form-label">ふりかえりメモ（自由）</label>
            <textarea
              className="form-textarea"
              placeholder="例：前半はがんばれたけど、後半サボっちゃった。来週は毎日やる！"
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              maxLength={300}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* 保存ボタン */}
      <button
        className="btn btn-success"
        onClick={handleSave}
        disabled={saving}
        style={{ fontSize: '1.1rem', marginBottom: 8 }}
      >
        {saving ? '保存中...' : isExisting ? '✏️ 更新する' : '✅ もくひょうを決める！'}
      </button>

      <button className="btn btn-outline" onClick={() => navigate('/')}>
        🏠 ホームに戻る
      </button>

      {/* なぜ目標を立てるのか（子ども向けの説明） */}
      <div className="card" style={{ background: '#f0f9ff', marginTop: 12 }}>
        <div className="card-title">💡 なんで目標を立てるの？</div>
        <ul style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>プロ野球選手もみんな目標を立ててるよ</li>
          <li>「何をがんばるか」が決まると、練習に集中できる</li>
          <li>達成できてもできなくても「ふりかえる」ことが大事</li>
          <li>毎週少しずつ、自分で考えて決められるようになろう</li>
        </ul>
      </div>

      {showSuccess && (
        <SuccessOverlay
          title={isExisting ? 'もくひょう更新！' : 'もくひょう決定！'}
          message="今週もがんばろう！"
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  )
}
