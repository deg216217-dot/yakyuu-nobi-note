import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome({ initialView = 'main' }) {
  const { startTrial, login, registerChild, registerParent } = useAuth()
  const [view, setView] = useState(initialView)
  const [role, setRole] = useState('child')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [childUid, setChildUid] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTrial = () => {
    if (!nickname.trim()) { setError('ニックネームを入れてね！'); return }
    startTrial(nickname.trim())
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(authErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!nickname.trim()) { setError('ニックネームを入れてね！'); return }
    setError(''); setLoading(true)
    try {
      if (role === 'child') {
        await registerChild({ email, password, nickname: nickname.trim() })
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
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>野球のびノート</h1>
          <p style={{ lineHeight: 1.7 }}>
            毎日1分のふりかえりで<br />
            「考える力」が育つ野球ノート
          </p>
        </div>

        <div className="welcome-form" style={{ textAlign: 'center' }}>
          {/* 3つのポイント */}
          <div style={{
            textAlign: 'left', padding: '14px 16px',
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            marginBottom: 'var(--sp-xl)', fontSize: '0.82rem',
            color: 'var(--text-1)', lineHeight: 1.8,
          }}>
            <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-dark)' }}>
              こんなお子さんにぴったり！
            </p>
            <p>⭐ 良いプレーを自分で見つけられるようになる</p>
            <p>💭 悩みを言葉にする力がつく</p>
            <p>🎯 自分で目標を立てて行動できるようになる</p>
          </div>

          <button className="btn btn-primary btn-lg mb-md" onClick={() => setView('trial')}>
            ⚾ 無料でおためしスタート
          </button>

          <p className="text-xs text-hint" style={{ marginBottom: 'var(--sp-xl)', lineHeight: 1.6 }}>
            登録なしで今すぐ使えます<br />
            続けたくなったら、あとから登録できるよ！
          </p>

          <div className="divider" />

          <p className="text-xs text-hint mb-md">すでにアカウントがある場合</p>
          <button className="btn btn-outline btn-sm mb-sm" onClick={() => { setView('login'); setError('') }}>
            ログイン
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setView('register'); setError('') }}>
            新規登録（クラウド保存したい人）
          </button>
        </div>
      </div>
    )
  }

  // ===== おためし入力 =====
  if (view === 'trial') {
    return (
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>おためしモード</h1>
          <p>登録なしで今すぐ使えるよ！</p>
        </div>
        <div className="welcome-form">
          <h2>まずニックネームを決めよう</h2>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-group">
            <label className="form-label">ニックネーム</label>
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
          <button className="btn btn-primary btn-lg" onClick={handleTrial}>
            はじめる！
          </button>
          <button className="btn btn-ghost btn-sm mt-sm" onClick={() => startTrial('せんしゅ')}>
            あとで決める →
          </button>
          <p className="text-xs text-hint text-center mt-md" style={{ lineHeight: 1.6 }}>
            おためし中のデータはこの端末にだけ保存されます。<br />
            あとからアカウント登録すると、クラウドに引き継げます。
          </p>
          <button className="btn btn-ghost btn-sm mt-md" onClick={() => { setView('main'); setError('') }}>
            ← もどる
          </button>
        </div>
      </div>
    )
  }

  // ===== ログイン =====
  if (view === 'login') {
    return (
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>野球のびノート</h1>
        </div>
        <div className="welcome-form">
          <h2>ログイン</h2>
          {error && <p className="error-msg">{error}</p>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input className="form-input" type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input className="form-input" type="password" placeholder="6文字以上"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? '処理中...' : 'ログイン'}
            </button>
          </form>
          <button className="btn btn-ghost btn-sm mt-md"
            onClick={() => { setView('main'); setError('') }}>
            ← もどる
          </button>
        </div>
      </div>
    )
  }

  // ===== 新規登録 =====
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <span className="logo-icon">⚾</span>
        <h1>アカウント登録</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          クラウド保存＆親の見守り機能が使えます
        </p>
      </div>
      <div className="welcome-form">
        <div className="segment-control" style={{ marginBottom: 20 }}>
          <button className={`segment-btn ${role === 'child' ? 'active' : ''}`}
            onClick={() => setRole('child')}>⚾ 子ども</button>
          <button className={`segment-btn ${role === 'parent' ? 'active' : ''}`}
            onClick={() => setRole('parent')}>👨‍👩‍👦 保護者</button>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">
              {role === 'child' ? 'ニックネーム' : 'お名前'}
            </label>
            <input className="form-input" type="text"
              placeholder={role === 'child' ? '例：たろう' : '例：山田花子'}
              value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={20} />
          </div>
          <div className="form-group">
            <label className="form-label">メールアドレス</label>
            <input className="form-input" type="email" placeholder="example@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">パスワード（6文字以上）</label>
            <input className="form-input" type="password" placeholder="パスワード"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {role === 'parent' && (
            <div className="form-group">
              <label className="form-label">子どものユーザーID</label>
              <input className="form-input" type="text" placeholder="子どもの設定画面で確認"
                value={childUid} onChange={e => setChildUid(e.target.value)} />
              <p className="form-hint">あとから設定画面でも入力できます。</p>
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '処理中...' : '登録する'}
          </button>
        </form>

        {/* おためし中のデータ引き継ぎ案内 */}
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'var(--success-bg)', borderRadius: 'var(--r-sm)',
          fontSize: '0.78rem', color: 'var(--success-dark)', lineHeight: 1.6,
        }}>
          ✅ おためし中の記録は、登録後にそのまま引き継がれます
        </div>

        <button className="btn btn-ghost btn-sm mt-md"
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
