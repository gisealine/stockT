const db = require('../config/database');
const transactionService = require('./transactionService');

class SyncService {
  /**
   * 根据分红合股信息同步交易记录
   * 只修改分红/合股执行日期之前的交易记录
   * - 分红：只影响价格（除息效应），价格 = 原价格 - 每股分红金额
   * - 拆股/合股：影响数量和价格
   * - 不影响手续费和税费
   * @param {string} stockName - 股票名称
   * @returns {Promise<{updated: number, message: string}>}
   */
  async syncTransactionsByCorporateActions(stockName) {
    // 获取所有公司行为记录，按日期正序（从早到晚）
    const [corporateActions] = await db.execute(
      `SELECT * FROM stock_corporate_actions 
       WHERE stock_name = ? 
       ORDER BY action_date ASC, created_at ASC`,
      [stockName]
    );

    if (corporateActions.length === 0) {
      return { updated: 0, message: '该股票没有分红或合股记录' };
    }

    // 获取所有交易记录
    const transactions = await transactionService.getTransactionsByStock(stockName);
    
    if (transactions.length === 0) {
      return { updated: 0, message: '该股票没有交易记录' };
    }

    // 初始化所有交易记录的原始值（如果还没有）
    for (const trans of transactions) {
      if (trans.original_quantity === null || trans.original_price === null) {
        await db.execute(
          `UPDATE transactions 
           SET original_quantity = ?, original_price = ? 
           WHERE id = ?`,
          [trans.quantity, trans.price, trans.id]
        );
      }
    }

    // 重新获取交易记录以获取原始值
    let transactionsWithOriginal = await transactionService.getTransactionsByStock(stockName);

    // 筛选出所有需要处理的公司行为记录（分红、拆股、合股），按时间正序
    const actionsToProcess = corporateActions
      .filter(action => {
        if (action.action_type === 'DIVIDEND') {
          return action.amount && parseFloat(action.amount) > 0;
        } else if (action.action_type === 'SPLIT' || action.action_type === 'REVERSE_SPLIT') {
          return action.ratio && parseFloat(action.ratio) > 0;
        }
        return false;
      })
      .sort((a, b) => {
        const dateA = new Date(a.action_date);
        const dateB = new Date(b.action_date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        return new Date(a.created_at) - new Date(b.created_at);
      });

    let updatedCount = 0;

    // 对每个交易记录，应用所有在该交易日期之后的公司行为
    for (const trans of transactionsWithOriginal) {
      const transDate = new Date(trans.transaction_date);
      
      // 找到该交易日期之后的所有公司行为
      const actionsAfterTransaction = actionsToProcess.filter(action => {
        const actionDate = new Date(action.action_date);
        return actionDate > transDate;
      });

      if (actionsAfterTransaction.length === 0) {
        // 没有后续的公司行为，恢复到原始值
        if (trans.quantity !== trans.original_quantity || 
            Math.abs(parseFloat(trans.price) - parseFloat(trans.original_price || trans.price)) > 0.01) {
          // 需要恢复到原始值
          const originalQty = trans.original_quantity || trans.quantity;
          const originalPrice = parseFloat(trans.original_price || trans.price);
          const originalTotalAmount = parseFloat((originalQty * originalPrice).toFixed(2));
          
          await db.execute(
            `UPDATE transactions 
             SET quantity = ?, price = ?, total_amount = ?
             WHERE id = ?`,
            [originalQty, originalPrice, originalTotalAmount, trans.id]
          );
          updatedCount++;
        }
        continue;
      }

      // 从原始值开始，依次应用所有后续的公司行为
      let currentQty = trans.original_quantity || trans.quantity;
      let currentPrice = parseFloat(trans.original_price || trans.price);

      for (const action of actionsAfterTransaction) {
        if (action.action_type === 'DIVIDEND') {
          // 分红：只影响价格，不影响数量
          // 除息：价格 = 原价格 - 每股分红金额
          const dividendAmount = parseFloat(action.amount);
          currentPrice = parseFloat((currentPrice - dividendAmount).toFixed(2));
          // 确保价格不为负
          if (currentPrice < 0) {
            currentPrice = 0;
          }
        } else if (action.action_type === 'SPLIT' || action.action_type === 'REVERSE_SPLIT') {
          // 拆股/合股：数量和价格都影响
          const ratio = parseFloat(action.ratio);
          // 应用拆股/合股：数量 = 原数量 / ratio，价格 = 原价格 * ratio
          currentQty = Math.round(currentQty / ratio);
          currentPrice = parseFloat((currentPrice * ratio).toFixed(2));
        }
      }

      // 重新计算总金额
      const newTotalAmount = parseFloat((currentQty * currentPrice).toFixed(2));

      // 检查是否需要更新
      if (currentQty !== trans.quantity || 
          Math.abs(currentPrice - parseFloat(trans.price)) > 0.01) {
        // 更新交易记录的数量、价格和总金额（不更新手续费、税费、盈亏）
        await db.execute(
          `UPDATE transactions 
           SET quantity = ?, price = ?, total_amount = ?
           WHERE id = ?`,
          [currentQty, currentPrice, newTotalAmount, trans.id]
        );
        updatedCount++;
      }
    }

    return { 
      updated: updatedCount, 
      message: `成功同步 ${updatedCount} 条交易记录的数量和价格（分红除息、拆股/合股已应用，手续费和税费保持不变）` 
    };
  }
}

module.exports = new SyncService();

