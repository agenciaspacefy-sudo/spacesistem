import { useEffect, useRef, useState } from 'react';

const EMAIL_DESTINO = 'agenciaspacefy@gmail.com';

function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function Star({ filled }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);
  const panelRef = useRef(null);

  // Fecha ao clicar fora / Esc
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)
        && !e.target.closest('.feedback-fab')) {
        setOpen(false);
      }
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function resetForm() {
    setRating(0);
    setHover(0);
    setComentario('');
    setEnviado(false);
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
      // Dá um frame antes do reset para a animação não travar
      setTimeout(resetForm, 180);
    } else {
      resetForm();
      setOpen(true);
    }
  }

  function handleEnviar() {
    if (rating === 0) return;
    const subject = `Avaliação SpaceSystem — Nota: ${rating}/5`;
    const body = `Nota: ${rating}/5\n\nComentário:\n${comentario || '(sem comentário)'}\n`;
    const href = `mailto:${EMAIL_DESTINO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Abre o cliente de email padrão
    window.location.href = href;
    setEnviado(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(resetForm, 220);
    }, 1600);
  }

  return (
    <>
      <button
        className="feedback-fab"
        onClick={handleToggle}
        aria-label={open ? 'Fechar avaliação' : 'Avaliar sistema'}
        title="Avaliar o sistema"
      >
        <IconChat />
      </button>

      {open && (
        <div className="feedback-panel" ref={panelRef} role="dialog" aria-label="Avaliar sistema">
          {enviado ? (
            <div className="feedback-thankyou">
              <span className="feedback-thankyou-emoji">🙏</span>
              Obrigado pelo feedback!
            </div>
          ) : (
            <>
              <div className="feedback-head">
                <h3 className="feedback-title">Como está sua experiência?</h3>
                <button className="feedback-close" onClick={handleToggle} aria-label="Fechar">×</button>
              </div>
              <p className="feedback-sub">Sua avaliação ajuda a melhorar o SpaceSystem.</p>

              <div className="feedback-stars" role="radiogroup" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`feedback-star ${active ? 'is-active' : ''}`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                      aria-checked={rating === n}
                      role="radio"
                    >
                      <Star filled={active} />
                    </button>
                  );
                })}
              </div>

              <textarea
                className="feedback-textarea"
                placeholder="Conte o que está achando (opcional)…"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />

              <button
                className="feedback-submit"
                onClick={handleEnviar}
                disabled={rating === 0}
              >
                Enviar avaliação
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
