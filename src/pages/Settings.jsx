import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { user, profile, logout } = useAuth()
  const [childUid, setChildUid] = useState(profile?.childUid || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveChildUid() {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { childUid: childUid.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
      alert('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        ⚙️ 設定
      </h2>

      {/* アカウント情報 */}
      <div className="card">
        <div className="card-title">👤 アカウント情報</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoRow label="ニックネーム" value={profile?.nickname || '未設定'} />
          <InfoRow label="メール" value={user?.email || ''} />
          <InfoRow
            label="役割"
            value={profile?.role === 'child' ? '⚾ 選手（子ども）' : profile?.role === 'parent' ? '👨‍👩‍👦 保護者' : '不明'}
          />
          {profile?.role === 'child' && (
            <InfoRow label="チームコード" value={profile?.teamCode || 'default'} />
          )}
        </div>
      </div>

      {/* 自分のユーザーID（子どもが親に教える用） */}
      {profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">🆔 自分のユーザーID</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
            親のアカウントに、このIDを入力してもらうと、記録を見てもらえます。
          </p>
          <div style={{
            background: '#f3f4f6',
            border: '2px dashed #d1d5db',
            borderRadius: 10,
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.9rem',
            wordBreak: 'break-all',
            color: '#374151',
            letterSpacing: '0.03em',
          }}>
            {user?.uid}
          </div>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 8, width: 'auto' }}
            onClick={() => {
              navigator.clipboard.writeText(user?.uid || '')
              alert('コピーしました！')
            }}
          >
            📋 コピーする
          </button>
        </div>
      )}

      {/* 親：子どものUID設定 */}
      {profile?.role === 'parent' && (
        <div className="card">
          <div className="card-title">👦 子どものユーザーIDを設定</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
            子どもの設定画面に表示されているIDを入力してください。
          </p>
          <div className="form-group">
            <input
              className="form-input"
              type="text"
              placeholder="子どものユーザーID"
              value={childUid}
              onChange={e => setChildUid(e.target.value)}
            />
          </div>
          {saved && (
            <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>
              ✅ 保存しました！
            </p>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSaveChildUid}
            disabled={saving}
          >
            {saving ? '保存中...' : '💾 保存する'}
          </button>
        </div>
      )}

      {/* ログアウト */}
      <div className="card">
        <div className="card-title">🚪 ログアウト</div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>
          アプリからログアウトします。
        </p>
        <button className="btn btn-danger" onClick={logout}>
          ログアウト
        </button>
      </div>

      {/* アプリについて */}
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: 4 }}>⚾</p>
        <p style={{ fontWeight: 900, color: '#1a3a5c' }}>野球のびノート</p>
        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
          少年野球チームのための成長記録アプリ
        </p>
        <p style={{ fontSize: '0.72rem', color: '#d1d5db', marginTop: 8 }}>v1.0.0</p>
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
