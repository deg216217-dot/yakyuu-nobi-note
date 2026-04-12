import { useEffect, useRef } from 'react'

/** 保存完了時の達成演出 */
export default function SuccessOverlay({ title, message, onClose }) {
  const cardRef = useRef(null)

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  return (
    <div className="success-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'きろく完了'}>
      <div
        className="success-card"
        ref={cardRef}
        tabIndex={-1}
        style={{ outline: 'none' }}
        onClick={e => e.stopPropagation()}
        aria-live="polite"
      >
        <div className="success-icon" aria-hidden="true">🎉</div>
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
