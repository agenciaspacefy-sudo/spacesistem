export default function Logo({ customUrl }) {
  if (customUrl) {
    return (
      <div className="brand-logo">
        <img src={customUrl} alt="SpaceSystem" />
      </div>
    );
  }

  return (
    <div className="spacefy-logo">
      <div className="spacefy-mark">
        <LogoMark size={36} />
      </div>
      <div className="spacefy-text">
        <div className="spacefy-title">
          <span>Space</span>
          <span className="accent">System</span>
        </div>
        <div className="spacefy-sub">Sistema de gestão Spacefy</div>
      </div>
    </div>
  );
}

// Network-style SVG mark — ícone oficial SpaceSystem.
// As linhas começam na borda do núcleo (não em 0,0) para não cruzar o círculo central.
// `bg` controla o recorte do núcleo — por padrão usa a var do tema, então funciona em dark/light.
export function LogoMark({ size = 40, color = '#1B6FEE', bg = 'var(--color-bg, #131314)' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-60 -60 120 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Linhas de conexão (satélite → borda do núcleo) */}
      <line x1="-32" y1="-22" x2="-12" y2="-2" stroke={color} strokeWidth="1.4" />
      <line x1="32" y1="-22" x2="12" y2="-2" stroke={color} strokeWidth="1.4" />
      <line x1="-32" y1="22" x2="-12" y2="2" stroke={color} strokeWidth="1.4" />
      <line x1="32" y1="22" x2="12" y2="2" stroke={color} strokeWidth="1.4" />
      <line x1="0" y1="-36" x2="0" y2="-12" stroke={color} strokeWidth="1.4" />

      {/* Nós satélite */}
      <circle cx="-32" cy="-22" r="6" fill={color} opacity="0.45" />
      <circle cx="32" cy="-22" r="9" fill={color} />
      <circle cx="-32" cy="22" r="9" fill={color} opacity="0.7" />
      <circle cx="32" cy="22" r="6" fill={color} opacity="0.4" />
      <circle cx="0" cy="-36" r="6" fill={color} opacity="0.55" />

      {/* Nó central: anel → recorte do bg → ponto */}
      <circle cx="0" cy="0" r="14" fill={color} />
      <circle cx="0" cy="0" r="8" fill={bg} />
      <circle cx="0" cy="0" r="4" fill={color} />
    </svg>
  );
}
