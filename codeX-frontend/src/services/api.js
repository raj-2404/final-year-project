const API_BASE_URL = '';

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
    const error = new Error((data && (data.message || data.error)) || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  async login(email, password) {
    const data = await request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data?.token) {
      localStorage.setItem('jwtToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify({
        id: data.id,
        name: data.name,
        email: data.email,
      }));
    }

    return data;
  },

  async register(name, email, password, password2) {
    return await request('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, password2 }),
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
  async createRoom(title, language, roomCode) {
    return await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, language, roomCode }),
    });
  },

  async getRoom(roomCode) {
    return await request(`/api/rooms/${roomCode}`, {
      method: 'GET',
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
