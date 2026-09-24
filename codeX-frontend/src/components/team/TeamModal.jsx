import React, { useState, useEffect } from 'react';
import { teamApi } from '../../services/api';
import './TeamModal.css';

export default function TeamModal({ user, onClose, onTeamUpdated }) {
  const [activeTab, setActiveTab] = useState('team'); // 'team' | 'requests'
  const [members, setMembers] = useState([]);
  const [count, setCount] = useState(0);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  
  // Search & Invite states
  const [searchQuery, setSearchQuery] = useState('');
  const [candidateUser, setCandidateUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [banner, setBanner] = useState({ text: '', type: '' });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const showBanner = (text, type = 'error') => {
    setBanner({ text, type });
    setTimeout(() => setBanner({ text: '', type: '' }), 4000);
  };

  const loadAllData = async () => {
    try {
      const [teamData, incoming, sent] = await Promise.all([
        teamApi.getTeam().catch(() => ({ members: [], count: 0 })),
        teamApi.getIncomingRequests().catch(() => []),
        teamApi.getSentRequests().catch(() => []),
      ]);

      const teamMembers = teamData.members || [];
      const teamCount = teamData.count || 0;

      setMembers(teamMembers);
      setCount(teamCount);
      setIncomingRequests(Array.isArray(incoming) ? incoming : []);
      setSentRequests(Array.isArray(sent) ? sent : []);

      if (onTeamUpdated) {
        onTeamUpdated(teamCount, (Array.isArray(incoming) ? incoming.length : 0));
      }
    } catch (err) {
      console.error('Failed to load team and request data', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setCandidateUser(null);
    setBanner({ text: '', type: '' });

    try {
      const results = await teamApi.searchUsers(query);
      if (results && results.length > 0) {
        const match =
          results.find(
            (u) =>
              u.id.toString() === query ||
              u.username.toLowerCase() === query.replace('@', '').toLowerCase()
          ) || results[0];

        setCandidateUser(match);
      } else {
        showBanner(`No developer found for "${query}". Try searching by exact User ID or @username.`, 'error');
      }
    } catch (err) {
      showBanner(err.message || 'Error searching user', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!candidateUser) return;
    setSendingRequest(true);
    setBanner({ text: '', type: '' });

    try {
      const res = await teamApi.sendRequest({
        userId: candidateUser.id,
        username: candidateUser.username,
      });

      // If it auto-accepted (due to mutual request)
      if (res.members) {
        setMembers(res.members || []);
        setCount(res.count || 0);
        showBanner(`Mutual request detected! @${candidateUser.username} is now in your team!`, 'success');
      } else {
        showBanner(`Team request sent to @${candidateUser.username}! Waiting for their approval.`, 'success');
      }

      setCandidateUser(null);
      setSearchQuery('');
      await loadAllData();
    } catch (err) {
      showBanner(err.message || 'Failed to send team request', 'error');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (requestId, senderUsername) => {
    setActionLoadingId(requestId);
    setBanner({ text: '', type: '' });

    try {
      const res = await teamApi.acceptRequest(requestId);
      if (res && res.members) {
        setMembers(res.members);
        setCount(res.count);
      }
      showBanner(`Accepted request from @${senderUsername}! Added to your team.`, 'success');
      await loadAllData();
    } catch (err) {
      showBanner(err.message || 'Failed to accept request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (requestId, senderUsername) => {
    setActionLoadingId(requestId);
    setBanner({ text: '', type: '' });

    try {
      await teamApi.rejectRequest(requestId);
      showBanner(`Rejected team request from @${senderUsername}`, 'info');
      await loadAllData();
    } catch (err) {
      showBanner(err.message || 'Failed to reject request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSentRequest = async (requestId, receiverUsername) => {
    setActionLoadingId(requestId);
    setBanner({ text: '', type: '' });

    try {
      await teamApi.cancelSentRequest(requestId);
      showBanner(`Cancelled request to @${receiverUsername}`, 'info');
      await loadAllData();
    } catch (err) {
      showBanner(err.message || 'Failed to cancel request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (memberId, memberUsername) => {
    if (!window.confirm(`Remove @${memberUsername} from your team?`)) return;

    try {
      const res = await teamApi.removeMember(memberId);
      setMembers(res.members || []);
      setCount(res.count || 0);
      showBanner(`Removed @${memberUsername} from your team`, 'success');
      await loadAllData();
    } catch (err) {
      showBanner(err.message || 'Failed to remove member', 'error');
    }
  };

  const isAlreadyInTeam = candidateUser && members.some((m) => m.memberId === candidateUser.id);
  const isSelf = candidateUser && candidateUser.id === user?.id;
  const isPendingSent = candidateUser && sentRequests.some((r) => r.receiverId === candidateUser.id);
  const isPendingIncoming = candidateUser && incomingRequests.some((r) => r.senderId === candidateUser.id);

  return (
    <div className="team-modal-overlay" onClick={onClose}>
      <div className="team-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="team-modal-header">
          <div className="team-header-title">
            <span>👥 Team Management</span>
          </div>
          <button className="team-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="team-modal-tabs">
          <button
            className={`team-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <span>👥 Your Team</span>
            <span className="team-tab-badge">{count}</span>
          </button>

          <button
            className={`team-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <span>📬 Requests</span>
            {incomingRequests.length > 0 ? (
              <span className="team-tab-badge alert">{incomingRequests.length}</span>
            ) : sentRequests.length > 0 ? (
              <span className="team-tab-badge neutral">{sentRequests.length}</span>
            ) : null}
          </button>
        </div>

        {/* Body */}
        <div className="team-modal-body">
          {banner.text && (
            <div className={`team-alert-banner ${banner.type}`}>
              <span>{banner.type === 'success' ? '✓' : banner.type === 'info' ? 'ℹ' : '⚠'}</span>
              <span>{banner.text}</span>
            </div>
          )}

          {/* TAB 1: YOUR TEAM */}
          {activeTab === 'team' && (
            <>
              {/* Add Member Search Form */}
              <div className="team-add-section">
                <div className="team-add-label">
                  <span>➕</span>
                  <span>Invite Member by User ID or Username</span>
                </div>
                <p className="team-add-subtext">
                  Send a team invitation request. Once they accept, they will be added to your team.
                </p>

                <form onSubmit={handleSearch} className="team-search-form">
                  <input
                    type="text"
                    className="team-search-input"
                    placeholder="Enter User ID (e.g. 2) or @username (e.g. aisha)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="team-search-btn" disabled={searching || !searchQuery.trim()}>
                    {searching ? 'Finding...' : 'Find User'}
                  </button>
                </form>

                {/* Candidate Found Card */}
                {candidateUser && (
                  <div className="team-candidate-card">
                    <div className="candidate-left">
                      <div className="candidate-avatar">
                        {candidateUser.name
                          ? candidateUser.name.slice(0, 2).toUpperCase()
                          : candidateUser.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="candidate-info">
                        <h4>{candidateUser.name || candidateUser.username}</h4>
                        <div>
                          <span className="candidate-username">@{candidateUser.username}</span>
                          <span className="candidate-id-badge">ID: #{candidateUser.id}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isSelf ? (
                        <span className="candidate-status-text">This is you</span>
                      ) : isAlreadyInTeam ? (
                        <span className="candidate-status-text in-team">✓ Already in Team</span>
                      ) : isPendingSent ? (
                        <span className="candidate-status-text pending">⏳ Request Sent</span>
                      ) : isPendingIncoming ? (
                        <button
                          className="candidate-add-btn"
                          onClick={() => setActiveTab('requests')}
                        >
                          Respond to Request
                        </button>
                      ) : (
                        <button
                          className="candidate-add-btn"
                          onClick={handleSendRequest}
                          disabled={sendingRequest}
                        >
                          {sendingRequest ? 'Sending...' : '📨 Send Request'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Team Members List */}
              <div className="team-list-section-title">
                Your Team ({members.length})
              </div>

              {members.length === 0 ? (
                <div className="team-empty-state">
                  <div className="team-empty-icon">🤝</div>
                  <p style={{ margin: '0 0 6px 0', color: '#cccccc', fontWeight: 500 }}>No team members yet</p>
                  <p style={{ margin: 0 }}>
                    Invite collaborators using their User ID or @username. Once accepted, you can collaborate seamlessly!
                  </p>
                </div>
              ) : (
                <div className="team-members-list">
                  {members.map((member) => (
                    <div key={member.id} className="team-member-card">
                      <div className="member-card-left">
                        <div className="member-avatar">
                          {member.name
                            ? member.name.slice(0, 2).toUpperCase()
                            : member.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="member-details-name">
                            <span>{member.name || member.username}</span>
                            <span className="member-username-tag">@{member.username}</span>
                            <span className="member-id-tag">#{member.memberId}</span>
                          </div>
                          <div className="member-details-email">
                            {member.email} • Added {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="member-actions">
                        <button
                          className="member-remove-btn"
                          title="Remove from Team"
                          onClick={() => handleRemoveMember(member.memberId, member.username)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 2: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="team-requests-tab-content">
              {/* Section 1: Incoming Requests */}
              <div className="requests-group">
                <div className="team-list-section-title flex-title">
                  <span>Incoming Team Invitations ({incomingRequests.length})</span>
                  {incomingRequests.length > 0 && (
                    <span className="badge-highlight">Action Required</span>
                  )}
                </div>

                {incomingRequests.length === 0 ? (
                  <div className="team-empty-state-subtle">
                    <span>📭 No pending incoming requests</span>
                  </div>
                ) : (
                  <div className="requests-list">
                    {incomingRequests.map((req) => (
                      <div key={req.id} className="request-card incoming">
                        <div className="request-card-left">
                          <div className="member-avatar request-avatar">
                            {req.senderName
                              ? req.senderName.slice(0, 2).toUpperCase()
                              : req.senderUsername.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="member-details-name">
                              <span>{req.senderName || req.senderUsername}</span>
                              <span className="member-username-tag">@{req.senderUsername}</span>
                              <span className="member-id-tag">#{req.senderId}</span>
                            </div>
                            <div className="request-subtext">
                              Invited you to join their team • {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="request-card-actions">
                          <button
                            className="req-btn accept-btn"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAcceptRequest(req.id, req.senderUsername)}
                          >
                            {actionLoadingId === req.id ? 'Accepting...' : '✓ Accept'}
                          </button>
                          <button
                            className="req-btn reject-btn"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleRejectRequest(req.id, req.senderUsername)}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Sent Requests */}
              <div className="requests-group" style={{ marginTop: '24px' }}>
                <div className="team-list-section-title">
                  Sent Invitations ({sentRequests.length})
                </div>

                {sentRequests.length === 0 ? (
                  <div className="team-empty-state-subtle">
                    <span>📤 No pending sent invitations</span>
                  </div>
                ) : (
                  <div className="requests-list">
                    {sentRequests.map((req) => (
                      <div key={req.id} className="request-card sent">
                        <div className="request-card-left">
                          <div className="member-avatar request-avatar sent-avatar">
                            {req.receiverName
                              ? req.receiverName.slice(0, 2).toUpperCase()
                              : req.receiverUsername.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="member-details-name">
                              <span>{req.receiverName || req.receiverUsername}</span>
                              <span className="member-username-tag">@{req.receiverUsername}</span>
                              <span className="member-id-tag">#{req.receiverId}</span>
                            </div>
                            <div className="request-subtext">
                              Invitation sent • {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="request-card-actions">
                          <span className="sent-pending-tag">⏳ Pending</span>
                          <button
                            className="req-btn cancel-btn"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleCancelSentRequest(req.id, req.receiverUsername)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
