-- 创建数据库
drop database if exists stock_trading;

CREATE DATABASE IF NOT EXISTS stock_trading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE stock_trading;

-- 创建股票表
CREATE TABLE IF NOT EXISTS stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '股票名称',
    stock_type TINYINT NOT NULL DEFAULT 1 COMMENT '股票类型：1=A股, 2=港股, 3=美股',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_name (name),
    INDEX idx_stock_type (stock_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='股票表';

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_name VARCHAR(100) NOT NULL COMMENT '股票名称',
    transaction_type ENUM('BUY', 'SELL') NOT NULL COMMENT '交易类型：买入/卖出',
    quantity INT NOT NULL COMMENT '交易数量（股）',
    price DECIMAL(10, 2) NOT NULL COMMENT '交易价格',
    transaction_date DATE NOT NULL COMMENT '交易日期',
    total_amount DECIMAL(12, 2) NOT NULL COMMENT '交易总金额',
    commission DECIMAL(12, 2) DEFAULT 0 COMMENT '手续费',
    tax DECIMAL(12, 2) DEFAULT 0 COMMENT '税费',
    profit_loss DECIMAL(12, 2) DEFAULT 0 COMMENT '盈亏金额',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_stock_name (stock_name),
    INDEX idx_transaction_date (transaction_date),
    FOREIGN KEY (stock_name) REFERENCES stocks(name) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='股票交易记录表';

-- 创建股票公司行为表（分红、合股等）
CREATE TABLE IF NOT EXISTS stock_corporate_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_name VARCHAR(100) NOT NULL COMMENT '股票名称',
    action_type ENUM('DIVIDEND', 'SPLIT', 'REVERSE_SPLIT') NOT NULL COMMENT '行为类型：DIVIDEND=分红, SPLIT=合股/拆股, REVERSE_SPLIT=反向合股',
    action_date DATE NOT NULL COMMENT '行为日期',
    ratio DECIMAL(10, 4) DEFAULT NULL COMMENT '合股比例（如1:2表示2股合1股，1:0.5表示1股拆成2股）',
    amount DECIMAL(12, 5) DEFAULT NULL COMMENT '分红金额（每股）',
    total_amount DECIMAL(12, 2) DEFAULT NULL COMMENT '总分红金额',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_stock_name (stock_name),
    INDEX idx_action_date (action_date),
    INDEX idx_action_type (action_type),
    FOREIGN KEY (stock_name) REFERENCES stocks(name) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='股票公司行为表（分红、合股等）';

