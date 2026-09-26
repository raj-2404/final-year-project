import React from 'react';
import { AlertCircle, RefreshCw, Eye, Check } from 'lucide-react';

export default function ExternalChangeBanner({
  fileName,
  onCompare,
  onReload,
  onKeep,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        backgroundColor: '#382800',
        borderBottom: '1px solid #d29922',
        color: '#f0c674',
        fontSize: '11.5px',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={14} color="#f0c674" />
        <span>
          <strong>{fileName}</strong> has been modified externally on disk.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onCompare && (
          <button
            type="button"
            onClick={onCompare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '3px',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <Eye size={12} /> Compare
          </button>
        )}

        <button
          type="button"
          onClick={onReload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#007acc',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Reload from Disk
        </button>

        <button
          type="button"
          onClick={onKeep}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'transparent',
            color: '#cccccc',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <Check size={12} /> Keep Editor Version
        </button>
      </div>
    </div>
  );
}
