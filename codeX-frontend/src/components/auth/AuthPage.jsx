import React, { useState } from 'react';
import { authApi } from '../../services/api';
import './Auth.css';

export default function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successBanner, setSuccessBanner] = useState('');

  const handleTabChange = (newMode) => {
    setMode(newMode);
    setErrors({});
    setSuccessBanner('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessBanner('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const cleanUsername = username.trim().startsWith('@')
          ? username.trim().substring(1)
          : username.trim();

        await authApi.register(cleanUsername, name, email, password, password2);
        setSuccessBanner(`Account @${cleanUsername} created successfully! Please sign in.`);
        setMode('login');
        setLoginIdentifier(cleanUsername);
        setPassword('');
        setPassword2('');
      } else {
        const res = await authApi.login(loginIdentifier, password);
        if (onAuthSuccess) {
          onAuthSuccess(res);
        }
      }
    } catch (err) {
      if (err.data && typeof err.data === 'object') {
        setErrors(err.data);
      } else {
        setErrors({ general: err.message || 'Unable to connect to authentication server' });
      }
    } finally {
      setLoading(false);
    }
  };

  const emailError = errors.email || errors.emailNotFound;
  const passwordError = errors.password || errors.passwordIncorrect;
  const usernameError = errors.username;

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <div className="brand-icon">&lt;/&gt;</div>
            <span className="brand-title">CodeLive</span>
          </div>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your collaborative workspaces'
              : 'Create a unique username to join collaborative teams'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-body">
          {successBanner && (
            <div className="banner-alert success">
              <span>✓</span>
              <span>{successBanner}</span>
            </div>
          )}

          {errors.general && (
            <div className="banner-alert error">
              <span>⚠</span>
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'register' ? (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="username">
                    Unique Username
                  </label>
                  <div className="input-container">
                    <span style={{
                      position: 'absolute',
                      left: '12px',
                      color: '#94a3b8',
                      fontSize: '0.95rem',
                      fontWeight: 600
                    }}>@</span>
                    <input
                      id="username"
                      type="text"
                      className={`form-input ${usernameError ? 'has-error' : ''}`}
                      style={{ paddingLeft: '32px' }}
                      placeholder="e.g. alex_dev"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      autoComplete="username"
                      required
                    />
                  </div>
                  {usernameError && <span className="field-error">{usernameError}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Display Name (Optional)
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex Turing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={`form-input ${emailError ? 'has-error' : ''}`}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  {emailError && <span className="field-error">{emailError}</span>}
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label" htmlFor="loginIdentifier">
                  Username or Email
                </label>
                <input
                  id="loginIdentifier"
                  type="text"
                  className={`form-input ${emailError ? 'has-error' : ''}`}
                  placeholder="e.g. @raj or raj@example.com"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
                {emailError && <span className="field-error">{emailError}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${passwordError ? 'has-error' : ''}`}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {passwordError && <span className="field-error">{passwordError}</span>}
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="password2">
                  Confirm Password
                </label>
                <div className="input-container">
                  <input
                    id="password2"
                    type={showPassword2 ? 'text' : 'password'}
                    className={`form-input ${errors.password2 ? 'has-error' : ''}`}
                    placeholder="Repeat your password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword2(!showPassword2)}
                    aria-label="Toggle password confirmation visibility"
                  >
                    {showPassword2 ? '🙈' : '👁'}
                  </button>
                </div>
                {errors.password2 && <span className="field-error">{errors.password2}</span>}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <p className="auth-switch-text">
            {mode === 'login' ? (
              <>
                Don't have an account?
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => handleTabChange('register')}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => handleTabChange('login')}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
