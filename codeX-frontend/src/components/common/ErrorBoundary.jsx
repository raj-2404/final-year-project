import React from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render crash:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: '#1e1e1e',
            color: '#cccccc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              backgroundColor: '#252526',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '24px 32px',
              maxWidth: '680px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={24} color="#f87171" />
              <h2 style={{ margin: 0, fontSize: '18px', color: '#ffffff', fontWeight: 600 }}>
                CodeX Workspace Error
              </h2>
            </div>

            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              An unexpected error occurred while rendering the editor workspace.
            </p>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: '#18181b',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '20px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#f87171',
                  overflowX: 'auto',
                  maxHeight: '160px',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RotateCw size={14} /> Try Reloading
              </button>

              {this.props.onClose && (
                <button
                  type="button"
                  onClick={this.props.onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    color: '#e5e7eb',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Home size={14} /> Back to Welcome Screen
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
