import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
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
