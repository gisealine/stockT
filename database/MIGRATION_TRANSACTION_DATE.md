# 交易日期字段迁移说明

## 概述

将 `transactions` 表中的 `transaction_date` 字段从 `DATE` 类型改为 `DATETIME` 类型，以支持精确到时分秒的交易时间记录。

## 迁移步骤

### 1. 备份数据库

在执行迁移前，请务必备份数据库：

```bash
mysqldump -u root -p stock_trading > stock_trading_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 执行迁移脚本

```bash
mysql -u root -p stock_trading < database/migrate_transaction_date_to_datetime.sql
```

或者在 MySQL 客户端中执行：

```sql
USE stock_trading;
SOURCE database/migrate_transaction_date_to_datetime.sql;
```

### 3. 验证迁移结果

检查字段类型是否已更改：

```sql
DESCRIBE transactions;
-- 或者
SHOW COLUMNS FROM transactions LIKE 'transaction_date';
```

应该看到 `transaction_date` 的类型为 `datetime`。

### 4. 检查现有数据

验证现有数据是否正确：

```sql
SELECT id, transaction_date, DATE(transaction_date) as date_only, TIME(transaction_date) as time_only
FROM transactions
LIMIT 10;
```

## 迁移脚本说明

迁移脚本 `migrate_transaction_date_to_datetime.sql` 会：

1. 检查当前字段类型
2. 如果字段类型是 `DATE`，则修改为 `DATETIME`
3. 更新现有数据，为只有日期的记录添加默认时间 `00:00:00`
4. 如果字段已经是 `DATETIME` 类型，则跳过修改

## 注意事项

1. **数据兼容性**：现有的日期数据会自动添加 `00:00:00` 作为默认时间
2. **索引**：`idx_transaction_date` 索引会自动更新，无需手动重建
3. **前端格式**：前端现在会发送 `yyyy-MM-dd HH:mm:ss` 格式的日期时间字符串
4. **后端处理**：后端代码无需修改，MySQL 会自动处理 DATETIME 类型的数据

## 回滚方案

如果需要回滚到 DATE 类型（不推荐，会丢失时间信息）：

```sql
-- 警告：这会丢失所有时间信息，只保留日期部分
ALTER TABLE transactions MODIFY COLUMN transaction_date DATE NOT NULL COMMENT '交易日期';
```

## 新数据库安装

如果是全新安装，直接使用更新后的 `schema.sql` 即可，字段类型已经是 `DATETIME`。

