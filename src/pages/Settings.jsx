import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { clearAllLocal } from '../utils/localStore'

export default function Settings() {
  const { user, profile, isTrial, isRegistered, logout, updateProfileState } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [childUid, setChildUid] = useState(profile?.childUid || '')
  const [teamCode, setTeamCode] = useState(profile?.teamCode || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  async function handleSaveChildUid() {
    if (!user) return
    setSaving(true)
    try {
      const trimmed = childUid.trim()
      await updateDoc(doc(db, 'users', user.uid), { childUid: trimmed })
      if (trimmed) {
        await setDoc(doc(db, 'parentChildLinks', `${user.uid}_${trimmed}`), {
          parentUid: user.uid, childUid: trimmed, createdAt: serverTimestamp(),
        })
      }
      updateProfileState({ childUid: trimmed })
      setSaved('childUid')
      setTimeout(() => setSaved(''), 2000)
    } catch (e) { console.error(e); showToast('保存できませんでした', 'error') }
    finally { setSaving(false) }
  }

  async function handleSaveTeamCode() {
    if (!user) return
    setSaving(true)
    try {
      const newCode = teamCode.trim() || 'default'
      await updateDoc(doc(db, 'users', user.uid), { teamCode: newCode })
      updateProfileState({ teamCode: newCode })
      setSaved('teamCode')
      setTimeout(() => setSaved(''), 2000)
    } catch (e) { console.error(e); showToast('保存できませんでした', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <h2 className="page-title">⚙️ 設定</h2>

      {/* おためし中 → 登録をうながす */}
      {isTrial && (
        <div className="card card-warning">
          <div className="card-title" style={{ color: 'var(--accent-dark)' }}>📌 おためしモード中</div>
          <p className="text-sm mb-md" style={{ color: 'var(--accent-dark)', lineHeight: 1.6 }}>
            今のデータはこの端末だけに保存されています。<br />
            アカウント登録すると、<strong>クラウド保存・チームランキング・親閲覧</strong>が使えます。<br />
            おためし中のデータはそのまま引き継がれます！
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/welcome')}>
            アカウント登録する
          </button>
        </div>
      )}

      {/* アカウント情報 */}
      <div className="settings-group">
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <span className="text-sm font-bold">👤 アカウント情報</span>
        </div>
        <SettingsRow label="ニックネーム" value={profile?.nickname || '未設定'} />
        <SettingsRow label="モード" value={isTrial ? '📌 おためし' : '☁️ クラウド保存'} />
        {isRegistered && <SettingsRow label="メール" value={user?.email || ''} />}
        <SettingsRow label="役割"
          value={profile?.role === 'child' ? '⚾ 選手' : profile?.role === 'parent' ? '👨‍👩‍👦 保護者' : '未設定'} />
        {profile?.role === 'child' && (
          <SettingsRow label="チームコード" value={profile?.teamCode || 'なし'} />
        )}
      </div>

      {/* 子ども：自分のユーザーID */}
      {isRegistered && profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">🆔 自分のユーザーID</div>
          <p className="text-sm text-muted mb-sm">
            親にこのIDを教えると、記録を見てもらえます。
          </p>
          <div style={{
            background: 'var(--border-light)', border: '2px dashed var(--border)',
            borderRadius: 'var(--r-sm)', padding: '12px 16px',
            fontWeight: 700, fontSize: '0.82rem',
            wordBreak: 'break-all', color: 'var(--text-1)',
          }}>
            {user?.uid}
          </div>
          <button className="btn btn-outline btn-sm mt-sm" style={{ width: 'auto' }}
            onClick={() => { navigator.clipboard.writeText(user?.uid || ''); showToast('コピーしました！', 'success') }}>
            📋 コピーする
          </button>
        </div>
      )}

      {/* 子ども：チームコード変更 */}
      {isRegistered && profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">🏟️ チームコード変更</div>
          <p className="text-sm text-muted mb-sm">
            同じチームコードの仲間とランキングで競えるよ。
          </p>
          <div className="form-group">
            <input className="form-input" type="text" placeholder="例：tigers2024"
              value={teamCode} onChange={e => setTeamCode(e.target.value)} />
          </div>
          {saved === 'teamCode' && <p className="text-sm text-success font-bold mb-sm">✅ 保存しました！</p>}
          <button className="btn btn-primary" onClick={handleSaveTeamCode} disabled={saving}>
            保存する
          </button>
        </div>
      )}

      {/* 親：子どもUID設定 */}
      {isRegistered && profile?.role === 'parent' && (
        <div className="card">
          <div className="card-title">👦 子どものユーザーID</div>
          <p className="text-sm text-muted mb-sm">
            子どもの設定画面に表示されているIDを入力してください。
          </p>
          <div className="form-group">
            <input className="form-input" type="text" placeholder="子どものユーザーID"
              value={childUid} onChange={e => setChildUid(e.target.value)} />
          </div>
          {saved === 'childUid' && <p className="text-sm text-success font-bold mb-sm">✅ 保存しました！</p>}
          <button className="btn btn-primary" onClick={handleSaveChildUid} disabled={saving}>
            保存する
          </button>
        </div>
      )}

      {/* ログアウト */}
      {isRegistered && (
        <div className="card">
          <button className="btn btn-danger" onClick={logout}>ログアウト</button>
        </div>
      )}

      {/* おためし：データ削除 */}
      {isTrial && (
        <div className="card">
          <div className="card-title">🗑️ おためしデータを消す</div>
          <p className="text-sm text-muted mb-sm">
            この端末のおためしデータをすべて消して、最初の画面に戻ります。
          </p>
          <button className="btn btn-danger" onClick={() => {
            if (window.confirm('本当にデータを全部消しますか？元に戻せません。')) {
              clearAllLocal()
              window.location.reload()
            }
          }}>
            データを消して最初に戻る
          </button>
        </div>
      )}

      {/* アプリ情報 */}
      <div className="card text-center" style={{ marginTop: 8 }}>
        <p style={{ fontSize: '1.3rem', marginBottom: 4 }}>⚾</p>
        <p className="font-extrabold">野球のびノート</p>
        <p className="text-sm text-muted mt-sm">少年野球チームの成長記録アプリ</p>
        <p className="text-xs" style={{ color: 'var(--text-4)', marginTop: 8 }}>v3.0.0</p>
      </div>
    </div>
  )
}

function SettingsRow({ label, value }) {
  return (
    <div className="settings-item">
      <span className="settings-label">{label}</span>
      <span className="settings-value">{value}</span>
    </div>
  )
}
