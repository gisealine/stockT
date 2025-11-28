import React from 'react';

const Statistics = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  const overall = stats.overall || {};

  return (
    <div>
      {overall.total_transactions > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>总交易次数</h3>
            <div className="value">{overall.total_transactions || 0}</div>
          </div>
          <div className="stat-card">
            <h3>总买入金额</h3>
            <div className="value">¥{formatCurrency(overall.total_buy_amount)}</div>
          </div>
          <div className="stat-card">
            <h3>总卖出金额</h3>
            <div className="value">¥{formatCurrency(overall.total_sell_amount)}</div>
          </div>
          <div className="stat-card">
            <h3>总盈亏</h3>
            <div 
              className="value"
              style={{ 
                color: parseFloat(overall.total_profit_loss || 0) >= 0 ? '#fff' : '#ffcccc' 
              }}
            >
              {parseFloat(overall.total_profit_loss || 0) >= 0 ? '+' : ''}
              ¥{formatCurrency(overall.total_profit_loss)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;

