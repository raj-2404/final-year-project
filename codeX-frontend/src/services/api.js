const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__) ? 'http://localhost:5010' : '');

/**
 * Helper to make API requests with optional authentication header
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('jwtToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error((data && (data.error || data.message)) || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  async login(identifier, password) {
    const isEmail = identifier.includes('@');
    const body = isEmail
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

    const data = await request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (data?.token) {
      localStorage.setItem('jwtToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify({
        id: data.id,
        username: data.username,
        name: data.name,
        email: data.email,
      }));
    }

    return data;
  },

  async register(username, name, email, password, password2) {
    return await request('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, name, email, password, password2 }),
    });
  },

  async getCurrentUser() {
    return await request('/api/users/current', {
      method: 'GET',
    });
  },

  async logout() {
    try {
      await request('/api/users/logout', { method: 'POST' });
    } catch {
      // Ignore network failure on logout
    } finally {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('currentUser');
    }
  },

  getStoredUser() {
    try {
      const userStr = localStorage.getItem('currentUser');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('jwtToken');
  },
};

export const roomsApi = {
  async createRoom({ title, visibility = 'PRIVATE', roomCode, initialTreeJson, language = 'plaintext' }) {
    return await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, visibility, roomCode, initialTreeJson, language }),
    });
  },

  async getRoom(roomCode) {
    return await request(`/api/rooms/${roomCode}`, {
      method: 'GET',
    });
  },

  async getMyRooms() {
    return await request('/api/rooms/my', {
      method: 'GET',
    });
  },

  async getTeamRooms() {
    return await request('/api/rooms/team', {
      method: 'GET',
    });
  },

  async updateVisibility(roomCode, visibility) {
    return await request(`/api/rooms/${roomCode}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ visibility }),
    });
  },

  async checkRoom(roomCode) {
    return await request(`/api/rooms/${roomCode}/check`, {
      method: 'GET',
    });
  },

  async updateTree(roomCode, fileTreeJson) {
    return await request(`/api/rooms/${roomCode}/tree`, {
      method: 'PUT',
      body: JSON.stringify({ fileTreeJson }),
    });
  },
};

export const teamApi = {
  async getTeam() {
    return await request('/api/team', {
      method: 'GET',
    });
  },

  async sendRequest({ userId, username }) {
    return await request('/api/team/request', {
      method: 'POST',
      body: JSON.stringify({ userId, username }),
    });
  },

  async getIncomingRequests() {
    return await request('/api/team/requests/incoming', {
      method: 'GET',
    });
  },

  async getSentRequests() {
    return await request('/api/team/requests/sent', {
      method: 'GET',
    });
  },

  async acceptRequest(requestId) {
    return await request(`/api/team/requests/${requestId}/accept`, {
      method: 'POST',
    });
  },

  async rejectRequest(requestId) {
    return await request(`/api/team/requests/${requestId}/reject`, {
      method: 'POST',
    });
  },

  async cancelSentRequest(requestId) {
    return await request(`/api/team/requests/${requestId}`, {
      method: 'DELETE',
    });
  },

  async removeMember(memberId) {
    return await request(`/api/team/${memberId}`, {
      method: 'DELETE',
    });
  },

  async searchUsers(query) {
    return await request(`/api/team/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  },
};

export const terminalApi = {
  async getState(roomCode) {
    return await request(`/api/rooms/${roomCode}/terminal/state`, {
      method: 'GET',
    });
  },
  async start(roomCode) {
    return await request(`/api/rooms/${roomCode}/terminal/start`, {
      method: 'POST',
    });
  },
  async stop(roomCode) {
    return await request(`/api/rooms/${roomCode}/terminal/stop`, {
      method: 'POST',
    });
  },
  async sendInput(roomCode, data, senderUsername) {
    return await request(`/api/rooms/${roomCode}/terminal/input`, {
      method: 'POST',
      body: JSON.stringify({
        roomCode,
        data,
        senderUsername,
      }),
    });
  },
};

