import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome({ initialView = 'main' }) {
  const { startTrial, login, registerChild, registerParent, resetPassword } = useAuth()
  const [view, setView] = useState(initialView)
  const [role, setRole] = useState('child')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // リセット画面専用の state（ログイン欄の email を引き継げるよう分離）
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

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
        await registerParent({ email, password, nickname: nickname.trim(), inviteCode: inviteCode.trim() })
      }
    } catch (err) {
      setError(authErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetEmail.trim()) { setError('メールアドレスを入力してください'); return }
    setError(''); setLoading(true)
    try {
      await resetPassword(resetEmail.trim())
      setResetSent(true)
    } catch (err) {
      setError(authErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  // ログイン画面 → リセット画面（入力済みメールを引き継ぐ）
  const goToReset = () => {
    setResetEmail(email)
    setError('')
    setResetSent(false)
    setView('reset')
  }

  // ===== メイン画面 =====
  if (view === 'main') {
    return (
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>野球のびノート</h1>
          <p style={{ lineHeight: 1.7, fontSize: '0.88rem', color: 'var(--text-2)' }}>
            毎日のふりかえりで成長できる野球ノート
          </p>
        </div>

        <div className="welcome-form" style={{ textAlign: 'center' }}>
          <p className="text-xs text-hint mb-md">すでにアカウントがある場合</p>
          <button className="btn btn-primary mb-md" onClick={() => { setView('login'); setError('') }}>
            ログイン
          </button>

          <button className="btn btn-outline btn-sm mb-md" onClick={() => { setView('register'); setError('') }}>
            アカウント作成
          </button>

          <div className="divider" />

          <p className="text-xs text-hint" style={{ marginBottom: 'var(--sp-sm)', lineHeight: 1.6 }}>
            登録なしで今すぐ使えます
          </p>
          <button className="btn btn-ghost btn-sm mb-md" onClick={() => setView('trial')}>
            ⚾ おためしスタート
          </button>

          <p style={{
            fontSize: '0.74rem', color: 'var(--text-4)',
            marginTop: 4, marginBottom: 12, lineHeight: 1.5,
          }}>
            このアプリはすべて無料で使えます。課金要素はありません。
          </p>

          <button
            onClick={() => setShowDetail(!showDetail)}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4,
              padding: '6px 0',
            }}
          >
            {showDetail ? '▲ 説明を閉じる' : '▼ このアプリについて'}
          </button>

          {showDetail && (
            <div style={{
              textAlign: 'left', padding: '14px 16px',
              background: 'var(--surface)', borderRadius: 'var(--r-md)',
              marginTop: 8, fontSize: '0.82rem',
              color: 'var(--text-1)', lineHeight: 1.8,
            }}>
              <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-dark)' }}>
                こんなお子さんにぴったり！
              </p>
              <p>⭐ 良いプレーを自分で見つけられるようになる</p>
              <p>💭 悩みを言葉にする力がつく</p>
              <p>🎯 自分で目標を立てて行動できるようになる</p>
            </div>
          )}
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
              <label className="form-label" htmlFor="login-email">メールアドレス</label>
              <input id="login-email" className="form-input" type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">パスワード</label>
              <input id="login-password" className="form-input" type="password" placeholder="6文字以上"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? '処理中...' : 'ログイン'}
            </button>
          </form>

          {/* パスワード忘れ → リセット画面へ（入力済みメールをそのまま引き継ぐ） */}
          <button
            className="btn btn-ghost btn-sm mt-sm"
            onClick={goToReset}
            disabled={loading}
            style={{ fontSize: '0.82rem' }}
          >
            パスワードを忘れた方はこちら
          </button>

          <button className="btn btn-ghost btn-sm mt-md"
            onClick={() => { setView('main'); setError('') }}>
            ← もどる
          </button>
        </div>
      </div>
    )
  }

  // ===== パスワード再設定 =====
  if (view === 'reset') {
    return (
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>パスワードの再設定</h1>
        </div>
        <div className="welcome-form">
          {!resetSent ? (
            <>
              <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 'var(--sp-md)', color: 'var(--text-2)' }}>
                登録したメールアドレスを入力してください。<br />
                パスワードを再設定するためのリンクをお送りします。
              </p>
              {error && <p className="error-msg">{error}</p>}
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">メールアドレス</label>
                  <input
                    id="reset-email"
                    className="form-input"
                    type="email"
                    placeholder="example@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    autoFocus={!resetEmail}
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? '送信中...' : '再設定メールを送る'}
                </button>
              </form>
            </>
          ) : (
            /* 送信完了 */
            <>
              <div style={{
                padding: '14px 16px', background: 'var(--success-bg)',
                borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-md)', lineHeight: 1.8,
              }}>
                <p style={{ fontWeight: 700, color: 'var(--success-dark)', marginBottom: 4 }}>
                  ✅ メールを送りました
                </p>
                <p className="text-sm" style={{ color: 'var(--success-dark)' }}>
                  <strong>{resetEmail}</strong> 宛てに再設定用のリンクを送りました。
                </p>
              </div>
              <div style={{
                padding: '12px 14px', background: 'var(--surface)',
                borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-lg)',
                fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.9,
              }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>📬 メールが届かないときは</p>
                <p>・迷惑メールフォルダも確認してください</p>
                <p>・届くまで数分かかることがあります</p>
                <p>・メールアドレスを間違えた場合は下のボタンからやり直せます</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setResetSent(false); setError('') }}
              >
                別のメールアドレスで試す
              </button>
            </>
          )}

          <button
            className="btn btn-ghost btn-sm mt-md"
            onClick={() => { setView('login'); setError(''); setResetSent(false) }}
          >
            ← ログインに戻る
          </button>
        </div>
      </div>
    )
  }

  // ===== 新規登録 =====
  if (view === 'register') {
    return (
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">⚾</span>
          <h1>アカウント作成</h1>
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
              <label className="form-label" htmlFor="reg-nickname">
                {role === 'child' ? 'ニックネーム' : 'お名前'}
              </label>
              <input id="reg-nickname" className="form-input" type="text"
                placeholder={role === 'child' ? '例：たろう' : '例：山田花子'}
                value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={20} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">メールアドレス</label>
              <input id="reg-email" className="form-input" type="email" placeholder="example@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">パスワード</label>
              <input id="reg-password" className="form-input" type="password" placeholder="6文字以上"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              <p className="form-hint">覚えやすいパスワードでOK（6文字以上）</p>
            </div>
            {role === 'parent' && (
              <div className="form-group">
                <label className="form-label" htmlFor="reg-invitecode">子どもの招待コード</label>
                <input id="reg-invitecode" className="form-input" type="text"
                  placeholder="例：ABC123"
                  value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ letterSpacing: '0.15em', fontWeight: 700 }} />
                <p className="form-hint">子どもの設定画面に表示される6文字のコードです。あとから設定画面でも入力できます。</p>
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? '処理中...' : 'アカウントを作成する'}
            </button>
          </form>

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

  // ===== おためし入力 =====
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
          <label className="form-label" htmlFor="trial-nickname">ニックネーム</label>
          <input
            id="trial-nickname"
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

function authErrorMsg(code) {
  const map = {
    'auth/email-already-in-use': 'このメールはすでに使われています',
    'auth/invalid-email': 'メールアドレスが正しくありません',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/user-not-found': 'メールまたはパスワードがちがいます',
    'auth/wrong-password': 'メールまたはパスワードがちがいます',
    'auth/invalid-credential': 'メールまたはパスワードがちがいます',
  }
  return map[code] || 'エラーが起きました。もう一度ためしてください。'
}
