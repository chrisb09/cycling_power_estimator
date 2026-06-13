export const API_BASE = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const loginUser = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!response.ok) throw new Error('Login failed');
  return response.json();
};

export const registerUser = async (data) => {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(()=>({}));
    throw new Error(err.detail || 'Registration failed');
  }
  return response.json();
};

export const fetchMe = async () => {
  const response = await fetch(`${API_BASE}/me`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch user data');
  return response.json();
};

export const updateMe = async (data) => {
  const response = await fetch(`${API_BASE}/me`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update user data');
  return response.json();
};

export const fetchRides = async () => {
  const response = await fetch(`${API_BASE}/rides/`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch rides');
  return response.json();
};

export const deleteRide = async (rideId) => {
  const response = await fetch(`${API_BASE}/rides/${rideId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete ride');
  return response.json();
};

export const updateRide = async (rideId, data) => {
  const response = await fetch(`${API_BASE}/rides/${rideId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update ride');
  return response.json();
};

export const fetchPublicRides = async (username) => {
  const response = await fetch(`${API_BASE}/rides/user/${username}`);
  if (!response.ok) throw new Error('Failed to fetch public rides');
  return response.json();
};

export const fetchRideAnalysis = async (rideId, token = null) => {
  const url = token ? `${API_BASE}/rides/${rideId}/analyze?token=${token}` : `${API_BASE}/rides/${rideId}/analyze`;
  const headers = getHeaders(); // optional if anonymous
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch ride analysis');
  }
  return response.json();
};

// Admin Endpoints
export const adminFetchUsers = async () => {
  const response = await fetch(`${API_BASE}/admin/users`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
};

export const adminUpdateUserRole = async (userId, role) => {
  const response = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  if (!response.ok) throw new Error('Failed to update role');
  return response.json();
};

export const adminUpdateUserStatus = async (userId, is_active) => {
  const response = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active })
  });
  if (!response.ok) throw new Error('Failed to update status');
  return response.json();
};

export const adminGenerateInvite = async () => {
  const response = await fetch(`${API_BASE}/admin/invites`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to generate invite');
  return response.json();
};

export const adminFetchInvites = async () => {
  const response = await fetch(`${API_BASE}/admin/invites`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch invites');
  return response.json();
};

export const fetchBikes = async () => {
  const response = await fetch(`${API_BASE}/bikes/`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch bikes');
  return response.json();
};

export const analyzeRide = async (file, params, auxFile = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (auxFile) formData.append('aux_file', auxFile);
  formData.append('rider_kg', params.rider_kg);
  formData.append('bike_kg', params.bike_kg);
  formData.append('tires', params.tires);
  formData.append('position', params.position);
  formData.append('drivetrain', params.drivetrain);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to analyze ride');
  }

  return response.json();
};
