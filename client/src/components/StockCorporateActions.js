import React, { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import zhCN from 'date-fns/locale/zh-CN';
import { stockCorporateActionsAPI, stocksAPI, syncAPI } from '../services/api';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../utils/currency';

registerLocale('zhCN', zhCN);

const StockCorporateActions = ({ onBack }) => {
  const [records, setRecords] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    stock_name: '',
    action_type: 'DIVIDEND',
    action_date: new Date(),
    ratio: '',
    amount: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [filterStock, setFilterStock] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [recordsResponse, stocksResponse] = await Promise.all([
        stockCorporateActionsAPI.getAll(),
        stocksAPI.getAll()
      ]);
      setRecords(recordsResponse.data.data || []);
      setStocks(stocksResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || '加载数据失败');
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 格式化日期为字符串（用于提交）
  const formatDateForSubmit = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 处理日期变更
  const handleDateChange = (date) => {
    setFormData((prev) => ({
      ...prev,
      action_date: date,
    }));
  };

  // 处理保存
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.stock_name.trim()) {
      setError('请选择股票');
      return;
    }
    if (!formData.action_date) {
      setError('请选择行为日期');
      return;
    }

    // 验证字段
    if (formData.action_type === 'DIVIDEND' && !formData.amount) {
      setError('分红必须填写每股金额');
      return;
    }
    if ((formData.action_type === 'SPLIT' || formData.action_type === 'REVERSE_SPLIT') && !formData.ratio) {
      setError('合股/拆股必须填写比例');
      return;
    }

    setSaving(true);
    try {
      setError(null);
      const submitData = {
        ...formData,
        action_date: formatDateForSubmit(formData.action_date),
        ratio: formData.ratio ? parseFloat(formData.ratio) : null,
        amount: formData.amount ? parseFloat(formData.amount) : null,
      };
      
      if (editingRecord) {
        await stockCorporateActionsAPI.update(editingRecord.id, submitData);
      } else {
        await stockCorporateActionsAPI.create(submitData);
      }
      
      handleCancel();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 处理删除
  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这条记录吗？')) {
      return;
    }
    try {
      setError(null);
      await stockCorporateActionsAPI.delete(id);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || '删除失败');
    }
  };

  // 处理编辑
  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      stock_name: record.stock_name,
      action_type: record.action_type,
      action_date: record.action_date ? new Date(record.action_date) : new Date(),
      ratio: record.ratio || '',
      amount: record.amount || '',
      notes: record.notes || ''
    });
    setShowForm(true);
  };

  // 取消表单
  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormData({
      stock_name: filterStock || '',
      action_type: 'DIVIDEND',
      action_date: new Date(),
      ratio: '',
      amount: '',
      notes: ''
    });
  };

  // 获取行为类型显示文本
  const getActionTypeText = (type) => {
    const map = {
      'DIVIDEND': '分红',
      'SPLIT': '拆股',
      'REVERSE_SPLIT': '合股'
    };
    return map[type] || type;
  };

  // 格式化日期
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  // 获取股票类型
  const getStockType = (stockName) => {
    const stock = stocks.find(s => s.name === stockName);
    return stock?.stock_type || 'A股';
  };

  // 处理同步
  const handleSync = async (stockName) => {
    if (!stockName) {
      setError('请先选择要同步的股票');
      return;
    }

    if (!window.confirm(`确定要同步 ${stockName} 的交易记录吗？将根据分红/合股信息调整该股票的交易数量和价格。`)) {
      return;
    }

    setSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const response = await syncAPI.syncTransactions(stockName);
      setSyncMessage(response.data.message || '同步成功');
      // 可以选择重新加载数据，但交易记录不在这个页面显示，所以不需要
    } catch (err) {
      setError(err.response?.data?.message || '同步失败');
      console.error('同步失败:', err);
    } finally {
      setSyncing(false);
    }
  };

  // 过滤记录
  const filteredRecords = filterStock 
    ? records.filter(r => r.stock_name === filterStock)
    : records;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>分红/合股管理</h2>
          <div>
            <button className="button" onClick={onBack} style={{ marginRight: '10px' }}>
              ← 返回
            </button>
            {!showForm && (
              <button className="button" onClick={() => {
                setShowForm(true);
                setEditingRecord(null);
                setFormData({
                  stock_name: filterStock || '',
                  action_type: 'DIVIDEND',
                  action_date: new Date(),
                  ratio: '',
                  amount: '',
                  notes: ''
                });
              }}>
                ➕ 添加记录
              </button>
            )}
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {syncMessage && (
          <div className="success" style={{ marginBottom: '20px' }}>
            {syncMessage}
          </div>
        )}

        {showForm && (
          <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3>{editingRecord ? '编辑记录' : '添加记录'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stock_name">
                    股票名称 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    id="stock_name"
                    value={formData.stock_name}
                    onChange={(e) => setFormData({ ...formData, stock_name: e.target.value })}
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                    required
                  >
                    <option value="">请选择股票</option>
                    {stocks.map(stock => (
                      <option key={stock.id} value={stock.name}>{stock.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="action_type">
                    行为类型 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    id="action_type"
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value, ratio: '', amount: '' })}
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                    required
                  >
                    <option value="DIVIDEND">分红</option>
                    <option value="SPLIT">拆股</option>
                    <option value="REVERSE_SPLIT">合股</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="action_date">
                    行为日期 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <DatePicker
                    selected={formData.action_date}
                    onChange={handleDateChange}
                    dateFormat="yyyy-MM-dd"
                    locale="zhCN"
                    className="form-control"
                    wrapperClassName="date-picker-wrapper"
                  />
                </div>
              </div>

              {formData.action_type === 'DIVIDEND' && (
                <div className="form-group">
                  <label htmlFor="amount">
                    每股分红金额 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.00001"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="请输入每股分红金额"
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                    required
                  />
                </div>
              )}

              {(formData.action_type === 'SPLIT' || formData.action_type === 'REVERSE_SPLIT') && (
                <div className="form-group">
                  <label htmlFor="ratio">
                    比例 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    id="ratio"
                    type="number"
                    step="0.0001"
                    value={formData.ratio}
                    onChange={(e) => setFormData({ ...formData, ratio: e.target.value })}
                    placeholder={formData.action_type === 'SPLIT' ? '例如：0.5 表示1股拆成2股' : '例如：2 表示2股合1股'}
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                    required
                  />
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {formData.action_type === 'SPLIT' 
                      ? '拆股：输入小于1的数字，如0.5表示1股拆成2股，0.25表示1股拆成4股'
                      : '合股：输入大于1的数字，如2表示2股合1股，4表示4股合1股'}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="notes">备注</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="请输入备注信息（可选）"
                  style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                />
              </div>

              <div style={{ marginTop: '15px' }}>
                <button type="button" className="button" onClick={handleCancel} disabled={saving}>
                  取消
                </button>
                <button type="submit" className="button button-success" disabled={saving} style={{ marginLeft: '10px' }}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 过滤和同步 */}
        {!showForm && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '1', minWidth: '200px' }}>
              <label htmlFor="filter_stock">筛选股票：</label>
              <select
                id="filter_stock"
                value={filterStock}
                onChange={(e) => {
                  setFilterStock(e.target.value);
                  setSyncMessage(null);
                }}
                style={{ width: '100%', padding: '10px', fontSize: '16px' }}
              >
                <option value="">全部股票</option>
                {stocks.map(stock => (
                  <option key={stock.id} value={stock.name}>{stock.name}</option>
                ))}
              </select>
            </div>
            {filterStock && (
              <div>
                <button
                  className="button button-success"
                  onClick={() => handleSync(filterStock)}
                  disabled={syncing}
                  style={{ marginTop: '25px' }}
                >
                  {syncing ? '同步中...' : '🔄 同步信息'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 记录列表 */}
        {loading ? (
          <div className="loading">加载中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="loading">暂无记录{filterStock && '，点击"添加记录"开始添加'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>股票名称</th>
                  <th>行为类型</th>
                  <th>行为日期</th>
                  <th>比例</th>
                  <th>每股金额</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const stockType = getStockType(record.stock_name);
                  const currencySymbol = getCurrencySymbol(stockType);
                  return (
                    <tr key={record.id}>
                      <td><strong>{record.stock_name}</strong></td>
                      <td>
                        <span className={`badge ${record.action_type === 'DIVIDEND' ? 'badge-buy' : 'badge-short'}`}>
                          {getActionTypeText(record.action_type)}
                        </span>
                      </td>
                      <td>{formatDate(record.action_date)}</td>
                      <td>
                        {record.ratio 
                          ? `${record.action_type === 'SPLIT' ? '1:' : ''}${record.ratio}${record.action_type === 'REVERSE_SPLIT' ? ':1' : ''}`
                          : '-'
                        }
                      </td>
                      <td>{record.amount ? `${currencySymbol}${parseFloat(record.amount).toFixed(5)}` : '-'}</td>
                      <td>{record.notes || '-'}</td>
                      <td>
                        <button
                          className="button"
                          onClick={() => handleEdit(record)}
                          style={{ padding: '5px 10px', fontSize: '14px', marginRight: '5px' }}
                        >
                          编辑
                        </button>
                        <button
                          className="button button-danger"
                          onClick={() => handleDelete(record.id)}
                          style={{ padding: '5px 10px', fontSize: '14px' }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockCorporateActions;

