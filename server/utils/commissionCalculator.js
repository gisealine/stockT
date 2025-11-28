/**
 * 手续费和税费计算工具
 * 统一处理不同股票类型的手续费和税费计算逻辑
 */

/**
 * 计算手续费和税费
 * @param {string} stockType - 股票类型：'A股'、'港股'、'美股'
 * @param {string} transactionType - 交易类型：'BUY'、'SELL'
 * @param {number} totalAmount - 交易总金额
 * @param {number|null} commission - 手动输入的手续费（仅美股使用，可选）
 * @returns {{commission: number, tax: number}} 手续费和税费
 */
function calculateCommissionAndTax(stockType, transactionType, totalAmount, commission = null) {
  let calculatedCommission = 0;
  let calculatedTax = 0;

  if (stockType === 'A股') {
    // A股：手续费万1.5（买入卖出都收），税费万分之5（只有卖出收）
    calculatedCommission = totalAmount * 0.00015; // 万1.5
    if (transactionType === 'SELL') {
      calculatedTax = totalAmount * 0.00005; // 万分之5
    }
  } else if (stockType === '港股') {
    // 港股：手续费万2（买入卖出都收），税费千分之1（买入卖出都收）
    calculatedCommission = totalAmount * 0.0002; // 万2
    calculatedTax = totalAmount * 0.001; // 千分之1
  } else if (stockType === '美股') {
    // 美股：手续费手动输入，税费不需要
    calculatedCommission = commission || 0;
    calculatedTax = 0;
  }

  return {
    commission: parseFloat(calculatedCommission.toFixed(2)),
    tax: parseFloat(calculatedTax.toFixed(2))
  };
}

module.exports = {
  calculateCommissionAndTax
};

