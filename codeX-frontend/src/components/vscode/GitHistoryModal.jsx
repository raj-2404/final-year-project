import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  Clock,
  User,
  Search,
  X,
  RotateCw,
} from 'lucide-react';
import { gitHistory } from '../../git/gitHistory';

export default function GitHistoryModal({
  repoPath,
  filePath = null,
  onOpenDiff,
  onClose,
  showToast,
}) {
  const [commits, setCommits] = useState([]);
  const [filteredCommits, setFilteredCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await gitHistory.getLog(repoPath, 50, filePath);
      setCommits(list);
      setFilteredCommits(list);
      if (list.length > 0) {
        setSelectedCommit(list[0]);
      }
    } catch (err) {
      showToast(`Failed to load history: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [repoPath, filePath]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommits(commits);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredCommits(
        commits.filter(
          (c) =>
            c.message.toLowerCase().includes(q) ||
            c.author.toLowerCase().includes(q) ||
            c.hash.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, commits]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '85vw',
          maxWidth: '1000px',
          height: '80vh',
          backgroundColor: '#1e1e1e',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#252526',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCommit size={16} color="#60a5fa" />
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
              Git History {filePath ? `for ${filePath}` : 'Log'}
            </span>
            <span style={{ fontSize: '11px', color: '#858585' }}>
              ({filteredCommits.length} commits)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={loadHistory}
              title="Refresh History"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#cccccc',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RotateCw size={14} />
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#858585',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#202020',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Search size={14} color="#858585" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commits by message, author, or hash..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '12px',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#858585', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Body Split */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Commit list */}
          <div
            style={{
              flex: 1,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              overflowY: 'auto',
            }}
          >
            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
                Loading commits...
              </div>
            ) : filteredCommits.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
                No commits found.
              </div>
            ) : (
              filteredCommits.map((c) => {
                const isSelected = selectedCommit?.hash === c.hash;
                return (
                  <div
                    key={c.hash}
                    onClick={() => setSelectedCommit(c)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: '12px',
                          color: '#e1e1e1',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '380px',
                        }}
                      >
                        {c.message}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#60a5fa',
                          backgroundColor: 'rgba(96, 165, 250, 0.1)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {c.shortHash}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#858585' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} /> {c.author}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {c.date}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Commit Details */}
          <div
            style={{
              width: '400px',
              backgroundColor: '#1a1a1a',
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {selectedCommit ? (
              <>
                <div>
                  <div style={{ fontSize: '11px', color: '#858585', textTransform: 'uppercase', fontWeight: 600 }}>
                    Commit Details
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginTop: '6px', lineHeight: '1.4' }}>
                    {selectedCommit.message}
                  </div>
                </div>

                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#858585', width: '60px' }}>Commit:</span>
                    <span style={{ fontFamily: 'monospace', color: '#9cdcfe' }}>{selectedCommit.hash}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#858585', width: '60px' }}>Author:</span>
                    <span style={{ color: '#cccccc' }}>{selectedCommit.author} {selectedCommit.email && `(${selectedCommit.email})`}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#858585', width: '60px' }}>Date:</span>
                    <span style={{ color: '#cccccc' }}>{selectedCommit.date}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#858585', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                    Changed Files ({selectedCommit.files?.length || 0})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(selectedCommit.files || []).map((file) => (
                      <div
                        key={file}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '3px',
                          fontSize: '11.5px',
                        }}
                      >
                        <span style={{ color: '#cccccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file}
                        </span>
                        {onOpenDiff && (
                          <button
                            type="button"
                            onClick={() => onOpenDiff(file, false)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            Diff
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#858585', fontSize: '12px' }}>
                Select a commit to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
