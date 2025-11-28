import React, { useState, useEffect } from 'react';
import { stocksAPI, transactionsAPI } from '../services/api';
import { format } from 'date-fns';

const StockDetail = ({ stockName, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadDetail();
  }, [stockName]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await stocksAPI.getDetail(stockName);
      setDetail(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || '加载股票详情失败');
      console.error('加载股票详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  // 处理删除交易记录
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('确定要删除这条交易记录吗？删除后需要重新计算持仓和盈亏。')) {
      return;
    }
    try {
      setDeletingId(id);
      setError(null);
      await transactionsAPI.delete(id);
      // 重新加载详情
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || '删除交易记录失败');
      console.error('删除交易记录失败:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
        <button className="button" onClick={onBack} style={{ marginTop: '20px' }}>
          ← 返回
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="card">
        <div className="loading">未找到股票信息</div>
        <button className="button" onClick={onBack} style={{ marginTop: '20px' }}>
          ← 返回
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>{detail.stockName} - 详情</h2>
          <button className="button" onClick={onBack}>
            ← 返回
          </button>
        </div>

        {/* 已平仓盈亏 */}
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
          <h3>已平仓盈亏</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px' }}>
            <span className={detail.closedProfitLoss >= 0 ? 'profit' : 'loss'}>
              {detail.closedProfitLoss >= 0 ? '+' : ''}
              ¥{formatCurrency(detail.closedProfitLoss)}
            </span>
          </div>
        </div>

        {/* 当前持仓 */}
        <div style={{ marginBottom: '30px' }}>
          <h3>当前持仓</h3>
          {detail.positions && detail.positions.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '15px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>交易日期</th>
                    <th>类型</th>
                    <th>数量（股）</th>
                    <th>成交价格</th>
                    <th>总金额</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.positions.map((position) => {
                    const isShort = position.quantity < 0 || position.type === 'SHORT_SELL';
                    const quantity = Math.abs(position.quantity);
                    return (
                      <tr key={position.id}>
                        <td>{formatDate(position.date)}</td>
                        <td>
                          <span className={`badge ${isShort ? 'badge-short' : 'badge-buy'}`}>
                            {isShort ? '空仓' : '多仓'}
                          </span>
                        </td>
                        <td>{quantity}</td>
                        <td>¥{formatCurrency(position.price)}</td>
                        <td>¥{formatCurrency(position.totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: '15px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              暂无持仓
            </div>
          )}
        </div>

        {/* 开平仓明细 */}
        <div style={{ marginBottom: '30px' }}>
          <h3>开平仓明细</h3>
          {detail.closedPositions && detail.closedPositions.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '15px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>开仓日期</th>
                    <th>平仓日期</th>
                    <th>开仓价格</th>
                    <th>平仓价格</th>
                    <th>数量（股）</th>
                    <th>盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.closedPositions.map((closed, index) => (
                    <tr key={index}>
                      <td>
                        <span className={`badge ${closed.type === 'LONG' ? 'badge-buy' : 'badge-short'}`}>
                          {closed.type === 'LONG' ? '多仓' : '空仓'}
                        </span>
                      </td>
                      <td>{formatDate(closed.openDate)}</td>
                      <td>{formatDate(closed.closeDate)}</td>
                      <td>¥{formatCurrency(closed.openPrice)}</td>
                      <td>¥{formatCurrency(closed.closePrice)}</td>
                      <td>{closed.quantity}</td>
                      <td>
                        <span className={closed.profitLoss >= 0 ? 'profit' : 'loss'}>
                          {closed.profitLoss >= 0 ? '+' : ''}
                          ¥{formatCurrency(closed.profitLoss)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: '15px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              暂无已平仓记录
            </div>
          )}
        </div>

        {/* 成交记录明细 */}
        <div>
          <h3>成交记录明细</h3>
          {detail.transactions && detail.transactions.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '15px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th>数量（股）</th>
                    <th>价格</th>
                    <th>总金额</th>
                    <th>手续费</th>
                    <th>税费</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>
                        <span className={`badge ${transaction.transaction_type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                          {transaction.transaction_type === 'BUY' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td>{transaction.quantity}</td>
                      <td>¥{formatCurrency(transaction.price)}</td>
                      <td>¥{formatCurrency(transaction.total_amount)}</td>
                      <td>¥{formatCurrency(transaction.commission)}</td>
                      <td>¥{formatCurrency(transaction.tax)}</td>
                      <td>
                        <button
                          className="button button-danger"
                          style={{ padding: '5px 10px', fontSize: '14px' }}
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          disabled={deletingId === transaction.id}
                        >
                          {deletingId === transaction.id ? '删除中...' : '删除'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: '15px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              暂无成交记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetail;

