import React, { useState, useEffect } from 'react';
import { stocksAPI, transactionsAPI } from '../services/api';

const StockList = ({ onBack, onViewDetail }) => {
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 加载股票列表和统计
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stocksResponse, statsResponse] = await Promise.all([
        stocksAPI.getAll(),
        transactionsAPI.getStats(),
      ]);
      setStocks(stocksResponse.data.data || []);
      
      // 将统计按股票名称索引
      const statsByStock = {};
      if (statsResponse.data.data?.byStock) {
        statsResponse.data.data.byStock.forEach((stat) => {
          statsByStock[stat.stock_name] = stat;
        });
      }
      setStats(statsByStock);
    } catch (err) {
      setError(err.response?.data?.message || '加载数据失败');
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>股票列表</h2>
          <button className="button" onClick={onBack}>
            ← 返回
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading">加载中...</div>
        ) : stocks.length === 0 ? (
          <div className="loading">暂无股票，请先在股票管理中添加股票</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
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
                  const stat = stats[stock.name] || {};
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
                          onClick={() => onViewDetail(stock.name)}
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
    </div>
  );
};

export default StockList;

