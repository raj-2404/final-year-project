import React from 'react';
import { authApi } from '../../services/api';
import './Auth.css';

export default function UserDashboard({ user, onLogout }) {
  const handleLogout = async () => {
    await authApi.logout();
    if (onLogout) {
      onLogout();
    }
  };

  const token = authApi.getToken();
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="auth-wrapper">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <div className="user-badge">
            <div className="avatar-circle">{initials}</div>
            <div className="user-details">
              <h3>{user?.name || 'Developer'}</h3>
              <p>{user?.email || 'Logged In'}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        <div className="status-badge">
          <div className="status-dot"></div>
          <span>Authenticated with Spring Boot & PostgreSQL</span>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Account Name</div>
            <div className="info-val">{user?.name}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Email</div>
            <div className="info-val">{user?.email}</div>
          </div>
          <div className="info-item">
            <div className="info-label">User ID</div>
            <div className="info-val">#{user?.id}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Session Token</div>
            <div className="info-val" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {token ? `${token.substring(0, 24)}...` : 'Active'}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px dashed #3b82f6',
          borderRadius: '10px',
          padding: '1.25rem',
          textAlign: 'center',
          color: '#cbd5e1'
        }}>
          <h4 style={{ margin: '0 0 0.5rem', color: '#60a5fa' }}>Authentication Setup Complete</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
            The frontend is connected to your Java Spring Boot backend and PostgreSQL database.
            We are ready for the next steps: collaborative rooms and terminal bridge integration.
          </p>
        </div>
      </div>
    </div>
  );
}
