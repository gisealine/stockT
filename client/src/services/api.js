import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 交易记录API
export const transactionsAPI = {
  // 获取所有交易记录
  getAll: () => api.get('/transactions'),
  
  // 根据股票名称获取交易记录
  getByStock: (stockName) => api.get(`/transactions/stock/${encodeURIComponent(stockName)}`),
  
  // 获取单笔交易记录
  getById: (id) => api.get(`/transactions/${id}`),
  
  // 创建交易记录
  create: (data) => api.post('/transactions', data),
  
  // 更新交易记录
  update: (id, data) => api.put(`/transactions/${id}`, data),
  
  // 删除交易记录
  delete: (id) => api.delete(`/transactions/${id}`),
  
  // 获取盈亏统计
  getStats: () => api.get('/transactions/stats/profit-loss'),
};

// 股票API
export const stocksAPI = {
  // 获取所有股票
  getAll: () => api.get('/stocks'),
  
  // 获取单只股票
  getById: (id) => api.get(`/stocks/${id}`),
  
  // 获取股票详情（包含持仓和盈亏）
  getDetail: (name) => api.get(`/stocks/${encodeURIComponent(name)}/detail`),
  
  // 创建股票
  create: (data) => api.post('/stocks', data),
  
  // 更新股票
  update: (id, data) => api.put(`/stocks/${id}`, data),
  
  // 删除股票
  delete: (id) => api.delete(`/stocks/${id}`),
};

// 健康检查
export const healthCheck = () => api.get('/health');

export default api;

