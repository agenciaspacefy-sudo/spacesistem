import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Modal global de confirmação (promise-based).
 *
 * Uso:
 *   const confirm = useConfirm();
 *   async function handleDelete() {
 *     const ok = await confirm({ message: 'Tem certeza que deseja excluir este item?' });
 *     if (!ok) return;
 *     await api.delete(...);
 *   }
 *
 * Opções aceitas:
 *   - title:        string (default "Confirmar exclusão")
 *   - message:      string | ReactNode
 *   - confirmLabel: string (default "Excluir")
 *   - cancelLabel:  string (default "Cancelar")
 *   - variant:      'danger' | 'default'  — estiliza o botão e o ícone
 *   - busyLabel:    string mostrado enquanto `onConfirm` async roda (default "Excluindo…")
 *   - onConfirm:    função opcional async; se passada, é aguardada antes de resolver
 *                   a promise — útil pra desabilitar o botão e mostrar "Excluindo…"
 */

const ConfirmCtx = createContext(null);

const DEFAULTS = {
  title: 'Confirmar exclusão',
  message: 'Tem certeza que deseja continuar?',
  confirmLabel: 'Excluir',
  cancelLabel: 'Cancelar',
  variant: 'danger',
  busyLabel: 'Excluindo…'
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  // Mantém a promise em um ref pra evitar resolver duas vezes se o usuário
  // clicar em cancelar e confirmar muito rápido (StrictMode double-invoke).
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ ...DEFAULTS, ...opts });
      setBusy(false);
    });
  }, []);

  const resolve = useCallback((value) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    setBusy(false);
    if (r) r(value);
  }, []);

  const handleCancel = useCallback(() => {
    if (busy) return;
    resolve(false);
  }, [busy, resolve]);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    // Se o caller passou um onConfirm async, aguarda ele aqui; assim o botão
    // fica em estado "Excluindo…" durante a request e o modal só fecha no fim.
    if (typeof state?.onConfirm === 'function') {
      try {
        setBusy(true);
        await state.onConfirm();
        resolve(true);
      } catch (err) {
        setBusy(false);
        // Não fecha o modal — deixa o caller ver/tratar o erro e decidir.
        console.error('[confirm] onConfirm falhou:', err);
      }
    } else {
      resolve(true);
    }
  }, [busy, state, resolve]);

  // ESC cancela, Enter confirma.
  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, handleCancel, handleConfirm]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          onClick={handleCancel}
        >
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon ${state.variant === 'danger' ? 'modal-icon-danger' : ''}`}>!</div>
            <h3 id="confirm-modal-title">{state.title}</h3>
            <p>{state.message}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancel}
                disabled={busy}
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={state.variant === 'danger' ? 'btn btn-danger-solid' : 'btn btn-primary'}
                onClick={handleConfirm}
                disabled={busy}
                autoFocus
              >
                {busy ? state.busyLabel : state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  return ctx;
}
