export const API_BASE = '/api';

export const analyzeRide = async (file, params, auxFile = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (auxFile) {
    formData.append('aux_file', auxFile);
  }
  formData.append('rider_kg', params.rider_kg);
  formData.append('bike_kg', params.bike_kg);
  formData.append('tires', params.tires);
  formData.append('position', params.position);
  formData.append('drivetrain', params.drivetrain);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to analyze ride');
  }

  return response.json();
};
