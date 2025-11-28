# 项目结构说明

```
stock/
├── client/                          # React 前端应用
│   ├── public/
│   │   └── index.html              # HTML 模板
│   ├── src/
│   │   ├── components/             # React 组件
│   │   │   ├── TransactionList.js  # 交易记录列表组件
│   │   │   ├── TransactionForm.js  # 交易记录表单组件
│   │   │   └── Statistics.js       # 统计信息组件
│   │   ├── services/
│   │   │   └── api.js              # API 服务封装
│   │   ├── App.js                  # 主应用组件
│   │   ├── App.css                 # 应用样式
│   │   ├── index.js                # 入口文件
│   │   └── index.css               # 全局样式
│   └── package.json                # 前端依赖配置
│
├── server/                          # Node.js 后端服务器
│   ├── config/
│   │   └── database.js             # 数据库连接配置
│   ├── routes/
│   │   └── transactions.js         # 交易记录路由
│   ├── services/
│   │   └── transactionService.js   # 交易记录业务逻辑
│   └── index.js                    # 服务器入口文件
│
├── database/
│   └── schema.sql                  # 数据库表结构
│
├── package.json                     # 后端依赖配置
├── README.md                        # 项目说明
├── INSTALLATION.md                  # 安装指南
├── FEATURES.md                      # 功能说明
└── .gitignore                       # Git 忽略文件

```

## 技术栈

### 前端
- **React 18**: UI 框架
- **Axios**: HTTP 客户端
- **React DatePicker**: 日期选择组件
- **date-fns**: 日期处理库

### 后端
- **Node.js**: 运行时环境
- **Express**: Web 框架
- **MySQL2**: MySQL 数据库驱动
- **CORS**: 跨域资源共享
- **dotenv**: 环境变量管理

### 数据库
- **MySQL**: 关系型数据库

## 关键文件说明

### 后端核心文件

- `server/index.js`: Express 服务器入口，配置中间件和路由
- `server/config/database.js`: MySQL 连接池配置
- `server/routes/transactions.js`: 交易记录的 RESTful API 路由
- `server/services/transactionService.js`: 业务逻辑层，包含盈亏计算（FIFO方法）

### 前端核心文件

- `client/src/App.js`: 主应用组件，管理状态和路由
- `client/src/components/TransactionList.js`: 显示交易记录列表
- `client/src/components/TransactionForm.js`: 交易记录表单（添加/编辑）
- `client/src/components/Statistics.js`: 显示盈亏统计信息
- `client/src/services/api.js`: API 调用封装

### 数据库

- `database/schema.sql`: 数据库表结构定义，包含 transactions 表的创建语句

## 数据流程

1. 用户在前端填写交易记录表单
2. 前端通过 API 发送请求到后端
3. 后端接收请求，验证数据
4. 如果是卖出交易，后端计算盈亏（使用FIFO方法）
5. 数据保存到 MySQL 数据库
6. 返回结果给前端
7. 前端更新界面显示

## 盈亏计算逻辑

系统使用 **FIFO（先进先出）** 方法计算卖出交易的盈亏：

1. 当添加卖出记录时，系统查找该股票的所有买入记录
2. 按照交易日期和创建时间排序（最早买入的优先）
3. 从最早的买入记录开始，计算卖出数量对应的成本
4. 盈亏 = 卖出金额 - 成本金额

例如：
- 2024-01-01 买入 100股 @ 10元
- 2024-01-15 买入 100股 @ 12元
- 2024-02-01 卖出 150股 @ 15元

计算：卖出150股的成本 = 100×10 + 50×12 = 1600元
      卖出金额 = 150×15 = 2250元
      盈亏 = 2250 - 1600 = 650元

