export type Mood = 'neutral' | 'feliz' | 'motivado' | 'preocupado' | 'celebrando';

const DARK = '#3A3540';
const LINE = '#2B2233';

/** Panda de MunchiBit: cambia de ojos, cejas y boca según el estado del día. */
export default function Mascot({ mood, size = 130 }: { mood: Mood; size?: number }) {
  const closedEyes = mood === 'feliz' || mood === 'celebrando';
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Tu panda está ${mood}`}
      className={mood === 'celebrando' ? 'animate-bounce' : ''}>
      <ellipse cx="100" cy="192" rx="50" ry="6" fill={LINE} opacity=".12" />
      {/* orejas */}
      <circle cx="46" cy="50" r="25" fill={DARK} stroke={LINE} strokeWidth="3" />
      <circle cx="154" cy="50" r="25" fill={DARK} stroke={LINE} strokeWidth="3" />
      {/* cabeza */}
      <ellipse cx="100" cy="108" rx="74" ry="66" fill="#fff" stroke={LINE} strokeWidth="3" />
      <path d="M88 44 q8 -14 22 -4 q-6 2 -8 10 q-6 -8 -14 -6z" fill="#fff" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      {/* manchas de los ojos */}
      <ellipse cx="68" cy="104" rx="19" ry="23" transform="rotate(22 68 104)" fill={DARK} />
      <ellipse cx="132" cy="104" rx="19" ry="23" transform="rotate(-22 132 104)" fill={DARK} />
      {/* ojos */}
      {closedEyes ? (
        <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
          <path d="M58 106 Q68 94 78 106" /><path d="M122 106 Q132 94 142 106" />
        </g>
      ) : (
        <g><circle cx="70" cy="104" r="8" fill="#fff" /><circle cx="130" cy="104" r="8" fill="#fff" />
          <circle cx="72" cy="105" r="4" fill={LINE} /><circle cx="128" cy="105" r="4" fill={LINE} /></g>
      )}
      {/* cejas */}
      {mood === 'preocupado' && (
        <g stroke={LINE} strokeWidth="4" strokeLinecap="round"><path d="M50 82 L82 72" /><path d="M150 82 L118 72" /></g>
      )}
      {mood === 'motivado' && (
        <g stroke={LINE} strokeWidth="4" strokeLinecap="round"><path d="M52 76 L82 82" /><path d="M148 76 L118 82" /></g>
      )}
      {/* mejillas, nariz y boca */}
      <circle cx="46" cy="132" r="10" fill="#F9A8B4" opacity=".85" /><circle cx="154" cy="132" r="10" fill="#F9A8B4" opacity=".85" />
      <ellipse cx="100" cy="126" rx="10" ry="7" fill={LINE} />
      <path d="M100 133 V140" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      {mood === 'celebrando' || mood === 'feliz' ? (
        <g>
          <path d="M80 140 Q100 166 120 140 Z" fill="#8B2F45" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
          <path d="M91 152 Q100 160 109 152 Q100 148 91 152Z" fill="#F9A8B4" />
        </g>
      ) : mood === 'preocupado' ? (
        <path d="M88 150 Q100 140 112 150" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M86 142 Q100 156 114 142" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      )}
      {/* detalles de estado */}
      {mood === 'preocupado' && <path d="M168 78 q-9 14 0 20 q9 -6 0 -20z" fill="#7DC4F0" stroke={LINE} strokeWidth="2" />}
      {mood === 'motivado' && (
        <g fill="#F59A23"><path d="M170 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" /></g>
      )}
      {mood === 'celebrando' && (
        <g><circle cx="24" cy="28" r="5" fill="#F59A23" /><circle cx="178" cy="24" r="6" fill="#2BB58A" />
          <circle cx="190" cy="92" r="4" fill="#D6455D" /><circle cx="10" cy="96" r="4" fill="#3B82C4" />
          <path d="M176 140 q14 -4 16 -18 q-14 2 -16 18z" fill="#2BB58A" /></g>
      )}
    </svg>
  );
}
