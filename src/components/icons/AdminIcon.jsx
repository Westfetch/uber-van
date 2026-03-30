export default function AdminIcon({ size = 40, color = '#c0c8d0', accent = '#d946ef', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      {/* Head */}
      <circle cx="24" cy="14" r="7" fill={color} />
      {/* Tie */}
      <polygon points="24,24 22,28 24,36 26,28" fill="#1a1a1a" />
      {/* Shoulders/torso */}
      <path d="M12 40 Q12 28 24 24 Q36 28 36 40 Z" fill={color} />
      {/* Desk line */}
      <rect x="8" y="38" width="32" height="2" rx="1" fill={color} opacity="0.8" />
      {/* Accent line */}
      <line x1="8" y1="42" x2="40" y2="42" stroke={accent} strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}
