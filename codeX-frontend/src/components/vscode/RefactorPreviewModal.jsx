import React, { useState, useEffect } from 'react';
import {
  FileText,
  Check,
  X,
  AlertTriangle,
  ChevronRight,
  FilePlus,
  FileMinus,
  FileDiff,
} from 'lucide-react';
import { EditOperationType } from '../../editor/codeActions/codeActionTypes.js';

export default function RefactorPreviewModal({
  isOpen,
  title = 'Refactoring Preview',
  preview,
  onApply,
  onCancel,
}) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  useEffect(() => {
    setSelectedFileIndex(0);
  }, [isOpen, preview]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onApply?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onApply, onCancel]);

  if (!isOpen || !preview) return null;

  const filePreviews = preview.filePreviews || [];
  const selectedFile = filePreviews[selectedFileIndex] || filePreviews[0];

  const renderDiffLines = (oldText = '', newText = '') => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Simple line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length);
    const rows = [];

    for (let i = 0; i < maxLines; i++) {
      const o = oldLines[i];
      const n = newLines[i];

      if (o === undefined) {
        rows.push({ type: 'added', lineNum: i + 1, text: n });
      } else if (n === undefined) {
        rows.push({ type: 'removed', lineNum: i + 1, text: o });
      } else if (o !== n) {
        rows.push({ type: 'removed', lineNum: i + 1, text: o });
        rows.push({ type: 'added', lineNum: i + 1, text: n });
      } else {
        rows.push({ type: 'unchanged', lineNum: i + 1, text: o });
      }
    }

    return (
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px', lineHeight: '18px' }}>
        {rows.map((row, idx) => {
          let bg = 'transparent';
          let color = '#cccccc';
          let prefix = ' ';

          if (row.type === 'added') {
            bg = 'rgba(46, 160, 67, 0.18)';
            color = '#7ee787';
            prefix = '+';
          } else if (row.type === 'removed') {
            bg = 'rgba(248, 81, 73, 0.18)';
            color = '#ffa198';
            prefix = '-';
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                background: bg,
                color,
                padding: '0 8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <span style={{ width: 36, color: '#6e7681', userSelect: 'none', flexShrink: 0 }}>
                {row.lineNum}
              </span>
              <span style={{ width: 14, userSelect: 'none', flexShrink: 0, fontWeight: 700 }}>
                {prefix}
              </span>
              <span>{row.text || ' '}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="quick-open-overlay"
      style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.65)' }}
      onClick={onCancel}
    >
      <div
        className="quick-open-container"
        style={{
          width: '740px',
          maxWidth: '90vw',
          height: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1e1e1e',
          border: '1px solid #454545',
          borderRadius: '6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileDiff size={16} color="#38bdf8" />
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
              {title}
            </span>
            <span style={{ fontSize: '11px', color: '#888888' }}>
              ({filePreviews.length} file{filePreviews.length === 1 ? '' : 's'} affected)
            </span>
          </div>

          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: Sidebar with affected files + Diff preview pane */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* File list sidebar */}
          <div
            style={{
              width: '240px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.12)',
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                fontSize: '10.5px',
                textTransform: 'uppercase',
                color: '#888888',
                letterSpacing: 0.5,
              }}
            >
              Changed Files
            </div>

            {filePreviews.map((f, idx) => {
              const isSelected = idx === selectedFileIndex;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedFileIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #38bdf8' : '2px solid transparent',
                    color: isSelected ? '#ffffff' : '#cccccc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {f.isNew ? (
                      <FilePlus size={13} color="#4ade80" />
                    ) : f.isDelete ? (
                      <FileMinus size={13} color="#f87171" />
                    ) : (
                      <FileText size={13} color="#94a3b8" />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={f.relativeName}
                    >
                      {f.relativeName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diff viewer pane */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 0',
              background: '#181818',
            }}
          >
            {selectedFile ? (
              renderDiffLines(selectedFile.oldContent, selectedFile.newContent)
            ) : (
              <div style={{ color: '#888', padding: 16, textAlign: 'center' }}>
                No file selected
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#858585' }}>
            Press <kbd style={{ background: '#333', padding: '1px 5px', borderRadius: 3, color: '#ddd' }}>⌘Enter</kbd> to Apply, <kbd style={{ background: '#333', padding: '1px 5px', borderRadius: 3, color: '#ddd' }}>Esc</kbd> to Cancel
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: '1px solid #454545',
                color: '#cccccc',
                padding: '5px 14px',
                borderRadius: '3px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              style={{
                background: '#0e639c',
                border: 'none',
                color: '#ffffff',
                padding: '5px 16px',
                borderRadius: '3px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={14} /> Apply Refactoring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
