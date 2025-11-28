# 股票交易记录系统

一个用于记录股票买卖并计算盈亏的前后端分离系统。

## 技术栈

- 前端：React
- 后端：Node.js (Express)
- 数据库：MySQL

## 功能特性

- 记录股票买入/卖出交易
- 自动计算每笔交易的盈亏
- 查看交易历史记录
- 支持多只股票管理

## 快速开始

详细的安装步骤请查看 [INSTALLATION.md](./INSTALLATION.md)

### 简要步骤：

1. **安装依赖**
```bash
npm run install-all
```

2. **配置数据库**
   - 创建 `.env` 文件并配置数据库连接信息（参考下面）
   - 初始化数据库：`mysql -u root -p < database/schema.sql`

3. **启动应用**
```bash
npm run dev
```

4. **访问应用**
   - 前端：http://localhost:3000
   - 后端API：http://localhost:5000

### .env 文件配置示例

在项目根目录创建 `.env` 文件：

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_trading
PORT=5000
```

将 `your_password` 替换为您的 MySQL 密码。

## 项目结构

```
stock/
├── client/          # React前端应用
├── server/          # Node.js后端服务器
├── database/        # 数据库脚本
└── package.json
```

