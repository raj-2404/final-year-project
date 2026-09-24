import React, { useState } from 'react';
import { Users, Copy, Check, Shield, Globe, Lock, ExternalLink } from 'lucide-react';

export default function CollabPopover({
  isOpen,
  onClose,
  room,
  user,
  participantsCount,
  activeFileName,
  onOpenTeamModal,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="collab-popover-backdrop" onClick={onClose} />
      <div className="collab-popover">
        <div className="collab-popover-header">
          <div className="collab-popover-title">
            <Users size={14} color="#007acc" />
            <span>COLLABORATION</span>
          </div>
          <span className="collab-online-badge">
            <span className="live-dot" /> {participantsCount} Online
          </span>
        </div>

        <div className="collab-popover-body">
          {/* Active Participants List */}
          <div className="collab-section">
            <div className="collab-section-label">PARTICIPANTS</div>
            <div className="collab-user-row">
              <div className="collab-avatar">
                {(user?.username || user?.name || 'ME').slice(0, 2).toUpperCase()}
              </div>
              <div className="collab-user-info">
                <div className="collab-user-name">
                  <span>@{user?.username || user?.name || 'Developer'}</span>
                  <span className="collab-you-tag">You</span>
                </div>
                <div className="collab-user-status">
                  {activeFileName ? `Editing ${activeFileName}` : 'Active in workspace'}
                </div>
              </div>
            </div>

            {participantsCount > 1 && (
              <div className="collab-user-row">
                <div className="collab-avatar remote">
                  TM
                </div>
                <div className="collab-user-info">
                  <div className="collab-user-name">
                    <span>Collaborator ({participantsCount - 1} peer)</span>
                  </div>
                  <div className="collab-user-status">Synchronized live</div>
                </div>
              </div>
            )}
          </div>

          {/* Room Details */}
          <div className="collab-section">
            <div className="collab-section-label">WORKSPACE INFO</div>
            
            <div className="collab-info-item">
              <span className="collab-info-key">Room Code</span>
              <div className="collab-room-code-box" onClick={handleCopyCode}>
                <code>{room.roomCode}</code>
                {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} color="#858585" />}
              </div>
            </div>

            <div className="collab-info-item">
              <span className="collab-info-key">Visibility</span>
              <span className="collab-info-val">
                {room.visibility === 'PUBLIC' ? (
                  <span style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} /> Public (Team)
                  </span>
                ) : (
                  <span style={{ color: '#858585', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> Private
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Action Footer */}
          {onOpenTeamModal && (
            <div className="collab-popover-footer">
              <button
                className="collab-manage-team-btn"
                onClick={() => {
                  onClose();
                  onOpenTeamModal();
                }}
              >
                <span>Manage Team Members</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
