import React, { useState, useEffect } from 'react';
import TransactionForm from './components/TransactionForm';
import Statistics from './components/Statistics';
import StockManagement from './components/StockManagement';
import StockDetail from './components/StockDetail';
import { transactionsAPI, stocksAPI } from './services/api';
import './App.css';

// 页面类型
const PAGE_TYPES = {
  TRANSACTIONS: 'transactions',
  STOCK_MANAGEMENT: 'stock_management',
  STOCK_DETAIL: 'stock_detail',
};

function App() {
  const [currentPage, setCurrentPage] = useState(PAGE_TYPES.TRANSACTIONS);
  const [selectedStockName, setSelectedStockName] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [stockStats, setStockStats] = useState({});
  const [loading, setLoading] = useState(false);

  // 加载统计数据
  const loadStats = async () => {
    try {
      const response = await transactionsAPI.getStats();
      setStats(response.data.data || null);
    } catch (err) {
      console.error('加载统计数据失败:', err);
    }
  };

  // 加载股票列表和统计
  const loadStocksAndStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stocksResponse, statsResponse] = await Promise.all([
        stocksAPI.getAll(),
        transactionsAPI.getStats(),
      ]);
      setStocks(stocksResponse.data.data || []);
      setStats(statsResponse.data.data || null);
      
      // 将统计按股票名称索引
      const statsByStock = {};
      if (statsResponse.data.data?.byStock) {
        statsResponse.data.data.byStock.forEach((stat) => {
          statsByStock[stat.stock_name] = stat;
        });
      }
      setStockStats(statsByStock);
    } catch (err) {
      setError(err.response?.data?.message || '加载数据失败');
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPage === PAGE_TYPES.TRANSACTIONS) {
      loadStats();
      loadStocksAndStats();
    }
  }, [currentPage]);

  // 处理添加/编辑交易记录
  const handleSave = async (transactionData) => {
    try {
      setError(null);
      if (editingTransaction) {
        await transactionsAPI.update(editingTransaction.id, transactionData);
      } else {
        await transactionsAPI.create(transactionData);
      }
      // 清除编辑状态
      setEditingTransaction(null);
      // 重新加载统计和股票列表
      await loadStats();
      await loadStocksAndStats();
    } catch (err) {
      setError(err.response?.data?.message || '保存交易记录失败');
      throw err;
    }
  };

  // 取消表单
  const handleCancel = () => {
    setEditingTransaction(null);
  };

  // 导航处理
  const handleNavigateToStockManagement = () => {
    setCurrentPage(PAGE_TYPES.STOCK_MANAGEMENT);
  };

  const handleNavigateToTransactions = () => {
    setCurrentPage(PAGE_TYPES.TRANSACTIONS);
  };

  const handleViewStockDetail = (stockName) => {
    setSelectedStockName(stockName);
    setCurrentPage(PAGE_TYPES.STOCK_DETAIL);
  };

  // 渲染当前页面
  const renderCurrentPage = () => {
    switch (currentPage) {
      case PAGE_TYPES.STOCK_MANAGEMENT:
        return <StockManagement onBack={handleNavigateToTransactions} />;
      
      case PAGE_TYPES.STOCK_DETAIL:
        return <StockDetail stockName={selectedStockName} onBack={handleNavigateToTransactions} />;
      
      case PAGE_TYPES.TRANSACTIONS:
      default:
        return (
          <>
            {/* 总体统计 */}
            <Statistics stats={stats} />

            {/* 交易表单 - 直接显示 */}
            <div className="card" style={{ marginBottom: '30px' }}>
              <h2>{editingTransaction ? '编辑交易记录' : '添加交易记录'}</h2>
              <TransactionForm
                transaction={editingTransaction}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            </div>

            {/* 股票列表 */}
            <div className="card">
              <h2>股票列表</h2>
              {loading ? (
                <div className="loading">加载中...</div>
              ) : stocks.length === 0 ? (
                <div className="loading">暂无股票，请先在股票管理中添加股票</div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>股票名称</th>
                        <th>买入金额</th>
                        <th>卖出金额</th>
                        <th>累计盈亏</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map((stock) => {
                        const stat = stockStats[stock.name] || {};
                        const formatCurrency = (amount) => {
                          if (!amount) return '0.00';
                          return parseFloat(amount).toFixed(2);
                        };
                        return (
                          <tr key={stock.id}>
                            <td><strong>{stock.name}</strong></td>
                            <td>¥{formatCurrency(stat.total_buy_amount)}</td>
                            <td>¥{formatCurrency(stat.total_sell_amount)}</td>
                            <td>
                              <span className={stat.total_profit_loss >= 0 ? 'profit' : 'loss'}>
                                {stat.total_profit_loss >= 0 ? '+' : ''}
                                ¥{formatCurrency(stat.total_profit_loss)}
                              </span>
                            </td>
                            <td>
                              <button
                                className="button button-success"
                                style={{ padding: '5px 10px', fontSize: '14px' }}
                                onClick={() => handleViewStockDetail(stock.name)}
                              >
                                查看详情
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <h1>📈 股票交易记录系统</h1>
          <p>记录您的股票买卖，自动计算盈亏</p>
        </div>

        {/* 导航菜单 */}
        {currentPage === PAGE_TYPES.TRANSACTIONS && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="button" onClick={handleNavigateToStockManagement}>
                📋 股票管理
              </button>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default App;

