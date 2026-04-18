import { useEffect, useRef, useState } from 'react';
import { formatBRL, formatDate } from '../utils.js';

export default function EditableCell({ value, type = 'text', options, onSave, align = 'left', placeholder = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const next =
      type === 'number' || type === 'int'
        ? draft === '' ? null : Number(draft)
        : draft;
    if ((next ?? '') === (value ?? '')) return;
    onSave(next);
  }

  function cancel() {
    setEditing(false);
    setDraft(value ?? '');
  }

  function onKey(e) {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    if (type === 'select') {
      return (
        <td>
          <select
            ref={inputRef}
            className="cell-edit"
            value={draft ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </td>
      );
    }
    return (
      <td>
        <input
          ref={inputRef}
          className="cell-edit"
          type={type === 'number' || type === 'int' ? 'number' : type === 'date' ? 'date' : type === 'month' ? 'month' : 'text'}
          step={type === 'number' ? '0.01' : type === 'int' ? '1' : undefined}
          min={type === 'int' ? '1' : undefined}
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
      </td>
    );
  }

  let display = value;
  let extraClass = '';
  if (value == null || value === '') {
    display = placeholder || '—';
    extraClass = 'empty';
  } else if (type === 'number') {
    display = <span className="mono">{formatBRL(value)}</span>;
  } else if (type === 'int') {
    display = <span className="mono">{value}</span>;
  } else if (type === 'date') {
    display = formatDate(value);
  }

  return (
    <td>
      <div
        className={`cell ${extraClass}`}
        style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
        onClick={() => setEditing(true)}
      >
        {display}
      </div>
    </td>
  );
}
