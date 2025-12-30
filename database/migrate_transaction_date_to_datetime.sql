-- 数据库迁移脚本：将 transaction_date 字段从 DATE 改为 DATETIME
-- 用于支持精确到时分秒的交易时间
-- 注意：请在执行前备份数据库

USE stock_trading;

-- 检查字段类型
SET @col_type = (
    SELECT DATA_TYPE 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'transaction_date'
);

-- 如果字段类型是 DATE，则修改为 DATETIME
SET @sql = IF(@col_type = 'date', 
    'ALTER TABLE transactions MODIFY COLUMN transaction_date DATETIME NOT NULL COMMENT \'交易日期（包含时分秒）\'', 
    'SELECT CONCAT(\'字段类型已经是 \', @col_type, \'，无需修改\') AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 更新现有数据：将只有日期的数据添加默认时间 00:00:00
-- 注意：如果 transaction_date 已经是 DATETIME 类型，这个更新不会影响已有时间的数据
UPDATE transactions 
SET transaction_date = CONCAT(DATE(transaction_date), ' 00:00:00')
WHERE transaction_date IS NOT NULL 
AND TIME(transaction_date) = '00:00:00'
AND DATE(transaction_date) = transaction_date;

SELECT '迁移完成：transaction_date 字段已修改为 DATETIME 类型' AS result;

