import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome() {
  const { startTrial, login, registerChild, registerParent } = useAuth()
  const [view, setView] = useState('main') // 'main' | 'trial' | 'login' | 'register'
  const [role, setRole] = useState('child')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [childUid, setChildUid] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // おためしスタート
  const handleTrial = () => {
    if (!nickname.trim()) { setError('ニックネームを入れてね！'); return }
    startTrial(nickname.trim())
  }

  // ログイン
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(authErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  // 新規登録
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!nickname.trim()) { setError('ニックネームを入れてね！'); return }
    setError(''); setLoading(true)
    try {
      if (role === 'child') {
        await registerChild({ email, password, nickname: nickname.trim(), teamCode: teamCode.trim() || 'default' })
      } else {
        await registerParent({ email, password, nickname: nickname.trim(), childUid: childUid.trim() })
      }
    } catch (err) {
      setError(authErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  // ===== メイン画面 =====
  if (view === 'main') {
    return (
      <div className="login-screen">
        <div className="login-logo">
          <span className="logo-icon">⚾</span>
          <h1>野球のびノート</h1>
          <p>毎日の練習を記録して、もっと強くなろう！</p>
        </div>

        <div className="login-form" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20, lineHeight: 1.7 }}>
            登録なしで、今すぐ使えます。<br />
            続けたくなったら、あとから登録できるよ！
          </p>

          <button
            className="btn btn-success"
            style={{ fontSize: '1.15rem', marginBottom: 12 }}
            onClick={() => setView('trial')}
          >
            ⚾ おためしスタート
          </button>

          <div className="section-divider" style={{ margin: '16px 0' }} />

          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: 10 }}>
            すでにアカウントがある場合
          </p>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginBottom: 8 }}
            onClick={() => { setView('login'); setError('') }}
          >
            ログイン
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setView('register'); setError('') }}
          >
            新規登録（クラウド保存したい人）
          </button>
        </div>
      </div>
    )
  }

  // ===== おためし入力 =====
  if (view === 'trial') {
    return (
      <div className="login-screen">
        <div className="login-logo">
          <span className="logo-icon">⚾</span>
          <h1>おためしモード</h1>
          <p>登録なしで今すぐ使えるよ！</p>
        </div>
        <div className="login-form">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
            まずニックネームを決めよう
          </h2>
          {error && <p className="error-msg">⚠️ {error}</p>}
          <div className="form-group">
            <label className="form-label">⚾ ニックネーム</label>
            <input
              className="form-input"
              type="text"
              placeholder="例：たろう、エース4番"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          <button className="btn btn-success" style={{ fontSize: '1.1rem' }} onClick={handleTrial}>
            ⚾ はじめる！
          </button>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
            ※ おためし中のデータはこの端末にだけ保存されます。<br />
            あとからアカウント登録すると、クラウドに引き継げます。
          </p>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => { setView('main'); setError('') }}
          >
            ← もどる
          </button>
        </div>
      </div>
    )
  }

  // ===== ログイン =====
  if (view === 'login') {
    return (
      <div className="login-screen">
        <div className="login-logo">
          <span className="logo-icon">⚾</span>
          <h1>野球のびノート</h1>
        </div>
        <div className="login-form">
          <h2>ログイン</h2>
          {error && <p className="error-msg">⚠️ {error}</p>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">📧 メールアドレス</label>
              <input className="form-input" type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">🔑 パスワード</label>
              <input className="form-input" type="password" placeholder="6文字以上"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? '処理中...' : '⚾ ログイン'}
            </button>
          </form>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}
            onClick={() => { setView('main'); setError('') }}>
            ← もどる
          </button>
        </div>
      </div>
    )
  }

  // ===== 新規登録 =====
  return (
    <div className="login-screen">
      <div className="login-logo">
        <span className="logo-icon">⚾</span>
        <h1>アカウント登録</h1>
      </div>
      <div className="login-form">
        <div className="toggle-tabs" style={{ marginBottom: 16 }}>
          <button className={`toggle-tab ${role === 'child' ? 'active' : ''}`}
            onClick={() => setRole('child')}>⚾ 子ども</button>
          <button className={`toggle-tab ${role === 'parent' ? 'active' : ''}`}
            onClick={() => setRole('parent')}>👨‍👩‍👦 保護者</button>
        </div>
        {error && <p className="error-msg">⚠️ {error}</p>}
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">
              {role === 'child' ? '⚾ ニックネーム' : '👤 お名前'}
            </label>
            <input className="form-input" type="text"
              placeholder={role === 'child' ? '例：たろう' : '例：山田花子'}
              value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={20} />
          </div>
          <div className="form-group">
            <label className="form-label">📧 メールアドレス</label>
            <input className="form-input" type="email" placeholder="example@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">🔑 パスワード（6文字以上）</label>
            <input className="form-input" type="password" placeholder="パスワード"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {role === 'child' && (
            <div className="form-group">
              <label className="form-label">🏟️ チームコード（チームで共通）</label>
              <input className="form-input" type="text" placeholder="例：tigers2024"
                value={teamCode} onChange={e => setTeamCode(e.target.value)} />
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                ※ 空欄でもOK。あとから設定画面で変えられます。
              </p>
            </div>
          )}
          {role === 'parent' && (
            <div className="form-group">
              <label className="form-label">👦 子どものユーザーID</label>
              <input className="form-input" type="text" placeholder="子どもの設定画面で確認"
                value={childUid} onChange={e => setChildUid(e.target.value)} />
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                ※ あとから設定画面でも入力できます。
              </p>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '処理中...' : '✅ 登録する'}
          </button>
        </form>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}
          onClick={() => { setView('main'); setError('') }}>
          ← もどる
        </button>
      </div>
    </div>
  )
}

function authErrorMsg(code) {
  const map = {
    'auth/email-already-in-use': 'このメールはすでに使われています',
    'auth/invalid-email': 'メールアドレスが正しくありません',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/user-not-found': 'このメールは登録されていません',
    'auth/wrong-password': 'パスワードがちがいます',
    'auth/invalid-credential': 'メールまたはパスワードがちがいます',
  }
  return map[code] || 'エラーが起きました。もう一度ためしてください。'
}
