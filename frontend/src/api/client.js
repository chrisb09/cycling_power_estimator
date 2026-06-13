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

export const renameRide = async (rideId, newName) => {
  const response = await fetch(`${API_BASE}/rides/${rideId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });
  if (!response.ok) throw new Error('Failed to rename ride');
  return response.json();
};

export const fetchRideAnalysis = async (rideId) => {
  const response = await fetch(`${API_BASE}/rides/${rideId}/analyze`, { headers: getHeaders() });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch ride analysis');
  }
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
