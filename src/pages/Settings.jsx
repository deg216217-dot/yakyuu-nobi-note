import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  doc, updateDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { clearAllLocal } from '../utils/localStore'

/** 重複チェック付き招待コード生成（最大5回試行） */
async function generateUniqueInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const q = query(collection(db, 'users'), where('inviteCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) return code
  }
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** タイムアウト付きPromise（ms経過でreject） */
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  )
  return Promise.race([promise, timeout])
}

export default function Settings() {
  const { user, profile, isTrial, isRegistered, logout, updateProfileState, lookupChildByCode } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [inviteInput, setInviteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [myInviteCode, setMyInviteCode] = useState(profile?.inviteCode || '')
  const [inviteCodeIssuing, setInviteCodeIssuing] = useState(false)
  const [inviteCodeError, setInviteCodeError] = useState(false)

  // 子ども側から見た「親と連携済みか」フラグ
  // parentChildLinks コレクションを逆引きして確認する
  const [isLinkedToParent, setIsLinkedToParent] = useState(false)
  const [linkCheckDone, setLinkCheckDone] = useState(false)

  // 初期ロード：inviteCode のセット + 親連携状態の確認
  useEffect(() => {
    if (!isRegistered || profile?.role !== 'child' || !user) return

    // inviteCode がすでにあればセット
    if (profile?.inviteCode) {
      setMyInviteCode(profile.inviteCode)
    }

    // 親連携状態を parentChildLinks から確認（子ど側からの逆引き）
    const checkLink = async () => {
      try {
        const q = query(
          collection(db, 'parentChildLinks'),
          where('childUid', '==', user.uid)
        )
        const snap = await getDocs(q)
        setIsLinkedToParent(!snap.empty)
      } catch (e) {
        console.error('親連携確認エラー:', e)
      } finally {
        setLinkCheckDone(true)
      }
    }
    checkLink()

    // inviteCode がなければ自動発行
    if (!profile?.inviteCode) {
      issueInviteCode()
    }
  }, [profile, isRegistered, user])

  /**
   * 招待コード発行処理（再発行でも同じ関数を使う）
   * 10秒タイムアウト付き。失敗時はエラー状態に落とし、再試行ボタンを出す。
   */
  async function issueInviteCode() {
    if (!user) return
    setInviteCodeIssuing(true)
    setInviteCodeError(false)
    try {
      const issueProcess = generateUniqueInviteCode().then(async (code) => {
        await updateDoc(doc(db, 'users', user.uid), { inviteCode: code })
        return code
      })
      const code = await withTimeout(issueProcess, 10000)
      setMyInviteCode(code)
      updateProfileState({ inviteCode: code })
    } catch (e) {
      console.error('招待コード発行エラー:', e)
      setInviteCodeError(true)
    } finally {
      setInviteCodeIssuing(false)
    }
  }

  async function handleSaveInviteCode() {
    if (!user || !inviteInput.trim()) return
    setSaving(true)
    try {
      const childUid = await lookupChildByCode(inviteInput.trim())
      if (!childUid) {
        showToast('この招待コードは見つかりませんでした', 'error')
        setSaving(false)
        return
      }
      await updateDoc(doc(db, 'users', user.uid), { childUid })
      await setDoc(doc(db, 'parentChildLinks', `${user.uid}_${childUid}`), {
        parentUid: user.uid, childUid, createdAt: serverTimestamp(),
      })
      updateProfileState({ childUid })
      setSaved('childUid')
      showToast('子どもとリンクしました！', 'success')
      setTimeout(() => setSaved(''), 2000)
    } catch (e) {
      console.error(e)
      showToast('保存できませんでした', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 子ども側の招待コードセクションの状態ロジック
  // 優先順位：エラー > 発行中 > コードあり > 連携済みでコードなし > 未連携でコードなし
  function renderChildInviteSection() {
    // エラー状態
    if (inviteCodeError) {
      return (
        <div>
          <p className="error-msg" style={{ marginBottom: 10 }}>
            招待コードを取得できませんでした。もう一度お試しください。
          </p>
          <button className="btn btn-outline btn-sm" onClick={issueInviteCode} disabled={inviteCodeIssuing}>
            {inviteCodeIssuing ? '発行中...' : 'もう一度発行する'}
          </button>
        </div>
      )
    }

    // 発行中
    if (inviteCodeIssuing) {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: '0.9rem' }}>
          <div className="spinner" style={{ margin: '0 auto 8px' }} />
          招待コードを発行中です…
        </div>
      )
    }

    // コードあり（通常表示）
    if (myInviteCode) {
      return (
        <>
          {/* 親連携済みの場合は補足表示 */}
          {linkCheckDone && isLinkedToParent && (
            <div style={{
              padding: '8px 12px', background: 'var(--success-bg)',
              borderRadius: 'var(--r-sm)', marginBottom: 10,
              fontSize: '0.82rem', color: 'var(--success-dark)',
            }}>
              ✅ すでに保護者と連携済みです
            </div>
          )}
          <div style={{
            background: 'var(--primary-bg)',
            borderRadius: 'var(--r-sm)', padding: '16px 20px',
            fontWeight: 900, fontSize: '1.4rem',
            letterSpacing: '0.2em', color: 'var(--primary-dark)',
            textAlign: 'center',
          }}>
            {myInviteCode}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: 'auto' }}
              disabled={!myInviteCode}
              onClick={() => {
                navigator.clipboard.writeText(myInviteCode)
                showToast('コピーしました！', 'success')
              }}
            >
              コピーする
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 'auto', fontSize: '0.78rem', color: 'var(--text-3)' }}
              onClick={issueInviteCode}
            >
              コードを再発行する
            </button>
          </div>
        </>
      )
    }

    // コードなし・連携済み（コードが取れなくても詰まらせない）
    if (linkCheckDone && isLinkedToParent) {
      return (
        <div>
          <div style={{
            padding: '10px 14px', background: 'var(--success-bg)',
            borderRadius: 'var(--r-sm)', marginBottom: 12,
            fontSize: '0.86rem', color: 'var(--success-dark)', lineHeight: 1.6,
          }}>
            ✅ すでに保護者と連携済みです
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 8 }}>
            新しく招待コードが必要な場合は発行できます。
          </p>
          <button className="btn btn-outline btn-sm" onClick={issueInviteCode}>
            新しい招待コードを発行する
          </button>
        </div>
      )
    }

    // コードなし・未連携（発行ボタンを出す）
    return (
      <div>
        <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
          まだ招待コードが発行されていません。
        </p>
        <button className="btn btn-primary btn-sm" onClick={issueInviteCode}>
          招待コードを発行する
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">せってい</h2>

      {/* おためし中 → 登録をうながす */}
      {isTrial && (
        <div className="card card-warning">
          <div className="card-title" style={{ color: 'var(--accent-dark)' }}>おためしモード中</div>
          <p className="text-sm mb-md" style={{ color: 'var(--accent-dark)', lineHeight: 1.6 }}>
            今のデータはこの端末だけに保存されています。<br />
            アカウント登録すると、<strong>クラウド保存・親の見守り</strong>が使えます。<br />
            おためし中のデータはそのまま引き継がれます！
          </p>
          <button className="btn btn-primary"
            onClick={() => navigate('/welcome', { state: { fromSettings: true } })}>
            アカウント登録する
          </button>
        </div>
      )}

      {/* アカウント情報 */}
      <div className="settings-group">
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <span className="text-sm font-bold">アカウント情報</span>
        </div>
        <SettingsRow label="ニックネーム" value={profile?.nickname || '未設定'} />
        <SettingsRow label="モード" value={isTrial ? 'おためし' : 'クラウド保存'} />
        {isRegistered && <SettingsRow label="メール" value={user?.email || ''} />}
        <SettingsRow label="役割"
          value={profile?.role === 'child' ? '選手' : profile?.role === 'parent' ? '保護者' : '未設定'} />
      </div>

      {/* 子ども：招待コード表示 */}
      {isRegistered && profile?.role === 'child' && (
        <div className="card">
          <div className="card-title">あなたの招待コード</div>
          <p className="text-sm text-muted mb-sm">
            このコードを保護者に教えると、記録を見てもらえます。
          </p>
          {renderChildInviteSection()}
        </div>
      )}

      {/* 親：招待コード入力 */}
      {isRegistered && profile?.role === 'parent' && (
        <div className="card">
          <div className="card-title">子どもの招待コード</div>
          {profile?.childUid ? (
            <div style={{
              padding: '10px 14px', background: 'var(--success-bg)',
              borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-md)',
              fontSize: '0.86rem', color: 'var(--success-dark)', lineHeight: 1.6,
            }}>
              ✅ 子どもとリンク済みです
            </div>
          ) : (
            <>
              <div style={{
                padding: '10px 14px', background: 'var(--warning-bg)',
                borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-md)',
                fontSize: '0.84rem', color: 'var(--accent-dark)', lineHeight: 1.7,
              }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>📋 次のステップ</p>
                <p>① お子さんのスマホで「野球のびノート」を開く</p>
                <p>② 設定画面（⚙️）→「あなたの招待コード」を確認する</p>
                <p>③ 表示された6文字のコードを下に入力する</p>
              </div>
              <p className="text-sm text-muted mb-sm">
                子どもの設定画面に表示される6文字のコードを入力してください。
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="parent-invitecode">招待コード（6文字）</label>
                <input id="parent-invitecode" className="form-input" type="text" placeholder="例：ABC123"
                  value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ letterSpacing: '0.15em', fontWeight: 700, textAlign: 'center', fontSize: '1.1rem' }} />
              </div>
              {saved === 'childUid' && <p className="text-sm text-success font-bold mb-sm">✅ リンクしました！</p>}
              <button className="btn btn-primary" onClick={handleSaveInviteCode} disabled={saving || !inviteInput.trim()}>
                {saving ? '確認中...' : 'リンクする'}
              </button>
            </>
          )}
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
          <div className="card-title">おためしデータを消す</div>
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
        <p className="font-bold">野球のびノート</p>
        <p className="text-sm text-muted mt-sm">きょうのじぶんをふりかえる野球成長日記</p>
        <p className="text-xs" style={{ color: 'var(--text-4)', marginTop: 8 }}>v5.2.1</p>
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
