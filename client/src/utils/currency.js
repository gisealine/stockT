// 根据股票类型获取货币符号
export const getCurrencySymbol = (stockType) => {
  if (!stockType) return '¥'; // 默认人民币
  
  // 股票类型可能是数字（1=A股, 2=港股, 3=美股）或文本
  if (typeof stockType === 'number') {
    switch (stockType) {
      case 1: return '¥'; // A股 - 人民币
      case 2: return 'HK$'; // 港股 - 港元
      case 3: return '$'; // 美股 - 美元
      default: return '¥';
    }
  }
  
  // 文本类型
  if (stockType === 'A股') return '¥';
  if (stockType === '港股') return 'HK$';
  if (stockType === '美股') return '$';
  
  return '¥'; // 默认
};

// 格式化货币金额
export const formatCurrency = (amount, stockType = null) => {
  if (amount === null || amount === undefined) return '0.00';
  const formatted = parseFloat(amount).toFixed(2);
  if (stockType) {
    return `${getCurrencySymbol(stockType)}${formatted}`;
  }
  return formatted;
};

// 格式化金额（带货币符号）
export const formatAmount = (amount, stockType = null) => {
  if (amount === null || amount === undefined) return '0.00';
  const symbol = stockType ? getCurrencySymbol(stockType) : '¥';
  return `${symbol}${parseFloat(amount).toFixed(2)}`;
};

