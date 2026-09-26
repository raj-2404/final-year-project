import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertTriangle,
  Check,
  X,
  Layers,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { gitConflicts } from '../../git/gitConflicts';
import { getLanguageForFilename } from '../../editor/languages/languageDetector';

export default function GitConflictModal({
  repoPath,
  filePath,
  filesystemService,
  editorTheme = 'vs-dark',
  onClose,
  onResolved,
  showToast,
}) {
  const [stages, setStages] = useState({ base: '', ours: '', theirs: '' });
  const [currentContent, setCurrentContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'compare'

  useEffect(() => {
    let mounted = true;
    async function loadConflictData() {
      setIsLoading(true);
      try {
        const fullPath = filePath.startsWith('/') || filePath.includes(':')
          ? filePath
          : `${repoPath.replace(/\\/g, '/')}/${filePath}`;

        let fileDiskContent = '';
        if (filesystemService) {
          fileDiskContent = await filesystemService.readFile(fullPath).catch(() => '');
        }

        const conflictStages = await gitConflicts.getConflictStages(repoPath, filePath);
        if (mounted) {
          setStages(conflictStages);
          setCurrentContent(fileDiskContent || conflictStages.ours || '');
        }
      } catch (err) {
        showToast(`Failed to load conflict stages: ${err.message || err}`);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadConflictData();
    return () => {
      mounted = false;
    };
  }, [repoPath, filePath, filesystemService, showToast]);

  const handleAcceptCurrent = async () => {
    try {
      const content = await gitConflicts.acceptCurrent(repoPath, filePath, filesystemService);
      setCurrentContent(content);
      showToast('Accepted Current (Ours) changes');
      if (onResolved) onResolved();
      onClose();
    } catch (err) {
      showToast(`Error accepting current: ${err.message || err}`);
    }
  };

  const handleAcceptIncoming = async () => {
    try {
      const content = await gitConflicts.acceptIncoming(repoPath, filePath, filesystemService);
      setCurrentContent(content);
      showToast('Accepted Incoming (Theirs) changes');
      if (onResolved) onResolved();
      onClose();
    } catch (err) {
      showToast(`Error accepting incoming: ${err.message || err}`);
    }
  };

  const handleAcceptBoth = async () => {
    try {
      const content = await gitConflicts.acceptBoth(repoPath, filePath, filesystemService);
      setCurrentContent(content);
      showToast('Accepted Both changes');
      if (onResolved) onResolved();
      onClose();
    } catch (err) {
      showToast(`Error accepting both: ${err.message || err}`);
    }
  };

  const handleSaveAndMarkResolved = async () => {
    try {
      const fullPath = filePath.startsWith('/') || filePath.includes(':')
        ? filePath
        : `${repoPath.replace(/\\/g, '/')}/${filePath}`;

      if (filesystemService) {
        await filesystemService.writeFile(fullPath, currentContent);
      }
      await gitConflicts.markResolved(repoPath, filePath);
      showToast(`Conflict marked as resolved for ${filePath}`);
      if (onResolved) onResolved();
      onClose();
    } catch (err) {
      showToast(`Error marking resolved: ${err.message || err}`);
    }
  };

  const lang = getLanguageForFilename(filePath);

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
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
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
            <AlertTriangle size={16} color="#f97316" />
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
              Merge Conflict Editor:
            </span>
            <span style={{ fontSize: '12px', color: '#9cdcfe', fontFamily: 'monospace' }}>
              {filePath}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleAcceptCurrent}
              title="Accept Current Changes (Ours)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#1f6feb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '4px 10px',
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={12} /> Accept Current
            </button>

            <button
              type="button"
              onClick={handleAcceptIncoming}
              title="Accept Incoming Changes (Theirs)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#238636',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '4px 10px',
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              <ArrowRight size={12} /> Accept Incoming
            </button>

            <button
              type="button"
              onClick={handleAcceptBoth}
              title="Accept Both (Ours + Theirs)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#8957e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '4px 10px',
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              <Layers size={12} /> Accept Both
            </button>

            <button
              type="button"
              onClick={handleSaveAndMarkResolved}
              title="Save changes and mark resolved (Stage)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#007acc',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Check size={13} /> Mark Resolved
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

        {/* Sub-header / Helper Banner */}
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            borderBottom: '1px solid rgba(249, 115, 22, 0.2)',
            fontSize: '11.5px',
            color: '#fb923c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Choose an automated resolution action above or edit the code directly below to merge changes manually.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{
                cursor: 'pointer',
                fontWeight: activeTab === 'editor' ? 700 : 400,
                color: activeTab === 'editor' ? '#ffffff' : '#858585',
              }}
              onClick={() => setActiveTab('editor')}
            >
              Manual Editor
            </span>
            <span>|</span>
            <span
              style={{
                cursor: 'pointer',
                fontWeight: activeTab === 'compare' ? 700 : 400,
                color: activeTab === 'compare' ? '#ffffff' : '#858585',
              }}
              onClick={() => setActiveTab('compare')}
            >
              Ours vs Theirs
            </span>
          </div>
        </div>

        {/* Editor Content Area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#858585',
                fontSize: '13px',
              }}
            >
              Loading conflict content...
            </div>
          ) : activeTab === 'compare' ? (
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ flex: 1, borderRight: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '4px 12px', backgroundColor: '#1a2733', color: '#58a6ff', fontSize: '11px', fontWeight: 600 }}>
                  CURRENT CHANGE (OURS)
                </div>
                <div style={{ flex: 1 }}>
                  <Editor
                    height="100%"
                    theme={editorTheme}
                    language={lang}
                    value={stages.ours || ''}
                    options={{ readOnly: true, minimap: { enabled: false } }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '4px 12px', backgroundColor: '#1a3324', color: '#3fb950', fontSize: '11px', fontWeight: 600 }}>
                  INCOMING CHANGE (THEIRS)
                </div>
                <div style={{ flex: 1 }}>
                  <Editor
                    height="100%"
                    theme={editorTheme}
                    language={lang}
                    value={stages.theirs || ''}
                    options={{ readOnly: true, minimap: { enabled: false } }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Editor
              height="100%"
              theme={editorTheme}
              language={lang}
              value={currentContent}
              onChange={(value) => setCurrentContent(value || '')}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                fontSize: 13,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
