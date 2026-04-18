export default function Logo({ customUrl }) {
  if (customUrl) {
    return (
      <div className="brand-logo">
        <img src={customUrl} alt="Spacefy" />
      </div>
    );
  }

  return (
    <div className="spacefy-logo">
      <div className="spacefy-mark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2.5 L20.5 7.5 L20.5 16.5 L12 21.5 L3.5 16.5 L3.5 7.5 Z"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.08)"
          />
          <circle cx="12" cy="12" r="2.8" fill="#fff" />
        </svg>
      </div>
      <div className="spacefy-text">
        <div className="spacefy-title">
          <span className="accent">Space</span>Sistem
        </div>
        <div className="spacefy-sub">Sistema de gestão Spacefy</div>
      </div>
    </div>
  );
}
