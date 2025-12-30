import axios from 'axios';

// 生产环境使用相对路径，开发环境使用 localhost
const getApiBaseUrl = () => {
  // 如果设置了环境变量，优先使用
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 生产环境（已构建）使用相对路径
  // 开发环境使用 localhost
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

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

// 股票公司行为API（分红、合股等）
export const stockCorporateActionsAPI = {
  // 获取所有公司行为记录
  getAll: () => api.get('/stock-corporate-actions'),
  
  // 根据股票名称获取公司行为记录
  getByStock: (stockName) => api.get(`/stock-corporate-actions/stock/${encodeURIComponent(stockName)}`),
  
  // 获取单条记录
  getById: (id) => api.get(`/stock-corporate-actions/${id}`),
  
  // 创建公司行为记录
  create: (data) => api.post('/stock-corporate-actions', data),
  
  // 更新公司行为记录
  update: (id, data) => api.put(`/stock-corporate-actions/${id}`, data),
  
  // 删除公司行为记录
  delete: (id) => api.delete(`/stock-corporate-actions/${id}`),
};

// 同步API
export const syncAPI = {
  // 同步交易记录（根据分红合股信息）
  syncTransactions: (stockName) => api.post(`/sync/${encodeURIComponent(stockName)}`),
};

// 健康检查
export const healthCheck = () => api.get('/health');

export default api;

