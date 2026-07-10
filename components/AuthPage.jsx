'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthPage({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '{{10293847Mn@}}') {
      localStorage.setItem('app_unlocked', 'true');
      onUnlock();
    } else {
      setError('Incorrect access code');
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-grid" aria-hidden="true">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="auth-grid-line" />
        ))}
      </div>

      <div className="auth-card">
        <div className="auth-wordmark">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="4" fill="#f0a500" fillOpacity=".12" stroke="#f0a500" strokeWidth="1.5"/>
            <rect x="6" y="7" width="16" height="3" rx="1" fill="#f0a500"/>
            <rect x="6" y="13" width="11" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
            <rect x="6" y="17" width="14" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
          </svg>
          <span>ScriptApp</span>
        </div>

        <h1 className="auth-heading">Private Access</h1>
        <p className="auth-subheading">Enter your access code to view this application.</p>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Access Code</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <button
            type="submit"
            id="auth-submit"
            className="auth-btn"
          >
            Unlock App
          </button>
        </form>
      </div>
    </div>
  );
}
