import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Mini-toast global. Usa fila simples; se chamar 2x em sequencia, aparece um após o outro.
 *
 * Uso:
 *   const toast = useToast();
 *   toast.success('Pagamento registrado!');
 *   toast.error('Falha ao salvar.');
 *   toast.info('Texto livre');
 *   toast.show({ message, variant: 'success' | 'error' | 'info', duration: 3000 });
 */

const ToastCtx = createContext(null);

let _id = 0;
function nextId() { return ++_id; }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((arr) => arr.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback((opts) => {
    const t = {
      id: nextId(),
      message: typeof opts === 'string' ? opts : (opts?.message || ''),
      variant: opts?.variant || 'info',
      duration: opts?.duration ?? 3000
    };
    setItems((arr) => [...arr, t]);
    const tm = setTimeout(() => dismiss(t.id), t.duration);
    timersRef.current.set(t.id, tm);
    return t.id;
  }, [dismiss]);

  const api = {
    show,
    success: (msg, opts) => show({ message: msg, variant: 'success', ...opts }),
    error:   (msg, opts) => show({ message: msg, variant: 'error',   ...opts }),
    info:    (msg, opts) => show({ message: msg, variant: 'info',    ...opts }),
    dismiss
  };

  // Limpa timers se o provider desmontar
  useEffect(() => {
    return () => {
      for (const tm of timersRef.current.values()) clearTimeout(tm);
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {items.length > 0 && (
        <div className="toast-stack" role="region" aria-label="Notificações">
          {items.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.variant}`}
              role={t.variant === 'error' ? 'alert' : 'status'}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-icon" aria-hidden="true">
                {t.variant === 'success' && '✓'}
                {t.variant === 'error' && '!'}
                {t.variant === 'info' && 'i'}
              </span>
              <span className="toast-message">{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
