/**
 * 野球のびノート — インラインSVGアイコンセット
 * 装飾用途: aria-hidden="true" focusable="false" を付与済み
 * 外部ライブラリなし・既存CSSの色変数に対応
 */

const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/** 野球ボール */
export function IconBaseball({ size = 48, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.5" stroke={color} style={style} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8.5 3.5 C5.5 6 5 9.5 7.5 12 C10 14.5 9.5 18 8.5 20.5" />
      <path d="M15.5 3.5 C18.5 6 19 9.5 16.5 12 C14 14.5 14.5 18 15.5 20.5" />
    </svg>
  )
}

/** チェックマーク付き円 */
export function IconCheckCircle({ size = 18, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="2" stroke={color}
      style={{ flexShrink: 0, ...style }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="7 12.5 10.5 16 17 9" />
    </svg>
  )
}

/** クリップボード（連携手順アイコン） */
export function IconClipboard({ size = 18, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.5" stroke={color}
      style={{ flexShrink: 0, ...style }} {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1.5" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )
}

/** 小チェック（箇条書きマーカー用） */
export function IconCheck({ size = 14, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 16 16"
      {...BASE} strokeWidth="2.5" stroke={color}
      style={{ flexShrink: 0, ...style }} {...props}>
      <polyline points="2 8 6 12 14 4" />
    </svg>
  )
}

/** ホーム（ナビ用） */
export function IconHome({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <path d="M3 11.5L12 3l9 8.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

/** ペンシル（記録ナビ用） */
export function IconPencil({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

/** 棒グラフ（成長ナビ用） */
export function IconBarChart({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
      <line x1="1" y1="21" x2="23" y2="21" />
    </svg>
  )
}

/** ギア（設定ナビ用） */
export function IconGear({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77" />
    </svg>
  )
}

/** 目（みまもりナビ用） */
export function IconEye({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** ノート・本（みまもりナビ用） */
export function IconBook({ size = 22, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  )
}

/** ログアウト矢印 */
export function IconLogout({ size = 18, color = 'currentColor', style, ...props }) {
  return (
    <svg aria-hidden="true" focusable="false"
      width={size} height={size} viewBox="0 0 24 24"
      {...BASE} strokeWidth="1.6" stroke={color} style={style} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
