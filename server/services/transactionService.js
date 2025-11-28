const db = require('../config/database');

class TransactionService {
  // 获取所有交易记录，按日期倒序
  async getAllTransactions() {
    const [rows] = await db.execute(
      `SELECT * FROM transactions ORDER BY transaction_date DESC, created_at DESC`
    );
    return rows;
  }

  // 根据ID获取交易记录
  async getTransactionById(id) {
    const [rows] = await db.execute(
      `SELECT * FROM transactions WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // 根据股票名称获取交易记录
  async getTransactionsByStock(stockName) {
    const [rows] = await db.execute(
      `SELECT * FROM transactions WHERE stock_name = ? ORDER BY transaction_date ASC, created_at ASC`,
      [stockName]
    );
    return rows;
  }

  // 计算当前持仓状态（排除某个交易记录，用于更新时）
  async getCurrentPositionExcluding(stockName, excludeId) {
    const [transactions] = await db.execute(
      `SELECT * FROM transactions 
       WHERE stock_name = ? AND id != ?
       ORDER BY transaction_date ASC, created_at ASC`,
      [stockName, excludeId]
    );

    return this.calculatePosition(transactions);
  }

  // 计算持仓状态的通用方法
  calculatePosition(transactions) {
    let longPosition = 0;
    let shortPosition = 0;

    const buyPositions = [];
    const sellPositions = [];

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓
        for (let i = 0; i < sellPositions.length && remainingBuyQty > 0; i++) {
          if (sellPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingBuyQty, sellPositions[i].quantity);
            sellPositions[i].quantity -= usedQty;
            remainingBuyQty -= usedQty;
          }
        }
        
        // 剩余的开多仓
        if (remainingBuyQty > 0) {
          longPosition += remainingBuyQty;
          buyPositions.push({
            id: trans.id,
            quantity: remainingBuyQty
          });
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓
        for (let i = 0; i < buyPositions.length && remainingSellQty > 0; i++) {
          if (buyPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingSellQty, buyPositions[i].quantity);
            buyPositions[i].quantity -= usedQty;
            remainingSellQty -= usedQty;
          }
        }
        
        // 剩余的开空仓
        if (remainingSellQty > 0) {
          shortPosition += remainingSellQty;
          sellPositions.push({
            id: trans.id,
            quantity: remainingSellQty
          });
        }
      }
    }

    return {
      longPosition: buyPositions.reduce((sum, p) => sum + p.quantity, 0),
      shortPosition: sellPositions.reduce((sum, p) => sum + p.quantity, 0)
    };
  }

  // 计算当前持仓状态（返回多仓数量和空仓数量）
  async getCurrentPosition(stockName) {
    const [transactions] = await db.execute(
      `SELECT * FROM transactions 
       WHERE stock_name = ? 
       ORDER BY transaction_date ASC, created_at ASC`,
      [stockName]
    );

    return this.calculatePosition(transactions);
  }

  // 创建交易记录并计算盈亏
  async createTransaction(data) {
    const {
      stock_name,
      transaction_type,
      quantity,
      price,
      transaction_date,
      notes
    } = data;

    // 验证必填字段
    if (!stock_name || !transaction_type || !quantity || !price || !transaction_date) {
      throw new Error('缺少必填字段');
    }

    if (!['BUY', 'SELL'].includes(transaction_type)) {
      throw new Error('交易类型必须是 BUY 或 SELL');
    }

    // 计算总金额
    const total_amount = (quantity * price).toFixed(2);

    // 获取当前持仓状态
    const position = await this.getCurrentPosition(stock_name);

    // 计算盈亏
    let profit_loss = 0;
    
    if (transaction_type === 'BUY') {
      // 买入：如果有空仓，先平空仓；剩余部分开多仓
      if (position.shortPosition > 0) {
        const closeShortQty = Math.min(quantity, position.shortPosition);
        profit_loss = await this.calculateProfitLossForCloseShort(stock_name, closeShortQty, price);
      }
      // 如果没有空仓或平仓后还有剩余，剩余部分开多仓，不计算盈亏
    } else if (transaction_type === 'SELL') {
      // 卖出：如果有多仓，先平多仓；剩余部分开空仓
      if (position.longPosition > 0) {
        const closeLongQty = Math.min(quantity, position.longPosition);
        profit_loss = await this.calculateProfitLossForCloseLong(stock_name, closeLongQty, price);
      }
      // 如果没有多仓或平仓后还有剩余，剩余部分开空仓，不计算盈亏
    }

    // 插入交易记录
    const [result] = await db.execute(
      `INSERT INTO transactions 
       (stock_name, transaction_type, quantity, price, transaction_date, total_amount, profit_loss, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [stock_name, transaction_type, quantity, price, transaction_date, total_amount, profit_loss, notes || null]
    );

    // 返回新创建的记录
    return await this.getTransactionById(result.insertId);
  }

  // 计算平多仓盈亏（FIFO方法：先进先出）
  async calculateProfitLossForCloseLong(stockName, closeQuantity, closePrice, excludeId = null) {
    // 获取所有交易记录（排除当前交易的记录），按时间顺序
    let query = `SELECT * FROM transactions WHERE stock_name = ?`;
    let params = [stockName];
    
    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }
    
    query += ` ORDER BY transaction_date ASC, created_at ASC`;
    
    const [transactions] = await db.execute(query, params);

    // 模拟FIFO，找出需要平的多仓对应的买入记录
    const buyPositions = []; // 当前多仓持仓记录 {id, quantity, price}
    const sellPositions = []; // 当前空仓持仓记录

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓
        for (let i = 0; i < sellPositions.length && remainingBuyQty > 0; i++) {
          if (sellPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingBuyQty, sellPositions[i].quantity);
            sellPositions[i].quantity -= usedQty;
            remainingBuyQty -= usedQty;
          }
        }
        
