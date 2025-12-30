import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import zhCN from 'date-fns/locale/zh-CN';
import { stocksAPI } from '../services/api';
import { getCurrencySymbol } from '../utils/currency';

registerLocale('zhCN', zhCN);

const TransactionForm = ({ transaction, onSave, onCancel }) => {
  const [stocks, setStocks] = useState([]);
  const [formData, setFormData] = useState({
    stock_name: '',
    transaction_type: 'BUY',
    quantity: '',
    price: '',
    transaction_date: new Date(),
    notes: '',
    commission: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);

  // 加载股票列表
  useEffect(() => {
    const loadStocks = async () => {
      try {
        setLoadingStocks(true);
        const response = await stocksAPI.getAll();
        setStocks(response.data.data || []);
      } catch (err) {
        console.error('加载股票列表失败:', err);
      } finally {
        setLoadingStocks(false);
      }
    };
    loadStocks();
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        stock_name: transaction.stock_name || '',
        transaction_type: transaction.transaction_type || 'BUY',
        quantity: transaction.quantity || '',
        price: transaction.price || '',
        transaction_date: transaction.transaction_date ? new Date(transaction.transaction_date) : new Date(),
        notes: transaction.notes || '',
        commission: transaction.commission || '',
      });
      // 设置选中的股票信息
      const stock = stocks.find(s => s.name === transaction.stock_name);
      if (stock) {
        setSelectedStock(stock);
      }
    }
  }, [transaction, stocks]);

  // 当选择股票时，更新selectedStock
  useEffect(() => {
    if (formData.stock_name) {
      const stock = stocks.find(s => s.name === formData.stock_name);
      setSelectedStock(stock || null);
    } else {
      setSelectedStock(null);
    }
  }, [formData.stock_name, stocks]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({
      ...prev,
      transaction_date: date,
    }));
  };

  // 计算手续费和税费（仅用于显示）
  const calculateCommissionAndTax = () => {
    if (!selectedStock || !formData.quantity || !formData.price) {
      return { commission: 0, tax: 0 };
    }

    const totalAmount = parseFloat(formData.quantity) * parseFloat(formData.price);
    const stockType = selectedStock.stock_type;
    const transactionType = formData.transaction_type;

    let commission = 0;
    let tax = 0;

    if (stockType === 'A股') {
      commission = totalAmount * 0.00015; // 万1.5
      if (transactionType === 'SELL') {
        tax = totalAmount * 0.0005; // 万分之5 = 5/10000 = 0.0005
      }
    } else if (stockType === '港股') {
      commission = totalAmount * 0.0002; // 万2
      tax = totalAmount * 0.001; // 千分之1
    } else if (stockType === '美股') {
      commission = parseFloat(formData.commission) || 0;
      tax = 0;
    }

    return {
      commission: parseFloat(commission.toFixed(2)),
      tax: parseFloat(tax.toFixed(2))
    };
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.stock_name.trim()) {
      newErrors.stock_name = '请选择股票名称';
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = '请输入有效的数量';
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = '请输入有效的价格';
    }

    if (!formData.transaction_date) {
      newErrors.transaction_date = '请选择交易日期';
    }

    // 美股需要验证手续费
    if (selectedStock && selectedStock.stock_type === '美股') {
      if (!formData.commission || parseFloat(formData.commission) < 0) {
        newErrors.commission = '请输入有效的手续费（美股必填）';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        transaction_date: formatDate(formData.transaction_date),
      };
      
      // 只有美股才传递commission，其他类型由后端自动计算
      if (selectedStock && selectedStock.stock_type === '美股') {
        submitData.commission = parseFloat(formData.commission) || 0;
      } else {
        delete submitData.commission;
      }
      
      await onSave(submitData);
      // 保存成功后重置表单
      setFormData({
        stock_name: '',
        transaction_type: 'BUY',
        quantity: '',
        price: '',
        transaction_date: new Date(),
        notes: '',
        commission: '',
      });
      setSelectedStock(null);
      setErrors({});
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stock_name">
              股票名称 <span style={{ color: 'red' }}>*</span>
            </label>
            {loadingStocks ? (
              <div>加载股票列表...</div>
            ) : (
              <select
                id="stock_name"
                name="stock_name"
                value={formData.stock_name}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px', fontSize: '16px' }}
              >
                <option value="">请选择股票</option>
                {stocks.map((stock) => (
                  <option key={stock.id} value={stock.name}>
                    {stock.name}
                  </option>
                ))}
              </select>
            )}
            {errors.stock_name && <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>{errors.stock_name}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              交易类型 <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="transaction_type"
                  value="BUY"
                  checked={formData.transaction_type === 'BUY'}
                  onChange={handleChange}
                  style={{ marginRight: '5px' }}
                />
                买入
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="transaction_type"
                  value="SELL"
                  checked={formData.transaction_type === 'SELL'}
                  onChange={handleChange}
                  style={{ marginRight: '5px' }}
                />
                卖出
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="transaction_date">
              交易日期 <span style={{ color: 'red' }}>*</span>
            </label>
            <DatePicker
              selected={formData.transaction_date}
              onChange={handleDateChange}
              dateFormat="yyyy-MM-dd"
              locale="zhCN"
              className="form-control"
              wrapperClassName="date-picker-wrapper"
            />
            {errors.transaction_date && <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>{errors.transaction_date}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">
              数量（股） <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              step="0.0001"
              min="0"
              placeholder="例如：100 或 33.3333（支持小数）"
            />
            {errors.quantity && <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>{errors.quantity}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="price">
              价格（元） <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="例如：10.50"
              min="0"
              step="0.01"
            />
            {errors.price && <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>{errors.price}</div>}
          </div>
        </div>

        {/* 手续费和税费 */}
        {selectedStock && formData.quantity && formData.price && (
          <div className="form-row">
            {selectedStock.stock_type === '美股' ? (
              <div className="form-group">
                <label htmlFor="commission">
                  手续费（元） <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  id="commission"
                  name="commission"
                  value={formData.commission}
                  onChange={handleChange}
                  placeholder="请输入手续费"
                  min="0"
                  step="0.01"
                />
                {errors.commission && <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>{errors.commission}</div>}
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>手续费（元）</label>
                  <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '16px' }}>
                    {getCurrencySymbol(selectedStock.stock_type)}{calculateCommissionAndTax().commission.toFixed(2)}
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '5px' }}>
                      ({selectedStock.stock_type === 'A股' ? '万1.5' : '万2'})
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <label>税费（元）</label>
                  <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '16px' }}>
                    {calculateCommissionAndTax().tax > 0 ? (
                      <>
                        {getCurrencySymbol(selectedStock.stock_type)}{calculateCommissionAndTax().tax.toFixed(2)}
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '5px' }}>
                          ({selectedStock.stock_type === 'A股' ? '万分之5（仅卖出）' : '千分之1'})
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#999' }}>无</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="notes">备注</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="可选：添加备注信息"
            rows="3"
          />
        </div>

        {formData.quantity && formData.price && (
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
            <strong>交易总金额：</strong>
            <span style={{ color: '#667eea', fontSize: '18px', fontWeight: 'bold' }}>
              {selectedStock ? getCurrencySymbol(selectedStock.stock_type) : '¥'}{(parseFloat(formData.quantity || 0) * parseFloat(formData.price || 0)).toFixed(2)}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {transaction && (
            <button type="button" className="button" onClick={onCancel} disabled={saving}>
              取消
            </button>
          )}
          <button type="submit" className="button button-success" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </>
  );
};

export default TransactionForm;

