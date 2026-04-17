'use client';
import { useEffect, useRef } from 'react';

export default function Toast({ toast, onClose }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, 4000);
    return () => clearTimeout(timerRef.current);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="toast" id="toast">
      <span id="toast-msg">{toast.msg}</span>
      {toast.undoCb && (
        <button
          className="toast-undo"
          id="toast-undo"
          onClick={() => { toast.undoCb(); onClose(); }}
        >
          Undo
        </button>
      )}
      <button className="toast-close" id="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}
