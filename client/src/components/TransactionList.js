import React from 'react';
import { format } from 'date-fns';

const TransactionList = ({ transactions, onEdit, onDelete }) => {
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount).toFixed(2);
  };

  if (transactions.length === 0) {
    return <div className="loading">暂无交易记录，点击"添加交易记录"开始记录您的第一笔交易</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>日期</th>
            <th>股票名称</th>
            <th>类型</th>
            <th>数量</th>
            <th>价格</th>
            <th>总金额</th>
            <th>盈亏</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{formatDate(transaction.transaction_date)}</td>
              <td><strong>{transaction.stock_name}</strong></td>
              <td>
                <span className={`badge ${
                  transaction.transaction_type === 'BUY' ? 'badge-buy' : 'badge-sell'
                }`}>
                  {transaction.transaction_type === 'BUY' ? '买入' : '卖出'}
                </span>
              </td>
              <td>{transaction.quantity}</td>
              <td>¥{formatCurrency(transaction.price)}</td>
              <td>¥{formatCurrency(transaction.total_amount)}</td>
              <td>
                {transaction.profit_loss !== 0 && (
                  <span className={transaction.profit_loss >= 0 ? 'profit' : 'loss'}>
                    {transaction.profit_loss >= 0 ? '+' : ''}
                    ¥{formatCurrency(transaction.profit_loss)}
                  </span>
                )}
                {transaction.profit_loss === 0 && '-'}
              </td>
              <td>{transaction.notes || '-'}</td>
              <td>
                <button
                  className="button"
                  style={{ padding: '5px 10px', fontSize: '14px', marginRight: '5px' }}
                  onClick={() => onEdit(transaction)}
                >
                  编辑
                </button>
                <button
                  className="button button-danger"
                  style={{ padding: '5px 10px', fontSize: '14px' }}
                  onClick={() => onDelete(transaction.id)}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionList;

