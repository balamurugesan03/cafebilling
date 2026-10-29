import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bb_token');
  const branch = localStorage.getItem('bb_branch');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (branch && !config.headers['x-branch-id']) config.headers['x-branch-id'] = branch;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('bb_token');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export const toastErr = (e) => toast.error(errMsg(e));

export default api;
