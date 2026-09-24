import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode } from 'lucide-react';
import FileIcon from './FileIcon';

export default function QuickOpenModal({ isOpen, onClose, files, onSelectFile }) {
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

  const fileOnlyList = files.filter((f) => f.type === 'file');
  const filtered = fileOnlyList.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
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
        onSelectFile(filtered[selectedIndex]);
        onClose();
      }
    }
  };

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open-container" onClick={(e) => e.stopPropagation()}>
        <div className="quick-open-input-row">
          <Search size={16} className="quick-open-icon" />
          <input
            ref={inputRef}
            type="text"
            className="quick-open-input"
            placeholder="Type the name of a file to open (e.g. app.js)..."
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
            <div className="quick-open-empty">No matching files found</div>
          ) : (
            filtered.map((file, idx) => (
              <div
                key={file.id}
                className={`quick-open-item ${idx === selectedIndex ? 'active' : ''}`}
                onClick={() => {
                  onSelectFile(file);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <FileIcon filename={file.name} size={15} />
                <span className="quick-open-file-name">{file.name}</span>
                <span className="quick-open-file-path">{file.parentId ? `in ${file.parentId}` : 'workspace root'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
