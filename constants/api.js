// Simple API constants — concrete local endpoints for development (localhost:3000)
// Named exports are simple strings (or functions for dynamic routes).

export const API_BASE = 'http://192.168.100.152:3000';

export const LOGIN = `${API_BASE}/v1/users/login`;
export const USERS = `${API_BASE}/v1/users`;
export const SHTABS = `${API_BASE}/v1/shtabs`;
export const ASSIGN_TO_SHTAB = (id) => `${API_BASE}/v1/shtabs/${id}/assign`;
export const LOCATIONS = `${API_BASE}/v1/locations`;
export const BATCH_LOCATIONS = `${API_BASE}/v1/batch`;

export default {
  API_BASE,
  LOGIN,
  USERS,
  SHTABS,
  ASSIGN_TO_SHTAB,
  LOCATIONS,
  BATCH_LOCATIONS,
};
