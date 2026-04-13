/**
 * プライバシーポリシー
 * - /privacy ルートで表示（認証不要）
 * - Welcome画面・Settings画面の両方からリンク
 */
import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px' }}>
      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0, background: 'var(--bg)',
        borderBottom: '1px solid var(--border-light)',
        padding: '14px 0 12px', marginBottom: 24, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.9rem', color: 'var(--text-2)', padding: '4px 8px 4px 0',
          }}
        >
          ← もどる
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
          プライバシーポリシー
        </h1>
      </div>

      <Section title="はじめに">
        <p>
          「野球のびノート」（以下「本アプリ」）は、子どもが毎日のふりかえり記録を書き、
          保護者がその記録を見守りながら応援できる野球成長日記アプリです。
        </p>
        <p style={{ marginTop: 8 }}>
          本アプリを利用するにあたり取得するお客様の情報は、このポリシーに記載した目的のためだけに使います。
          それ以外の目的では使いません。
        </p>
      </Section>

      <Section title="このアプリの目的">
        <ul>
          <li>子どもが自分のために毎日の練習をふりかえり、成長を記録すること</li>
          <li>保護者がその記録を見守り、スタンプや定型コメントで励ますこと</li>
        </ul>
      </Section>

      <Section title="取得する情報">
        <p>本アプリは、機能の提供に必要な最低限の情報だけを取得します。</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>情報の種類</th>
              <th style={thStyle}>説明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>メールアドレス</td>
              <td style={tdStyle}>ログイン・パスワード再設定に使います</td>
            </tr>
            <tr>
              <td style={tdStyle}>ニックネーム</td>
              <td style={tdStyle}>アプリ内の表示名として使います</td>
            </tr>
            <tr>
              <td style={tdStyle}>パスワード</td>
              <td style={tdStyle}>Firebase Authentication で安全に管理します。運営者を含め誰もパスワードを直接見ることはできません</td>
            </tr>
            <tr>
              <td style={tdStyle}>ふりかえり記録</td>
              <td style={tdStyle}>子どもが入力した練習内容・気分・目標など</td>
            </tr>
            <tr>
              <td style={tdStyle}>親子連携情報</td>
              <td style={tdStyle}>招待コード・リンク情報（保護者と子どものアカウントを紐づけるために使います）</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="利用目的">
        <p>取得した情報は以下の目的のためだけに使います。</p>
        <ul>
          <li>ログイン認証</li>
          <li>パスワード再設定</li>
          <li>ふりかえり記録の保存・閲覧</li>
          <li>親子アカウントの連携</li>
          <li>保護者による見守り機能（スタンプ・コメント）の提供</li>
        </ul>
      </Section>

      <Section title="記録を見られる範囲">
        <p>
          子どもが書いた記録は、<strong>本人</strong>と、連携した<strong>保護者</strong>のアカウントだけが閲覧できます。
          それ以外の第三者がアクセスできる設計にはなっていません。
        </p>
      </Section>

      <Section title="第三者への提供について">
        <p>
          取得した情報を、無断で外部の企業や個人に販売・提供することはありません。
        </p>
        <p style={{ marginTop: 8 }}>
          ただし、以下の場合は除きます。
        </p>
        <ul>
          <li>法令に基づいて開示が必要と判断した場合</li>
          <li>アプリの運営・保守に必要なシステム（Firebase など）のサービス提供範囲内で利用する場合</li>
        </ul>
        <p style={{ marginTop: 8, fontSize: '0.84rem', color: 'var(--text-3)' }}>
          本アプリは Firebase（Google LLC）のサービスを利用しています。
          Firebase が収集する情報については、Google のプライバシーポリシーをご確認ください。
        </p>
      </Section>

      <Section title="端末内に保存されるデータについて">
        <p>以下のデータは、お使いの端末のローカルストレージ（ブラウザの記憶領域）に保存されます。</p>
        <ul>
          <li><strong>おためしモードのデータ</strong>：アカウント未登録のまま入力した記録</li>
          <li><strong>下書きデータ</strong>：記録ページで入力中の内容（保存前の状態）</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          これらのデータは端末の外には送信されません。
          設定画面の「おためしデータを消す」からいつでも削除できます。
        </p>
      </Section>

      <Section title="データの削除・ログアウト">
        <ul>
          <li>アカウントのログアウトは設定画面からいつでもできます</li>
          <li>おためしデータ・下書きデータは設定画面から削除できます</li>
          <li>アカウント自体の削除をご希望の場合は、下記の問い合わせ先までご連絡ください</li>
        </ul>
      </Section>

      <Section title="安全管理について">
        <ul>
          <li>通信はすべて HTTPS で暗号化されています</li>
          <li>Firestore のセキュリティルールにより、本人・連携保護者以外は記録にアクセスできません</li>
          <li>パスワードは Firebase Authentication で管理され、運営者でも確認できません</li>
        </ul>
      </Section>

      <Section title="このポリシーの変更について">
        <p>
          内容を変更する場合は、アプリ内またはその他の方法でお知らせします。
          重要な変更の場合は、引き続きご利用いただく前にご確認いただく機会を設けます。
        </p>
      </Section>

      <Section title="お問い合わせ">
        <p>本アプリに関するご質問・ご要望は下記までお問い合わせください。</p>
        <div style={{
          marginTop: 10, padding: '12px 16px',
          background: 'var(--surface)', borderRadius: 'var(--r-sm)',
          fontSize: '0.86rem', lineHeight: 1.8, color: 'var(--text-2)',
        }}>
          <p>運営者：【TODO: 運営者名】</p>
          <p>連絡先：【TODO: 問い合わせメールアドレス】</p>
        </div>
      </Section>

      <p style={{
        textAlign: 'right', fontSize: '0.78rem',
        color: 'var(--text-4)', marginTop: 32,
      }}>
        制定日：2026年4月
      </p>
    </div>
  )
}

// ---- スタイル定数 ----
const tableStyle = {
  width: '100%', borderCollapse: 'collapse',
  fontSize: '0.84rem', marginTop: 10,
}
const thStyle = {
  textAlign: 'left', padding: '8px 10px',
  background: 'var(--surface)', borderBottom: '2px solid var(--border-light)',
  fontWeight: 700, color: 'var(--text-1)',
  whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border-light)',
  verticalAlign: 'top', lineHeight: 1.6,
  color: 'var(--text-1)',
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: '0.92rem', fontWeight: 700,
        color: 'var(--primary-dark)', marginBottom: 10,
        paddingBottom: 6, borderBottom: '2px solid var(--primary-bg)',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.88rem', lineHeight: 1.85, color: 'var(--text-1)' }}>
        {children}
      </div>
    </section>
  )
}
