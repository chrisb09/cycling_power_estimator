export const API_BASE = '/api';

let unauthorizedCallback = null;

export const registerUnauthorizedCallback = (callback) => {
  unauthorizedCallback = callback;
};

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const apiFetch = async (url, options = {}, defaultErrorMessage = 'Request failed') => {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    const isAuthEndpoint = url.endsWith('/login') || url.endsWith('/register');
    if (!isAuthEndpoint && unauthorizedCallback) {
      unauthorizedCallback();
    }
  }

  if (!response.ok) {
    let message = defaultErrorMessage;
    try {
      const err = await response.json();
      if (err && err.detail) {
        message = err.detail;
      }
    } catch (e) {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response;
};

export const loginUser = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  const response = await apiFetch(`${API_BASE}/login`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, 'Login failed');
  return response.json();
};

export const registerUser = async (data) => {
  const response = await apiFetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Registration failed');
  return response.json();
};

export const fetchInviteDetails = async (key) => {
  const response = await apiFetch(`${API_BASE}/invites/${key}`, {}, 'Invite key not found or invalid');
  return response.json();
};

export const fetchMe = async () => {
  const response = await apiFetch(`${API_BASE}/me`, { headers: getHeaders() }, 'Failed to fetch user data');
  return response.json();
};

export const updateMe = async (data) => {
  const response = await apiFetch(`${API_BASE}/me`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to update user data');
  return response.json();
};

export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch(`${API_BASE}/me/picture`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData
  }, 'Failed to upload picture');
  return response.json();
};

export const selfPromote = async (code) => {
  const response = await apiFetch(`${API_BASE}/admin/self-promote`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_code: code })
  }, 'Promotion failed');
  return response.json();
};

export const fetchRides = async () => {
  const response = await apiFetch(`${API_BASE}/rides/`, { headers: getHeaders() }, 'Failed to fetch rides');
  return response.json();
};

export const deleteRide = async (rideId) => {
  const response = await apiFetch(`${API_BASE}/rides/${rideId}`, {
    method: 'DELETE',
    headers: getHeaders()
  }, 'Failed to delete ride');
  return response.json();
};

export const updateRide = async (rideId, data) => {
  const response = await apiFetch(`${API_BASE}/rides/${rideId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to update ride');
  return response.json();
};

export const fetchPublicRides = async (username) => {
  const response = await apiFetch(`${API_BASE}/rides/user/${username}`, { headers: getHeaders() }, 'Failed to fetch public rides or profile is private');
  return response.json();
};

export const fetchRideAnalysis = async (rideId, token = null) => {
  const url = token ? `${API_BASE}/rides/${rideId}/analyze?token=${token}` : `${API_BASE}/rides/${rideId}/analyze`;
  const response = await apiFetch(url, { headers: getHeaders() }, 'Failed to fetch ride analysis');
  return response.json();
};

// Admin Endpoints
export const adminFetchUsers = async () => {
  const response = await apiFetch(`${API_BASE}/admin/users`, { headers: getHeaders() }, 'Failed to fetch users');
  return response.json();
};

export const adminUpdateUserRole = async (userId, role) => {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  }, 'Failed to update role');
  return response.json();
};

export const adminUpdateUserStatus = async (userId, is_active) => {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active })
  }, 'Failed to update status');
  return response.json();
};

export const adminGenerateInvite = async () => {
  const response = await apiFetch(`${API_BASE}/admin/invites`, {
    method: 'POST',
    headers: getHeaders()
  }, 'Failed to generate invite');
  return response.json();
};

export const adminFetchInvites = async () => {
  const response = await apiFetch(`${API_BASE}/admin/invites`, { headers: getHeaders() }, 'Failed to fetch invites');
  return response.json();
};

export const adminNukeDatabase = async (nukeCode) => {
  const response = await apiFetch(`${API_BASE}/admin/nuke`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ nuke_code: nukeCode })
  }, 'Nuke failed');
  return response.json();
};

export const fetchBikes = async () => {
  const response = await apiFetch(`${API_BASE}/bikes/`, { headers: getHeaders() }, 'Failed to fetch bikes');
  return response.json();
};

export const createBike = async (data) => {
  const response = await apiFetch(`${API_BASE}/bikes/`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to create bike');
  return response.json();
};

export const updateBike = async (bikeId, data) => {
  const response = await apiFetch(`${API_BASE}/bikes/${bikeId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to update bike');
  return response.json();
};

export const deleteBike = async (bikeId) => {
  const response = await apiFetch(`${API_BASE}/bikes/${bikeId}`, {
    method: 'DELETE',
    headers: getHeaders()
  }, 'Failed to delete bike');
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
  if (params.visibility) formData.append('visibility', params.visibility);
  if (params.name) formData.append('name', params.name);
  if (params.bike_id) formData.append('bike_id', params.bike_id);

  const response = await apiFetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  }, 'Failed to analyze ride');

  return response.json();
};

export const reanalyzeSavedRide = async (rideId, params) => {
  const response = await apiFetch(`${API_BASE}/rides/${rideId}/reanalyze`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rider_kg: params.rider_kg,
      bike_kg: params.bike_kg,
      tires: params.tires,
      position: params.position,
      drivetrain: params.drivetrain
    }),
  }, 'Failed to re-analyze ride');

  return response.json();
};

export const fetchCollections = async () => {
  const response = await apiFetch(`${API_BASE}/collections/`, { headers: getHeaders() }, 'Failed to fetch collections');
  return response.json();
};

export const fetchUserCollections = async (username) => {
  const response = await apiFetch(`${API_BASE}/collections/user/${username}`, { headers: getHeaders() }, 'Failed to fetch collections');
  return response.json();
};

export const fetchCollection = async (collectionId, token = null) => {
  const url = token ? `${API_BASE}/collections/${collectionId}?token=${token}` : `${API_BASE}/collections/${collectionId}`;
  const response = await apiFetch(url, { headers: getHeaders() }, 'Failed to fetch collection');
  return response.json();
};

export const createCollection = async (data) => {
  const response = await apiFetch(`${API_BASE}/collections/`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to create collection');
  return response.json();
};

export const updateCollection = async (collectionId, data) => {
  const response = await apiFetch(`${API_BASE}/collections/${collectionId}`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, 'Failed to update collection');
  return response.json();
};

export const deleteCollection = async (collectionId) => {
  const response = await apiFetch(`${API_BASE}/collections/${collectionId}`, {
    method: 'DELETE',
    headers: getHeaders()
  }, 'Failed to delete collection');
  return response.json();
};

export const addRideToCollection = async (collectionId, rideId) => {
  const response = await apiFetch(`${API_BASE}/collections/${collectionId}/rides?ride_id=${rideId}`, {
    method: 'POST',
    headers: getHeaders()
  }, 'Failed to add ride to collection');
  return response.json();
};

export const removeRideFromCollection = async (collectionId, rideId) => {
  const response = await apiFetch(`${API_BASE}/collections/${collectionId}/rides/${rideId}`, {
    method: 'DELETE',
    headers: getHeaders()
  }, 'Failed to remove ride from collection');
  return response.json();
};

export const generateCollectionShareToken = async (collectionId) => {
  const response = await apiFetch(`${API_BASE}/collections/${collectionId}/share`, {
    method: 'POST',
    headers: getHeaders()
  }, 'Failed to generate share link');
  return response.json();
};
