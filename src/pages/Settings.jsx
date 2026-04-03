import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { user, profile, isTrial, isRegistered, logout } = useAuth()
  const navigate = useNavigate()

  const [childUid, setChildUid] = useState(profile?.childUid || '')
  const [teamCode, setTeamCode] = useState(profile?.teamCode || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  async function handleSaveChildUid() {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { childUid: childUid.trim() })
      if (childUid.trim()) {
        await setDoc(doc(db, 'parentChildLinks', `${user.uid}_${childUid.trim()}`), {
          parentUid: user.uid,
          childUid: childUid.trim(),
          createdAt: serverTimestamp(),
        })
      }
      setSaved('childUid')
      setTimeout(() => setSaved(''), 2000)
    } catch (e) { console.error(e); alert('保存できませんでした') }
    finally { setSaving(false) }
  }

  async function handleSaveTeamCode() {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { teamCode: teamCode.trim() || 'default' })
      setSaved('teamCode')
      setTimeout(() => setSaved(''), 2000)
    } catch (e) { console.error(e); alert('保存できませんでした') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        ⚙️ 設定
      </h2>

      {/* おためし中 → 登録をうながす */}
      {isTrial && (
        <div className="card" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}>
          <div className="card-title" style={{ color: '#92400e' }}>📌 おためしモード中</div>
          <p style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: 12, lineHeight: 1.6 }}>
            今のデータはこの端末だけに保存されています。<br />
            アカウント登録すると、<strong>クラウド保存・チームランキング・親閲覧</strong>が使えます。<br />
            おためし中のデータはそのまま引き継がれます！
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/welcome')}>
            ✅ アカウント登録する
          </button>
        </div>
      )}

      {/* アカウント情報 */}
      <div className="card">
        <div className="card-title">👤 アカウント情報</div>
        <InfoRow label="ニックネーム" value={profile?.nickname || '未設定'} />
        <InfoRow label="モード" value={isTrial ? '📌 おためし' : '☁️ クラウド保存'} />
        {isRegistered && <InfoRow label="メール" value={user?.email || ''} />}
        <InfoRow label="役割"
          value={profile?.role === 'child' ? '⚾ 選手' : profile?.role === 'parent' ? '👨‍👩‍👦 保護者' : '未設定'} />
        {profile?.role === 'child' && (
          <InfoRow label="チームコード" value={profile?.teamCode || 'なし'} />
        )}
      </div>

      {/* 子ども：自分のユーザーID */}
      {isRegistered && profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">🆔 自分のユーザーID</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
            親にこのIDを教えると、記録を見てもらえます。
          </p>
          <div style={{
            background: '#f3f4f6', border: '2px dashed #d1d5db', borderRadius: 10,
            padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem',
            wordBreak: 'break-all', color: '#374151',
          }}>
            {user?.uid}
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 8, width: 'auto' }}
            onClick={() => { navigator.clipboard.writeText(user?.uid || ''); alert('コピーしました！') }}>
            📋 コピーする
          </button>
        </div>
      )}

      {/* 子ども：チームコード変更 */}
      {isRegistered && profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">🏟️ チームコード変更</div>
          <div className="form-group">
            <input className="form-input" type="text" placeholder="例：tigers2024"
              value={teamCode} onChange={e => setTeamCode(e.target.value)} />
          </div>
          {saved === 'teamCode' && <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>✅ 保存しました！</p>}
          <button className="btn btn-primary" onClick={handleSaveTeamCode} disabled={saving}>
            💾 保存する
          </button>
        </div>
      )}

      {/* 親：子どもUID設定 */}
      {isRegistered && profile?.role === 'parent' && (
        <div className="card">
          <div className="card-title">👦 子どものユーザーID</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
            子どもの設定画面に表示されているIDを入力してください。
          </p>
          <div className="form-group">
            <input className="form-input" type="text" placeholder="子どものユーザーID"
              value={childUid} onChange={e => setChildUid(e.target.value)} />
          </div>
          {saved === 'childUid' && <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>✅ 保存しました！</p>}
          <button className="btn btn-primary" onClick={handleSaveChildUid} disabled={saving}>
            💾 保存する
          </button>
        </div>
      )}

      {/* ログアウト */}
      {isRegistered && (
        <div className="card">
          <div className="card-title">🚪 ログアウト</div>
          <button className="btn btn-danger" onClick={logout}>ログアウト</button>
        </div>
      )}

      {/* おためし：データ削除して最初に戻る */}
      {isTrial && (
        <div className="card">
          <div className="card-title">🗑️ おためしデータを消す</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
            この端末のおためしデータをすべて消して、最初の画面に戻ります。
          </p>
          <button className="btn btn-danger" onClick={() => {
            if (window.confirm('本当にデータを全部消しますか？元に戻せません。')) {
              localStorage.clear()
              window.location.reload()
            }
          }}>
            データを消して最初に戻る
          </button>
        </div>
      )}

      {/* アプリ情報 */}
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: 4 }}>⚾</p>
        <p style={{ fontWeight: 900, color: '#1a3a5c' }}>野球のびノート</p>
        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>少年野球チームの成長記録アプリ</p>
        <p style={{ fontSize: '0.72rem', color: '#d1d5db', marginTop: 8 }}>v2.0.0</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 700 }}>{value}</span>
    </div>
  )
}
