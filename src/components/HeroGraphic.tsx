/** Original abstract "file stack" illustration for the homepage hero. Decorative only. */
export function HeroGraphic() {
  return (
    <svg className="hero-graphic" viewBox="0 0 560 600" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="hg-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.6" fill="var(--ink)" />
        </pattern>
        <pattern id="hg-dots-red" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.4" fill="var(--red)" />
        </pattern>
      </defs>

      {/* jagged burst */}
      <path
        className="hg-burst"
        d="M300 30l40 90 96-40-34 98 108 20-90 62 76 82-108-8 6 108-84-66-52 98-30-106-100 46 42-100-104-34 98-50-62-90 106 16z"
        fill="var(--ink)"
      />
      <circle cx="420" cy="140" r="96" fill="url(#hg-dots)" opacity="0.55" />

      {/* speed lines */}
      <g className="hg-lines" stroke="var(--ink)" strokeWidth="6">
        <path d="M470 380l90-60" />
        <path d="M486 420l74-50" />
        <path d="M500 458l60-40" />
      </g>

      {/* back sheet */}
      <g className="hg-sheet" style={{ ['--d' as string]: '120ms' }} transform="rotate(-14 260 300)">
        <rect x="120" y="120" width="260" height="340" fill="var(--surface-2)" stroke="var(--paper)" strokeWidth="3" />
        <rect x="120" y="120" width="260" height="340" fill="url(#hg-dots-red)" opacity="0.5" />
      </g>

      {/* middle sheet */}
      <g className="hg-sheet" style={{ ['--d' as string]: '220ms' }} transform="rotate(-5 270 300)">
        <rect x="140" y="110" width="260" height="340" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="3" />
        <path d="M168 150h150M168 172h190M168 194h120" stroke="var(--ink)" strokeWidth="8" opacity="0.35" />
      </g>

      {/* front sheet */}
      <g className="hg-sheet hg-front" style={{ ['--d' as string]: '320ms' }} transform="rotate(6 300 310)">
        <path d="M170 110h200l50 50v300H170z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4" />
        <path d="M370 110v50h50" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="4" />
        <rect x="196" y="140" width="140" height="22" fill="var(--ink)" />
        <path d="M196 186h196M196 206h196M196 226h150" stroke="var(--ink)" strokeWidth="6" />
        <rect x="196" y="250" width="196" height="120" fill="var(--ink)" />
        <path d="M196 370l62-70 40 42 28-26 66 54z" fill="var(--red)" />
        <circle cx="356" cy="282" r="12" fill="var(--paper)" />
        <path d="M196 396h120M196 416h170" stroke="var(--ink)" strokeWidth="6" />
        <rect x="318" y="428" width="74" height="22" fill="var(--red)" />
        <text x="355" y="444" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize="13" fill="var(--ink)">
          .PDF
        </text>
      </g>

      {/* crop marks */}
      <g className="hg-marks" stroke="var(--paper)" strokeWidth="3" fill="none">
        <path d="M120 86v30M96 110h30" />
        <path d="M462 140v30M480 164h-30" />
        <path d="M110 500v-30M86 478h30" />
        <path d="M452 532v-30M476 510h-30" />
      </g>

      {/* page thumbnail strip */}
      <g className="hg-strip" transform="translate(40 500) skewX(-12)">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${i * 66} 0)`}>
            <rect width="54" height="72" fill={i === 2 ? 'var(--red)' : 'var(--paper)'} stroke="var(--ink)" strokeWidth="3" />
            <path d="M10 16h34M10 28h34M10 40h22" stroke="var(--ink)" strokeWidth="4" />
            <text x="27" y="64" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize="11" fill="var(--ink)">
              0{i + 1}
            </text>
          </g>
        ))}
      </g>

      {/* annotations */}
      <g fontFamily="var(--font-mono)" fontSize="12" fontWeight="700" letterSpacing="2" fill="var(--ink)">
        <text x="300" y="24">FIG.01 — FILE STACK</text>
        <text x="436" y="590">→ OUTPUT</text>
      </g>
    </svg>
  );
}
