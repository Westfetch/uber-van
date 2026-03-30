export default function VanIcon({ size = 40, color = '#c0c8d0', accent = '#d946ef', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      {/* Van body */}
      <rect x="4" y="14" width="26" height="18" rx="2" fill={color} />
      {/* Cab */}
      <path d="M30 20 L40 20 Q42 20 42 22 L42 32 L30 32 Z" fill={color} />
      {/* Windshield */}
      <path d="M30 20 L38 20 Q40 20 40 22 L40 26 L30 26 Z" fill="#1a1a1a" opacity="0.5" />
      {/* Wheels */}
      <circle cx="14" cy="34" r="4" fill="#1a1a1a" />
      <circle cx="14" cy="34" r="2" fill={color} opacity="0.6" />
      <circle cx="36" cy="34" r="4" fill="#1a1a1a" />
      <circle cx="36" cy="34" r="2" fill={color} opacity="0.6" />
      {/* Accent line */}
      <line x1="4" y1="38" x2="44" y2="38" stroke={accent} strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}
