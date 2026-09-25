import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Folder, File, Save, GitBranch, RefreshCw, Eye, Sun, Moon, ArrowDown, ArrowUp } from 'lucide-react';

export default function CommandPaletteModal({
  isOpen,
  onClose,
  commands,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    }
  };

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open-container" onClick={(e) => e.stopPropagation()}>
        <div className="quick-open-input-row">
          <span style={{ fontSize: '13px', color: '#007acc', fontWeight: 700, paddingRight: '4px' }}>&gt;</span>
          <input
            ref={inputRef}
            type="text"
            className="quick-open-input"
            placeholder="Type a command or action (e.g. Save, Terminal, Git)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="quick-open-results">
          {filtered.length === 0 ? (
            <div className="quick-open-empty">No matching commands found</div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`quick-open-item ${idx === selectedIndex ? 'active' : ''}`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {cmd.icon || <Terminal size={14} color="#858585" />}
                  <span className="quick-open-file-name">{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <kbd className="quick-search-kbd" style={{ fontSize: '10px' }}>
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