        // 剩余的开多仓
        if (remainingBuyQty > 0) {
          buyPositions.push({
            id: trans.id,
            quantity: remainingBuyQty,
            price: parseFloat(trans.price)
          });
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓（这部分已经在历史记录中平掉了）
        for (let i = 0; i < buyPositions.length && remainingSellQty > 0; i++) {
          if (buyPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingSellQty, buyPositions[i].quantity);
            buyPositions[i].quantity -= usedQty;
            remainingSellQty -= usedQty;
          }
        }
        
        // 剩余的开空仓
        if (remainingSellQty > 0) {
          sellPositions.push({
            id: trans.id,
            quantity: remainingSellQty,
            price: parseFloat(trans.price)
          });
        }
      }
    }

    // 计算平多仓的盈亏（使用最低成本法：选择买入价最低的，最大化收益）
    // 对买入持仓按价格排序（最低价在前）
    const sortedBuyPositions = [...buyPositions].sort((a, b) => a.price - b.price);
    
    let remainingCloseQty = closeQuantity;
    let totalCost = 0;

    for (const buyPos of sortedBuyPositions) {
      if (remainingCloseQty <= 0) break;
      const usedQty = Math.min(remainingCloseQty, buyPos.quantity);
      totalCost += usedQty * buyPos.price;
      remainingCloseQty -= usedQty;
    }

    const closeAmount = closeQuantity * closePrice;
    const profitLoss = closeAmount - totalCost;

    return parseFloat(profitLoss.toFixed(2));
  }

  // 计算平空仓盈亏（FIFO方法：先进先出）
  async calculateProfitLossForCloseShort(stockName, closeQuantity, closePrice, excludeId = null) {
    // 获取所有交易记录（排除当前交易的记录），按时间顺序
    let query = `SELECT * FROM transactions WHERE stock_name = ?`;
    let params = [stockName];
    
    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }
    
    query += ` ORDER BY transaction_date ASC, created_at ASC`;
    
    const [transactions] = await db.execute(query, params);

    // 模拟FIFO，找出需要平的空仓对应的卖出记录
    const buyPositions = []; // 当前多仓持仓记录
    const sellPositions = []; // 当前空仓持仓记录 {id, quantity, price}

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓（这部分已经在历史记录中平掉了）
        for (let i = 0; i < sellPositions.length && remainingBuyQty > 0; i++) {
          if (sellPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingBuyQty, sellPositions[i].quantity);
            sellPositions[i].quantity -= usedQty;
            remainingBuyQty -= usedQty;
          }
        }
        
        // 剩余的开多仓
        if (remainingBuyQty > 0) {
          buyPositions.push({
            id: trans.id,
            quantity: remainingBuyQty
          });
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓
        for (let i = 0; i < buyPositions.length && remainingSellQty > 0; i++) {
          if (buyPositions[i].quantity > 0) {
            const usedQty = Math.min(remainingSellQty, buyPositions[i].quantity);
            buyPositions[i].quantity -= usedQty;
            remainingSellQty -= usedQty;
          }
        }
        
        // 剩余的开空仓
        if (remainingSellQty > 0) {
          sellPositions.push({
            id: trans.id,
            quantity: remainingSellQty,
            price: parseFloat(trans.price)
          });
        }
      }
    }

    // 计算平空仓的盈亏（使用最低成本法：选择卖出价最高的，最大化收益）
    // 对空仓持仓按价格排序（最高价在前）
    const sortedSellPositions = [...sellPositions].sort((a, b) => b.price - a.price);
    
    let remainingCloseQty = closeQuantity;
    let totalRevenue = 0; // 开空仓时的收入

    for (const sellPos of sortedSellPositions) {
      if (remainingCloseQty <= 0) break;
      const usedQty = Math.min(remainingCloseQty, sellPos.quantity);
      totalRevenue += usedQty * sellPos.price;
      remainingCloseQty -= usedQty;
    }

    // 平空仓的成本 = 买入价格 * 数量
    const closeCost = closeQuantity * closePrice;
    // 平空仓盈亏 = 开空仓收入 - 平空仓成本
    const profitLoss = totalRevenue - closeCost;

    return parseFloat(profitLoss.toFixed(2));
  }

  // 更新交易记录
  async updateTransaction(id, data) {
    const existing = await this.getTransactionById(id);
    if (!existing) {
      return null;
    }

    const {
      stock_name,
      transaction_type,
      quantity,
      price,
      transaction_date,
      notes
    } = data;

    // 重新计算盈亏（需要考虑所有相关交易）
    let profit_loss = 0;
    const finalStockName = stock_name || existing.stock_name;
    const finalQuantity = quantity || existing.quantity;
    const finalPrice = price || existing.price;
    const finalType = transaction_type || existing.transaction_type;

    // 获取当前持仓状态（排除当前记录）
    const position = await this.getCurrentPositionExcluding(finalStockName, existing.id);

    if (finalType === 'BUY') {
      if (position.shortPosition > 0) {
        const closeShortQty = Math.min(finalQuantity, position.shortPosition);
        profit_loss = await this.calculateProfitLossForCloseShort(finalStockName, closeShortQty, finalPrice, existing.id);
      }
    } else if (finalType === 'SELL') {
      if (position.longPosition > 0) {
        const closeLongQty = Math.min(finalQuantity, position.longPosition);
        profit_loss = await this.calculateProfitLossForCloseLong(finalStockName, closeLongQty, finalPrice, existing.id);
      }
    }

    const total_amount = ((quantity || existing.quantity) * (price || existing.price)).toFixed(2);

    await db.execute(
      `UPDATE transactions SET
       stock_name = ?,
       transaction_type = ?,
       quantity = ?,
       price = ?,
       transaction_date = ?,
       total_amount = ?,
       profit_loss = ?,
       notes = ?
       WHERE id = ?`,
      [
        stock_name || existing.stock_name,
        transaction_type || existing.transaction_type,
        quantity || existing.quantity,
        price || existing.price,
        transaction_date || existing.transaction_date,
        total_amount,
        profit_loss,
        notes !== undefined ? notes : existing.notes,
        id
      ]
    );

    return await this.getTransactionById(id);
  }

  // 删除交易记录
  async deleteTransaction(id) {
    const existing = await this.getTransactionById(id);
    if (!existing) {
      return false;
    }

    await db.execute(`DELETE FROM transactions WHERE id = ?`, [id]);
    return true;
  }

  // 获取盈亏统计
  async getProfitLossStats() {
    // 按股票名称分组统计
    const [statsByStock] = await db.execute(
      `SELECT 
        stock_name,
        SUM(CASE WHEN transaction_type = 'BUY' THEN total_amount ELSE 0 END) as total_buy_amount,
        SUM(CASE WHEN transaction_type = 'SELL' THEN total_amount ELSE 0 END) as total_sell_amount,
        SUM(CASE WHEN transaction_type = 'BUY' THEN quantity ELSE 0 END) as total_buy_quantity,
        SUM(CASE WHEN transaction_type = 'SELL' THEN quantity ELSE 0 END) as total_sell_quantity,
        SUM(profit_loss) as total_profit_loss
       FROM transactions
       GROUP BY stock_name`
    );

    // 总体统计
    const [overall] = await db.execute(
      `SELECT 
        SUM(CASE WHEN transaction_type = 'BUY' THEN total_amount ELSE 0 END) as total_buy_amount,
        SUM(CASE WHEN transaction_type = 'SELL' THEN total_amount ELSE 0 END) as total_sell_amount,
        SUM(profit_loss) as total_profit_loss,
        COUNT(*) as total_transactions
       FROM transactions`
    );

    return {
      byStock: statsByStock,
      overall: overall[0]
    };
  }
}

module.exports = new TransactionService();

