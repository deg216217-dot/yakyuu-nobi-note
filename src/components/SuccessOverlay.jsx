/** 保存完了時の達成演出 */
export default function SuccessOverlay({ title, message, onClose }) {
  return (
    <div className="success-overlay" onClick={onClose}>
      <div className="success-card" onClick={e => e.stopPropagation()}>
        <div className="success-icon">🎉</div>
        <h2>{title || 'きろく完了！'}</h2>
        <p style={{ marginBottom: 20 }}>
          {message || 'すばらしい！今日もよくがんばった！'}
        </p>
        <button
          className="btn btn-primary btn-sm"
          style={{ width: 'auto', padding: '10px 32px' }}
          onClick={onClose}
        >
          とじる
        </button>
      </div>
    </div>
  )
}
