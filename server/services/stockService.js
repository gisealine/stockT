const db = require('../config/database');

class StockService {
  // 获取所有股票
  async getAllStocks() {
    const [rows] = await db.execute(
      `SELECT * FROM stocks ORDER BY name ASC`
    );
    return rows;
  }

  // 根据ID获取股票
  async getStockById(id) {
    const [rows] = await db.execute(
      `SELECT * FROM stocks WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // 根据名称获取股票
  async getStockByName(name) {
    const [rows] = await db.execute(
      `SELECT * FROM stocks WHERE name = ?`,
      [name]
    );
    return rows[0] || null;
  }

  // 创建股票
  async createStock(data) {
    const { name } = data;

    if (!name || !name.trim()) {
      throw new Error('股票名称不能为空');
    }

    // 检查是否已存在
    const existing = await this.getStockByName(name.trim());
    if (existing) {
      throw new Error('股票名称已存在');
    }

    const [result] = await db.execute(
      `INSERT INTO stocks (name) VALUES (?)`,
      [name.trim()]
    );

    return await this.getStockById(result.insertId);
  }

  // 更新股票
  async updateStock(id, data) {
    const existing = await this.getStockById(id);
    if (!existing) {
      return null;
    }

    const { name } = data;

    if (!name || !name.trim()) {
      throw new Error('股票名称不能为空');
    }

    // 检查新名称是否已被其他股票使用
    const existingByName = await this.getStockByName(name.trim());
    if (existingByName && existingByName.id !== id) {
      throw new Error('股票名称已被使用');
    }

    await db.execute(
      `UPDATE stocks SET name = ? WHERE id = ?`,
      [name.trim(), id]
    );

    return await this.getStockById(id);
  }

  // 删除股票
  async deleteStock(id) {
    const existing = await this.getStockById(id);
    if (!existing) {
      return false;
    }

    // 检查是否有交易记录关联
    const [transactions] = await db.execute(
      `SELECT COUNT(*) as count FROM transactions WHERE stock_name = ?`,
      [existing.name]
    );

    if (transactions[0].count > 0) {
      throw new Error('该股票存在交易记录，无法删除');
    }

    await db.execute(`DELETE FROM stocks WHERE id = ?`, [id]);
    return true;
  }

  // 获取股票详情（包含持仓和盈亏信息）
  async getStockDetail(stockName) {
    // 获取所有交易记录
    const [transactions] = await db.execute(
      `SELECT * FROM transactions 
       WHERE stock_name = ? 
       ORDER BY transaction_date ASC, created_at ASC`,
      [stockName]
    );

    // 计算当前持仓
    // 使用最低成本法：买入先平空仓再开多仓（选择最高价空仓先平），卖出先平多仓再开空仓（选择最低价多仓先平）
    let currentPosition = 0; // 正数表示多仓，负数表示空仓
    const buyPositions = []; // 多仓持仓记录（按价格从低到高排序）
    const sellPositions = []; // 空仓持仓记录（按价格从高到低排序）

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓（选择卖出价最高的，最大化收益）
        while (remainingBuyQty > 0 && sellPositions.length > 0) {
          // 找到卖出价最高的空仓
          let maxPriceIndex = -1;
          let maxPrice = -1;
          for (let i = 0; i < sellPositions.length; i++) {
            if (sellPositions[i].quantity > 0 && sellPositions[i].price > maxPrice) {
              maxPrice = sellPositions[i].price;
              maxPriceIndex = i;
            }
          }
          
          if (maxPriceIndex === -1) break;
          
          const shortPos = sellPositions[maxPriceIndex];
          const usedQty = Math.min(remainingBuyQty, shortPos.quantity);
          
          shortPos.quantity -= usedQty;
          if (shortPos.quantity <= 0) {
            sellPositions.splice(maxPriceIndex, 1);
          }
          remainingBuyQty -= usedQty;
        }
        
        // 剩余的开多仓（按价格从低到高排序，以便后续选择最低价先平）
        if (remainingBuyQty > 0) {
          const newPos = {
            id: trans.id,
            type: 'BUY',
            quantity: remainingBuyQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            totalAmount: remainingBuyQty * parseFloat(trans.price),
          };
          
          // 插入到合适位置（按价格从低到高排序）
          let inserted = false;
          for (let i = 0; i < buyPositions.length; i++) {
            if (newPos.price < buyPositions[i].price) {
              buyPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            buyPositions.push(newPos);
          }
          currentPosition += remainingBuyQty;
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓（选择买入价最低的，最大化收益）
        while (remainingSellQty > 0 && buyPositions.length > 0) {
          // 买入价最低的在数组最前面（已经排序）
          if (buyPositions[0].quantity <= 0) {
            buyPositions.shift();
            continue;
          }
          
          const longPos = buyPositions[0];
          const usedQty = Math.min(remainingSellQty, longPos.quantity);
          
          longPos.quantity -= usedQty;
          if (longPos.quantity <= 0) {
            buyPositions.shift();
          }
          remainingSellQty -= usedQty;
        }
        
        // 剩余的开空仓（按价格从高到低排序，以便后续选择最高价先平）
        if (remainingSellQty > 0) {
          const newPos = {
            id: trans.id,
            type: 'SHORT_SELL', // 标记为空仓
            quantity: remainingSellQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            totalAmount: remainingSellQty * parseFloat(trans.price),
          };
          
          // 插入到合适位置（按价格从高到低排序）
          let inserted = false;
          for (let i = 0; i < sellPositions.length; i++) {
            if (newPos.price > sellPositions[i].price) {
              sellPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            sellPositions.push(newPos);
          }
          currentPosition -= remainingSellQty;
        }
      }
    }

    // 合并当前持仓（多仓和空仓）
    const currentPositions = [
      ...buyPositions.filter(p => p.quantity > 0),
      ...sellPositions.filter(p => p.quantity > 0).map(p => ({
        ...p,
        quantity: -p.quantity, // 负数表示空仓
      }))
    ];

    // 计算已平仓的盈亏和开平仓明细
    const closedProfitLossResult = this.calculateClosedProfitLossAndDetails(transactions);
    const closedProfitLoss = closedProfitLossResult.totalProfitLoss;
    const closedPositions = closedProfitLossResult.closedPositions;

    return {
      stockName,
      currentPosition: buyPositions.reduce((sum, p) => sum + p.quantity, 0) - sellPositions.reduce((sum, p) => sum + p.quantity, 0),
      positions: currentPositions,
      closedProfitLoss: parseFloat(closedProfitLoss.toFixed(2)),
      closedPositions: closedPositions, // 开平仓明细
      transactions: transactions.map(t => ({
        ...t,
        price: parseFloat(t.price),
        total_amount: parseFloat(t.total_amount)
      })).sort((a, b) => {
        // 按日期倒序排列（最新的在前），如果日期相同则按创建时间倒序
        const dateA = new Date(a.transaction_date);
        const dateB = new Date(b.transaction_date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        // 如果日期相同，按创建时间倒序
        const createdA = new Date(a.created_at || 0);
        const createdB = new Date(b.created_at || 0);
        return createdB.getTime() - createdA.getTime();
      }), // 成交记录明细，按日期倒序
    };
  }

  // 计算已平仓的盈亏和开平仓明细（使用最低成本法最大化收益）
  calculateClosedProfitLossAndDetails(transactions) {
    const buyPositions = []; // 可用买入持仓 {id, quantity, price, date}
    const sellPositions = []; // 可用卖出持仓（空仓） {id, quantity, price, date}
    const closedPositions = []; // 已平仓明细

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓（优先选择卖出价最高的，最大化收益）
        while (remainingBuyQty > 0 && sellPositions.length > 0) {
          // 找到卖出价最高的空仓
          let maxPriceIndex = -1;
          let maxPrice = -1;
          for (let i = 0; i < sellPositions.length; i++) {
            if (sellPositions[i].quantity > 0 && sellPositions[i].price > maxPrice) {
              maxPrice = sellPositions[i].price;
              maxPriceIndex = i;
            }
          }
          
          if (maxPriceIndex === -1) break;
          
          const shortPos = sellPositions[maxPriceIndex];
          const usedQty = Math.min(remainingBuyQty, shortPos.quantity);
          
          // 计算平空仓盈亏
          const profitLoss = (shortPos.price - parseFloat(trans.price)) * usedQty;
          
          closedPositions.push({
            openDate: shortPos.date,
            closeDate: trans.transaction_date,
            openPrice: shortPos.price,
            closePrice: parseFloat(trans.price),
            quantity: usedQty,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            type: 'SHORT' // 卖空
          });
          
          shortPos.quantity -= usedQty;
          if (shortPos.quantity <= 0) {
            sellPositions.splice(maxPriceIndex, 1);
          }
          remainingBuyQty -= usedQty;
        }
        
        // 剩余的开多仓（按价格排序，最低价的在前）
        if (remainingBuyQty > 0) {
          const newPos = {
            id: trans.id,
            quantity: remainingBuyQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date
          };
          
          // 插入到合适位置（按价格从低到高排序）
          let inserted = false;
          for (let i = 0; i < buyPositions.length; i++) {
            if (newPos.price < buyPositions[i].price) {
              buyPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            buyPositions.push(newPos);
          }
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓（优先选择买入价最低的，最大化收益）
        while (remainingSellQty > 0 && buyPositions.length > 0) {
          // 找到买入价最低的多仓（第一个就是最低的，因为已经排序）
          if (buyPositions[0].quantity <= 0) {
            buyPositions.shift();
            continue;
          }
          
          const longPos = buyPositions[0];
          const usedQty = Math.min(remainingSellQty, longPos.quantity);
          
          // 计算平多仓盈亏
          const profitLoss = (parseFloat(trans.price) - longPos.price) * usedQty;
          
          closedPositions.push({
            openDate: longPos.date,
            closeDate: trans.transaction_date,
            openPrice: longPos.price,
            closePrice: parseFloat(trans.price),
            quantity: usedQty,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            type: 'LONG' // 多仓
          });
          
          longPos.quantity -= usedQty;
          if (longPos.quantity <= 0) {
            buyPositions.shift();
          }
          remainingSellQty -= usedQty;
        }
        
        // 剩余的开空仓（按价格排序，最高价的在前）
        if (remainingSellQty > 0) {
          const newPos = {
            id: trans.id,
            quantity: remainingSellQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date
          };
          
          // 插入到合适位置（按价格从高到低排序）
          let inserted = false;
          for (let i = 0; i < sellPositions.length; i++) {
            if (newPos.price > sellPositions[i].price) {
              sellPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            sellPositions.push(newPos);
          }
        }
      }
    }

    const totalProfitLoss = closedPositions.reduce((sum, p) => sum + p.profitLoss, 0);

    return {
      totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
      closedPositions: closedPositions.sort((a, b) => {
        // 按平仓日期排序
        const dateA = new Date(a.closeDate);
        const dateB = new Date(b.closeDate);
        if (dateA !== dateB) return dateB - dateA; // 最新的在前
        return 0;
      })
    };
  }
}

module.exports = new StockService();

