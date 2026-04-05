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
import { useToast } from '../contexts/ToastContext'

export default function WeeklyGoal() {
  const { user, profile, isTrial } = useAuth()
  const { showToast } = useToast()
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
    if (!goalText.trim()) { showToast('もくひょうを書いてね！', 'warning'); return }
    setSaving(true)
    try {
      const data = { goalText: goalText.trim(), achievement, reflection: reflection.trim() }
      if (isTrial) {
        saveLocalWeeklyGoal(data)
      } else if (user) {
        const docId = `${user.uid}_${ws}`
        await setDoc(doc(db, 'weeklyGoals', docId), {
          uid: user.uid,
          nickname: profile?.nickname || '',
          teamCode: profile?.teamCode || 'default',
          weekStart: ws, ...data,
          updatedAt: serverTimestamp(),
          ...(!isExisting ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true })
      }
      setIsExisting(true)
      setShowSuccess(true)
    } catch (e) { console.error(e); showToast('保存できませんでした', 'error') }
    finally { setSaving(false) }
  }

  const [wy, wm, wd] = ws.split('-')
  const weekEnd = new Date(+wy, +wm - 1, +wd)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
  const dayOfWeek = new Date().getDay()
  const isWeekEnd = dayOfWeek === 0 || dayOfWeek === 6

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 className="page-title">🎯 今週のもくひょう</h2>
      <p className="page-subtitle">{formatDateJP(ws)} 〜 {formatDateJP(weekEndStr)}</p>

      {/* 目標設定 */}
      <div className="card">
        <div className="card-title">📝 今週がんばること</div>
        <p className="text-sm text-muted mb-md">自分で決めた目標に向かって、1週間がんばろう！</p>

        {/* テンプレートから選ぶ */}
        {!goalText && (
          <>
            <p className="text-xs font-bold mb-sm">えらんでもOK👇</p>
            <div className="chip-grid mb-md">
              {GOAL_TEMPLATES.map((t, i) => (
                <button key={i}
                  className="chip"
                  onClick={() => setGoalText(t.text)}>
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
        <p className="form-hint text-right">{goalText.length}/200</p>
      </div>

      {/* 週末ふりかえり */}
      {isExisting && (
        <div className={`card ${isWeekEnd ? 'card-warning' : ''}`}>
          <div className="card-title">
            {isWeekEnd ? '🌟 週末ふりかえりタイム！' : '📊 ふりかえり（週末に書こう）'}
          </div>

          {isWeekEnd && (
            <p className="text-sm font-bold mb-md" style={{ color: 'var(--accent-dark)' }}>
              今週の目標、どれくらいできたかな？
            </p>
          )}

          <div className="form-group">
            <label className="form-label">どれくらいできた？</label>
            <div className="chip-grid">
              {ACHIEVEMENT_LEVELS.map(a => (
                <button key={a.value}
                  onClick={() => setAchievement(a.value)}
                  className={`chip ${achievement === a.value ? 'selected' : ''}`}
                  style={{
                    borderColor: achievement === a.value ? a.color : undefined,
                    background: achievement === a.value ? `${a.color}15` : undefined,
                    color: achievement === a.value ? 'var(--text-1)' : undefined,
                  }}>
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>
          </div>

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

      {/* 保存 */}
      <button className="btn btn-success btn-lg mb-sm" onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : isExisting ? '✏️ 更新する' : '✅ もくひょうを決める！'}
      </button>

      <button className="btn btn-outline" onClick={() => navigate('/')}>
        🏠 ホームに戻る
      </button>

      {/* 説明 */}
      <div className="card card-highlight mt-lg">
        <div className="card-title">💡 なんで目標を立てるの？</div>
        <ul style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.8, paddingLeft: 20 }}>
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
