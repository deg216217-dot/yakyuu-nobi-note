import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  doc, updateDoc, setDoc, getDoc, serverTimestamp, arrayUnion, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { clearAllLocal } from '../utils/localStore'
import { IconBaseball, IconCheckCircle, IconClipboard } from '../components/Icons'

/**
 * 重複チェック付き招待コード生成（最大5回試行）
 */
async function generateUniqueInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const snap = await getDoc(doc(db, 'inviteCodes', code))
    if (!snap.exists()) return code
  }
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  )
  return Promise.race([promise, timeout])
}

/** 困ったときFAQデータ */
const HELP_ITEMS = [
  {
    q: 'パスワードを忘れた',
    a: 'ログイン画面の「パスワードを忘れた方はこちら」から、再設定メールを送れます。メールが見つからない時は迷惑メールも確認してください。',
  },
  {
    q: '親と連携できない',
    a: '子ども側の設定画面にある招待コードを、保護者側の設定画面に入力してください。コードは6文字です。',
  },
  {
    q: '記録が見えない',
    a: '親側に記録が見えない時は、子ども側でその日の記録が保存済みか確認してください。',
  },
  {
    q: 'ホーム画面に追加したい',
    a: 'スマホのブラウザでこのアプリを開き、共有メニューから「ホーム画面に追加」を選ぶと、アプリのように起動できます。',
  },
]

