import axios from 'axios';

const api = axios.create({
  baseURL: window.location.hostname === 'localhost' ? 'http://localhost:8000' : '/api',
});

// Easily export endpoints to be fetched globally
export const getAnalyticsSummary = async () => {
    const res = await api.get('/analytics/summary');
    return res.data;
};

export const getAuditResults = async () => {
    const res = await api.get('/audit/results');
    return res.data;
};

export default api;
