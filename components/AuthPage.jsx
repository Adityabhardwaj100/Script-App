'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthPage() {
  const [mode, setMode]       = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        /* onAuthStateChange in AppClient will handle the rest */
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Account created! You can now sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      {/* Background grid lines */}
      <div className="auth-grid" aria-hidden="true">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="auth-grid-line" />
        ))}
      </div>

      {/* Card */}
      <div className="auth-card">
        {/* Wordmark */}
        <div className="auth-wordmark">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="4" fill="#f0a500" fillOpacity=".12" stroke="#f0a500" strokeWidth="1.5"/>
            <rect x="6" y="7" width="16" height="3" rx="1" fill="#f0a500"/>
            <rect x="6" y="13" width="11" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
            <rect x="6" y="17" width="14" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
          </svg>
          <span>ScriptApp</span>
        </div>

        <h1 className="auth-heading">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="auth-subheading">
          {mode === 'login'
            ? 'Sign in to access your scripts from any device.'
            : 'Your scripts will sync across all your devices.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}
          {success && (
            <div className="auth-success" role="status">{success}</div>
          )}

          <button
            type="submit"
            id="auth-submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading
              ? <span className="auth-spinner" />
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button className="auth-switch-btn" onClick={() => { setMode('signup'); setError(''); }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="auth-switch-btn" onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