export default function Settings() {
  const { user, profile, isTrial, isRegistered, logout, updateProfileState } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [inviteInput, setInviteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [myInviteCode, setMyInviteCode] = useState(profile?.inviteCode || '')
  const [inviteCodeIssuing, setInviteCodeIssuing] = useState(false)
  const [inviteCodeError, setInviteCodeError] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // 親：リンク中の子ども情報（ニックネーム・招待コード）
  const [linkedChildInfo, setLinkedChildInfo] = useState(null)

  // 子ども側：連携済み親の有無（profile から直接判定、非同期不要）
  const isLinkedToParent = !!(
    profile?.linkedParentUid ||
    (Array.isArray(profile?.linkedParentUids) && profile.linkedParentUids.length > 0)
  )
  const [linkCheckDone, setLinkCheckDone] = useState(false)

  // ===== 子ども：招待コード初期化 =====
  useEffect(() => {
    if (!isRegistered || profile?.role !== 'child' || !user) return
    if (profile?.inviteCode) setMyInviteCode(profile.inviteCode)
    setLinkCheckDone(true)
    if (!profile?.inviteCode) issueInviteCode()
  }, [profile?.inviteCode, profile?.linkedParentUid, isRegistered, user?.uid])

  // ===== 親：リンク済みの子ども情報を取得 =====
  useEffect(() => {
    if (!isRegistered || profile?.role !== 'parent' || !profile?.childUid) return
    getDoc(doc(db, 'users', profile.childUid))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data()
          setLinkedChildInfo({ nickname: d.nickname || '', inviteCode: d.inviteCode || '' })
        }
      })
      .catch(() => {})
  }, [profile?.childUid, isRegistered])

  /**
   * 招待コード発行（子ども用）
   */
  async function issueInviteCode() {
    if (!user) return
    setInviteCodeIssuing(true)
    setInviteCodeError(false)
    try {
      const issueProcess = generateUniqueInviteCode().then(async (code) => {
        await updateDoc(doc(db, 'users', user.uid), { inviteCode: code })
        await setDoc(doc(db, 'inviteCodes', code), {
          childUid: user.uid,
          parentUids: [],
          createdAt: serverTimestamp(),
        })
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

  /**
   * 親：招待コードを入力して子どもとリンク
   */
  async function handleSaveInviteCode() {
    if (!user || !inviteInput.trim()) return
    setSaving(true)
    try {
      const codeUpper = inviteInput.trim().toUpperCase()

      const codeSnap = await getDoc(doc(db, 'inviteCodes', codeUpper))
      if (!codeSnap.exists()) {
        showToast('この招待コードは見つかりませんでした', 'error')
        setSaving(false)
        return
      }

      const { childUid, parentUids = [] } = codeSnap.data()

      if (profile?.childUid && profile.childUid === childUid) {
        showToast('すでにこのお子さんとリンク済みです', 'warning')
        setSaving(false)
        return
      }

      if (profile?.childUid && profile.childUid !== childUid) {
        showToast('すでに別のお子さんとリンク済みです', 'error')
        setSaving(false)
        return
      }

      const alreadyInList = Array.isArray(parentUids) && parentUids.includes(user.uid)

      if (!alreadyInList && Array.isArray(parentUids) && parentUids.length >= 2) {
        showToast('このお子さんはすでに2人の保護者と連携済みです', 'error')
        setSaving(false)
        return
      }

      // 全書き込みをバッチで一括コミット
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid), { childUid })
      batch.set(doc(db, 'parentChildLinks', `${user.uid}_${childUid}`), {
        parentUid: user.uid, childUid, createdAt: serverTimestamp(),
      })
      batch.update(doc(db, 'users', childUid), {
        linkedParentUid: user.uid,
        linkedParentUids: arrayUnion(user.uid),
      })
      if (!alreadyInList) {
        batch.update(doc(db, 'inviteCodes', codeUpper), {
          parentUids: arrayUnion(user.uid),
        })
      }
      await batch.commit()

      updateProfileState({ childUid })
      setInviteInput('')

      // バッチ後：子どもの情報を取得して表示
      try {
        const childSnap = await getDoc(doc(db, 'users', childUid))
        if (childSnap.exists()) {
          const d = childSnap.data()
          setLinkedChildInfo({ nickname: d.nickname || '', inviteCode: d.inviteCode || '' })
        }
      } catch (_) {}

      showToast('お子さんとリンクしました！', 'success')
    } catch (e) {
      console.error('リンクエラー:', e)
      showToast('保存できませんでした。もう一度お試しください。', 'error')
    } finally {
      setSaving(false)
    }
  }

  /** 子ども側：招待コードセクション */
  function renderChildInviteSection() {
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

    if (inviteCodeIssuing) {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: '0.9rem' }}>
          <div className="spinner" style={{ margin: '0 auto 8px' }} />
          招待コードを発行中です…
        </div>
      )
    }

    if (myInviteCode) {
      return (
        <>
          {linkCheckDone && isLinkedToParent && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', background: 'var(--success-bg)',
              borderRadius: 'var(--r-sm)', marginBottom: 10,
            }}>
              <IconCheckCircle size={15} color="var(--success)" />
              <span style={{ fontSize: '0.82rem', color: 'var(--success-dark)' }}>
                保護者と連携済みです
              </span>
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

    if (linkCheckDone && isLinkedToParent) {
      return (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', background: 'var(--success-bg)',
            borderRadius: 'var(--r-sm)', marginBottom: 12,
          }}>
            <IconCheckCircle size={16} color="var(--success)" />
            <span style={{ fontSize: '0.86rem', color: 'var(--success-dark)', lineHeight: 1.6 }}>
              保護者と連携済みです
            </span>
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

      {/* 親：お子さんとの連携 */}
      {isRegistered && profile?.role === 'parent' && (
        <div className="card">
          <div className="card-title">お子さんとの連携</div>

          {profile?.childUid ? (
            <div style={{
              padding: '12px 14px', background: 'var(--success-bg)',
              borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: linkedChildInfo ? 10 : 0 }}>
                <IconCheckCircle size={16} color="var(--success)" />
                <span style={{ fontWeight: 700, color: 'var(--success-dark)', fontSize: '0.86rem' }}>
                  お子さんとリンク済みです
                </span>
              </div>
              {linkedChildInfo && (
                <div style={{
                  paddingTop: 10, borderTop: '1px solid var(--success-light)',
                  fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.9,
                }}>
                  <p style={{ fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 2, fontSize: '0.8rem' }}>
                    見守り中のお子さん
                  </p>
                  <p>ニックネーム：<strong style={{ color: 'var(--text-1)' }}>{linkedChildInfo.nickname || '不明'}</strong></p>
                  <p>招待コード：<strong style={{ color: 'var(--primary)', letterSpacing: '0.12em' }}>{linkedChildInfo.inviteCode || '確認できません'}</strong></p>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '10px 14px', background: 'var(--warning-bg)',
              borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-md)',
              fontSize: '0.84rem', color: 'var(--accent-dark)', lineHeight: 1.7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6 }}>
                <IconClipboard size={16} color="var(--accent-dark)" />
                <span>連携するには</span>
              </div>
              <p>① お子さんのスマホで「野球のびノート」を開く</p>
              <p>② 設定画面 → 「あなたの招待コード」を確認する</p>
              <p>③ 表示された6文字のコードを下に入力する</p>
            </div>
          )}

          <p className="text-sm text-muted mb-sm">
            {profile?.childUid
              ? '2人目の保護者が同じお子さんを見守る場合も、こちらからリンクできます。'
              : 'お子さんの設定画面に表示される6文字のコードを入力してください。'}
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="parent-invitecode">招待コード（6文字）</label>
            <input id="parent-invitecode" className="form-input" type="text" placeholder="例：ABC123"
              value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ letterSpacing: '0.15em', fontWeight: 700, textAlign: 'center', fontSize: '1.1rem' }} />
          </div>
          <button className="btn btn-primary" onClick={handleSaveInviteCode} disabled={saving || !inviteInput.trim()}>
            {saving ? '確認中...' : 'リンクする'}
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

      {/* 困ったときFAQ */}
      <div className="card" style={{ marginTop: 8 }}>
        <button
          onClick={() => setShowHelp(v => !v)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'var(--font)', padding: 0,
          }}
          aria-expanded={showHelp}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
            困ったとき
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
            {showHelp ? '▲ 閉じる' : '▼ 開く'}
          </span>
        </button>
        {showHelp && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {HELP_ITEMS.map((item, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--r-sm)',
              }}>
                <p style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary-dark)', marginBottom: 4 }}>
                  {item.q}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* アプリ情報 */}
      <div className="card text-center" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <IconBaseball size={36} color="var(--primary)" />
        </div>
        <p className="font-bold">野球のびノート</p>
        <p className="text-sm text-muted mt-sm">きょうのじぶんをふりかえる野球成長日記</p>
        <p className="text-xs" style={{ color: 'var(--text-4)', marginTop: 8 }}>v5.6.0</p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-3)' }}
          onClick={() => window.open('/yakyuu-nobi-note/about.html', '_blank')}
        >
          このアプリについて
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-3)' }}
          onClick={() => navigate('/privacy')}
        >
          プライバシーポリシー
        </button>
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
