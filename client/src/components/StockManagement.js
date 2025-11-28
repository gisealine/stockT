import React, { useState, useEffect } from 'react';
import { stocksAPI } from '../services/api';

const StockManagement = ({ onBack }) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [formData, setFormData] = useState({ name: '', stock_type: 'A股' });
  const [saving, setSaving] = useState(false);

  // 加载股票列表
  const loadStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await stocksAPI.getAll();
      setStocks(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || '加载股票列表失败');
      console.error('加载股票列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  // 处理保存
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('股票名称不能为空');
      return;
    }
    if (!formData.stock_type) {
      setError('请选择股票类型');
      return;
    }

    setSaving(true);
    try {
      setError(null);
      if (editingStock) {
        await stocksAPI.update(editingStock.id, formData);
      } else {
        await stocksAPI.create(formData);
      }
      setShowForm(false);
      setEditingStock(null);
      setFormData({ name: '', stock_type: 'A股' });
      await loadStocks();
    } catch (err) {
      setError(err.response?.data?.message || '保存股票失败');
    } finally {
      setSaving(false);
    }
  };

  // 处理删除
  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这只股票吗？')) {
      return;
    }
    try {
      setError(null);
      await stocksAPI.delete(id);
      await loadStocks();
    } catch (err) {
      setError(err.response?.data?.message || '删除股票失败');
    }
  };

  // 处理编辑
  const handleEdit = (stock) => {
    setEditingStock(stock);
    setFormData({ name: stock.name, stock_type: stock.stock_type || 'A股' });
    setShowForm(true);
  };

  // 取消表单
  const handleCancel = () => {
    setShowForm(false);
    setEditingStock(null);
    setFormData({ name: '', stock_type: 'A股' });
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>股票管理</h2>
          <div>
            <button className="button" onClick={onBack} style={{ marginRight: '10px' }}>
              ← 返回
            </button>
            {!showForm && (
              <button className="button" onClick={() => setShowForm(true)}>
                ➕ 添加股票
              </button>
            )}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {showForm && (
          <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3>{editingStock ? '编辑股票' : '添加股票'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stock_name">
                    股票名称 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="stock_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：平安银行"
                    maxLength="100"
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="stock_type">
                    股票类型 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    id="stock_type"
                    value={formData.stock_type}
                    onChange={(e) => setFormData({ ...formData, stock_type: e.target.value })}
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                  >
                    <option value="A股">A股</option>
                    <option value="港股">港股</option>
                    <option value="美股">美股</option>
                  </select>
                </div>
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

        {loading ? (
          <div className="loading">加载中...</div>
        ) : stocks.length === 0 ? (
          <div className="loading">暂无股票，点击"添加股票"开始添加</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>股票名称</th>
                  <th>股票类型</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr key={stock.id}>
                    <td>{stock.id}</td>
                    <td><strong>{stock.name}</strong></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: '#667eea', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {stock.stock_type || 'A股'}
                      </span>
                    </td>
                    <td>{new Date(stock.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <button
                        className="button"
                        style={{ padding: '5px 10px', fontSize: '14px', marginRight: '5px' }}
                        onClick={() => handleEdit(stock)}
                      >
                        编辑
                      </button>
                      <button
                        className="button button-danger"
                        style={{ padding: '5px 10px', fontSize: '14px' }}
                        onClick={() => handleDelete(stock.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockManagement;

