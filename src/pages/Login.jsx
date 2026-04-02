import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const TEAM_CODE = 'team001' // チームコード（固定 or 変更可）

export default function Login() {
  const { login, registerChild, registerParent } = useAuth()
  const [tab, setTab] = useState('login')         // 'login' | 'register'
  const [role, setRole] = useState('child')        // 'child' | 'parent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [childUid, setChildUid] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        if (!nickname.trim()) {
          setError('ニックネームを入れてください')
          return
        }
        if (role === 'child') {
          await registerChild({ email, password, nickname, teamCode: TEAM_CODE })
        } else {
          await registerParent({ email, password, nickname, childUid })
        }
      }
    } catch (err) {
      const msg = {
        'auth/email-already-in-use': 'このメールはすでに使われています',
        'auth/invalid-email': 'メールアドレスが正しくありません',
        'auth/weak-password': 'パスワードは6文字以上にしてください',
        'auth/user-not-found': 'このメールは登録されていません',
        'auth/wrong-password': 'パスワードが違います',
        'auth/invalid-credential': 'メールまたはパスワードが違います',
      }[err.code] || 'エラーが発生しました。もう一度試してください'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      {/* ロゴ */}
      <div className="login-logo">
        <span className="logo-icon">⚾</span>
        <h1>野球のびノート</h1>
        <p>毎日の練習を記録して、もっと強くなろう！</p>
      </div>

      {/* フォームカード */}
      <div className="login-form">
        {/* ログイン / 新規登録 タブ */}
        <div className="toggle-tabs">
          <button
            className={`toggle-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError('') }}
          >
            ログイン
          </button>
          <button
            className={`toggle-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError('') }}
          >
            新規登録
          </button>
        </div>

        {/* 新規登録時：役割選択 */}
        {tab === 'register' && (
          <div className="toggle-tabs" style={{ marginBottom: 16 }}>
            <button
              className={`toggle-tab ${role === 'child' ? 'active' : ''}`}
              onClick={() => setRole('child')}
            >
              ⚾ 子ども
            </button>
            <button
              className={`toggle-tab ${role === 'parent' ? 'active' : ''}`}
              onClick={() => setRole('parent')}
            >
              👨‍👩‍👦 保護者
            </button>
          </div>
        )}

        {error && <p className="error-msg">⚠️ {error}</p>}

        <form onSubmit={handleSubmit}>
          {/* ニックネーム（新規登録のみ） */}
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">
                {role === 'child' ? '⚾ ニックネーム（チームで使う名前）' : '👤 お名前'}
              </label>
              <input
                className="form-input"
                type="text"
                placeholder={role === 'child' ? '例：たろう、エース4番' : '例：山田 花子'}
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
                maxLength={20}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">📧 メールアドレス</label>
            <input
              className="form-input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">🔑 パスワード（6文字以上）</label>
            <input
              className="form-input"
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {/* 親登録時：子どものUID入力 */}
          {tab === 'register' && role === 'parent' && (
            <div className="form-group">
              <label className="form-label">
                👦 子どものユーザーID（設定画面で確認できます）
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="子どものユーザーID"
                value={childUid}
                onChange={e => setChildUid(e.target.value)}
              />
              <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                ※ 後から設定画面でも入力できます
              </p>
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? '処理中...' : tab === 'login' ? '⚾ ログイン' : '✅ 登録する'}
          </button>
        </form>
      </div>
    </div>
  )
}
