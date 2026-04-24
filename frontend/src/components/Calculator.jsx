import { useEffect, useRef, useState } from 'react';

function IconCalc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="8" y2="18" />
      <line x1="12" y1="18" x2="12" y2="18" />
      <line x1="16" y1="18" x2="16" y2="18" />
    </svg>
  );
}

// --------------- Lógica pura (testável) ---------------
// Operações binárias com precedência; implementação simples baseada em
// acumulador + próximo operador, estilo calculadora padrão.
function apply(a, b, op) {
  const x = Number(a) || 0;
  const y = Number(b) || 0;
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? NaN : x / y;
    default: return y;
  }
}

function formatDisplay(v) {
  if (v === null || v === undefined) return '0';
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return 'Erro';
  // Até 10 dígitos significativos, sem notação científica em números "normais"
  const s = Number(v).toPrecision(12);
  // Remove trailing zeros em números com decimais
  const trimmed = Number(s).toString();
  return trimmed.length > 14 ? Number(v).toExponential(6) : trimmed;
}

export default function Calculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState(null);        // acumulador (número)
  const [pending, setPending] = useState(null); // operador pendente
  const [replace, setReplace] = useState(true); // próxima tecla substitui display
  const popoverRef = useRef(null);

  // Fecha ao clicar fora / ESC
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset estado quando fecha
  useEffect(() => {
    if (!open) {
      setDisplay('0');
      setAcc(null);
      setPending(null);
      setReplace(true);
    }
  }, [open]);

  function pressDigit(d) {
    setDisplay((cur) => {
      if (replace) { setReplace(false); return d === '.' ? '0.' : d; }
      if (d === '.' && cur.includes('.')) return cur;
      if (cur === '0' && d !== '.') return d;
      if (cur.length >= 15) return cur;
      return cur + d;
    });
  }

  function pressOp(op) {
    const cur = parseFloat(display);
    if (pending && !replace) {
      // Aplica operação anterior antes de registrar a nova
      const result = apply(acc, cur, pending);
      setAcc(result);
      setDisplay(formatDisplay(result));
    } else {
      setAcc(cur);
    }
    setPending(op);
    setReplace(true);
  }

  function pressEquals() {
    if (pending === null) return;
    const cur = parseFloat(display);
    const result = apply(acc, cur, pending);
    setAcc(null);
    setPending(null);
    setDisplay(formatDisplay(result));
    setReplace(true);
  }

  function pressClear() {
    setDisplay('0');
    setAcc(null);
    setPending(null);
    setReplace(true);
  }

  function pressPercent() {
    // Converte o display atual em porcentagem relativa ao acumulador, se houver
    const cur = parseFloat(display);
    if (acc !== null && pending) {
      const v = (acc * cur) / 100;
      setDisplay(formatDisplay(v));
      setReplace(false);
    } else {
      setDisplay(formatDisplay(cur / 100));
      setReplace(false);
    }
  }

  function pressSign() {
    setDisplay((cur) => {
      if (cur === '0' || cur === '0.') return cur;
      return cur.startsWith('-') ? cur.slice(1) : '-' + cur;
    });
  }

  function pressBackspace() {
    setDisplay((cur) => {
      if (replace) return cur;
      if (cur.length <= 1 || (cur.length === 2 && cur.startsWith('-'))) return '0';
      return cur.slice(0, -1);
    });
  }

  // Teclado físico
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') { pressDigit(e.key); e.preventDefault(); return; }
      if (e.key === '.' || e.key === ',') { pressDigit('.'); e.preventDefault(); return; }
      if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') { pressOp(e.key); e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === '=') { pressEquals(); e.preventDefault(); return; }
      if (e.key === 'Backspace') { pressBackspace(); e.preventDefault(); return; }
      if (e.key === 'Escape') { pressClear(); return; }
      if (e.key === '%') { pressPercent(); e.preventDefault(); return; }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, display, acc, pending, replace]);

  return (
    <div className="calc-wrap" ref={popoverRef}>
      <button
        className={`theme-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen((s) => !s)}
        aria-label="Calculadora"
        aria-expanded={open}
        title="Calculadora"
      >
        <IconCalc />
      </button>

      {open && (
        <div className="calc-popover" role="dialog" aria-label="Calculadora">
          <div className="calc-display">
            {pending && (
              <div className="calc-display-op">
                {formatDisplay(acc)} {pending === '*' ? '×' : pending === '/' ? '÷' : pending}
              </div>
            )}
            <div className="calc-display-main">{display}</div>
          </div>

          <div className="calc-keys">
            <button className="calc-key calc-key-fn" onClick={pressClear}>C</button>
            <button className="calc-key calc-key-fn" onClick={pressSign}>±</button>
            <button className="calc-key calc-key-fn" onClick={pressPercent}>%</button>
            <button className="calc-key calc-key-op" onClick={() => pressOp('/')}>÷</button>

            <button className="calc-key" onClick={() => pressDigit('7')}>7</button>
            <button className="calc-key" onClick={() => pressDigit('8')}>8</button>
            <button className="calc-key" onClick={() => pressDigit('9')}>9</button>
            <button className="calc-key calc-key-op" onClick={() => pressOp('*')}>×</button>

            <button className="calc-key" onClick={() => pressDigit('4')}>4</button>
            <button className="calc-key" onClick={() => pressDigit('5')}>5</button>
            <button className="calc-key" onClick={() => pressDigit('6')}>6</button>
            <button className="calc-key calc-key-op" onClick={() => pressOp('-')}>−</button>

            <button className="calc-key" onClick={() => pressDigit('1')}>1</button>
            <button className="calc-key" onClick={() => pressDigit('2')}>2</button>
            <button className="calc-key" onClick={() => pressDigit('3')}>3</button>
            <button className="calc-key calc-key-op" onClick={() => pressOp('+')}>+</button>

            <button className="calc-key calc-key-zero" onClick={() => pressDigit('0')}>0</button>
            <button className="calc-key" onClick={() => pressDigit('.')}>,</button>
            <button className="calc-key calc-key-eq" onClick={pressEquals}>=</button>
          </div>
        </div>
      )}
    </div>
  );
}
