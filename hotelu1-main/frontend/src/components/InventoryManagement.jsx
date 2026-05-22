import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithErrorHandling } from '../utils/api';
import Notification from './Notification';
import {
  Plus,
  Package,
  AlertTriangle,
  Layers,
  TrendingUp,
  Search,
  Edit2,
  Trash2,
  X,
  Minus,
  Save,
} from 'lucide-react';
import useCurrency from '../hooks/useCurrency';
import { getLocationSettingsForCountry } from '../utils/currency';

/* ===============================================================
   Inventory Management — visual redesign only
   Logic / API contract unchanged.
   =============================================================== */

const guessCategory = (name = '') => {
  const n = name.toLowerCase();
  if (/rice|wheat|flour|atta|maida|grain/.test(n)) return 'Grains';
  if (/chicken|mutton|beef|lamb|fish|prawn|seafood|meat/.test(n)) return 'Meat';
  if (/milk|paneer|cheese|curd|yog|dairy|butter|ghee/.test(n)) return 'Dairy';
  if (/oil|ghee/.test(n)) return 'Oils';
  if (/onion|tomato|potato|veg|spinach|capsicum/.test(n)) return 'Vegetables';
  if (/salt|sugar|spice|masala|chili|pepper/.test(n)) return 'Spices';
  return 'Other';
};

const formatStock = (value) => {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
};

const InventoryManagement = () => {
  const locationSettings = getLocationSettingsForCountry(
    localStorage.getItem('posCountry') || 'India'
  );
  const { format: fmt } = useCurrency(locationSettings);

  const [inventory, setInventory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    material_name: '',
    current_stock: '',
    min_stock: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [editMinStock, setEditMinStock] = useState('');

  /* ---------------- data ---------------- */
  const fetchInventory = async () => {
    try {
      const data = await fetchWithErrorHandling('/api/inventory');
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setInventory([]);
      setNotification({ message: err.message || 'Failed to load inventory', type: 'error' });
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  /* ---------------- handlers ---------------- */
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.material_name || newItem.current_stock === '' || newItem.min_stock === '') {
      setNotification({ message: 'Please fill all fields', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    try {
      const added = await fetchWithErrorHandling('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          material_name: newItem.material_name.trim(),
          current_stock: parseFloat(newItem.current_stock),
          min_stock: parseFloat(newItem.min_stock),
        }),
      });
      setInventory((prev) => [...prev, added]);
      setNewItem({ material_name: '', current_stock: '', min_stock: '' });
      setShowAddModal(false);
      setNotification({ message: 'Inventory item added!', type: 'success' });
      fetchInventory();
    } catch (err) {
      let msg = 'Error adding item';
      if (err.message?.includes('409')) msg = 'Material with this name already exists';
      else if (err.message?.includes('401')) msg = 'Authentication error. Please login again.';
      else if (err.message?.includes('403')) msg = 'Permission denied.';
      else if (err.message) msg = err.message;
      setNotification({ message: msg, type: 'error' });
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddStock = async (id) => {
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'add' }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setNotification({ message: 'Stock added', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error adding stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleRemoveStock = async (id) => {
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'remove' }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setNotification({ message: 'Stock removed', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error removing stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await fetchWithErrorHandling(`/api/inventory/${id}`, { method: 'DELETE' });
      setInventory((prev) => prev.filter((i) => i.id !== id));
      setNotification({ message: 'Item deleted', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error deleting', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const startEditMinStock = (id, current) => {
    setEditingId(id);
    setEditMinStock(String(current ?? 0));
  };

  const saveMinStock = async (id) => {
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ min_stock: parseFloat(editMinStock) }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setEditingId(null);
      setEditMinStock('');
      setNotification({ message: 'Min stock updated', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error updating min stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  /* ---------------- derived metrics ---------------- */
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(
    (i) => Number(i.current_stock) <= Number(i.min_stock)
  );
  const lowStockCount = lowStockItems.length;
  const categories = useMemo(
    () => new Set(inventory.map((i) => guessCategory(i.material_name))),
    [inventory]
  );
  const totalValue = inventory.reduce((sum, i) => {
    const stock = Number(i.current_stock) || 0;
    const rate = Number(i.unit_price) || 0;
    return sum + stock * rate;
  }, 0);

  /* ---------------- filter ---------------- */
  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.toLowerCase();
    return inventory.filter(
      (i) =>
        (i.material_name || '').toLowerCase().includes(q) ||
        guessCategory(i.material_name).toLowerCase().includes(q)
    );
  }, [inventory, search]);

  /* ---------------- render ---------------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage restaurant inventory</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" /> ADD MATERIAL
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon={Package}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label="TOTAL ITEMS"
          value={totalItems}
        />
        <SummaryCard
          icon={AlertTriangle}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          label="LOW STOCK"
          value={lowStockCount}
          valueClass="text-rose-500"
          highlight={lowStockCount > 0}
        />
        <SummaryCard
          icon={Layers}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          label="CATEGORIES"
          value={categories.size}
        />
        <SummaryCard
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="TOTAL VALUE"
          value={fmt(totalValue)}
          valueClass="text-emerald-500"
        />
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory..."
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300"
          />
        </div>
      </div>

      {/* Items grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-gray-600 font-semibold">No inventory items</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add Material" to begin tracking stock.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              fmt={fmt}
              editingId={editingId}
              editMinStock={editMinStock}
              setEditMinStock={setEditMinStock}
              onStartEditMin={startEditMinStock}
              onSaveMin={saveMinStock}
              onCancelEditMin={() => {
                setEditingId(null);
                setEditMinStock('');
              }}
              onAddStock={handleAddStock}
              onRemoveStock={handleRemoveStock}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add Material</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Material Name
                </label>
                <input
                  type="text"
                  value={newItem.material_name}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, material_name: e.target.value }))
                  }
                  placeholder="e.g., Basmati Rice"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.current_stock}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, current_stock: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.min_stock}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, min_stock: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
                >
                  Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, iconBg, iconColor, label, value, valueClass = '', highlight = false }) => (
  <div
    className={`rounded-2xl bg-white border p-4 shadow-sm flex items-start gap-3 ${
      highlight ? 'border-rose-200' : 'border-gray-100'
    }`}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className={`text-xl font-extrabold mt-0.5 ${valueClass || 'text-gray-900'}`}>{value}</p>
    </div>
  </div>
);

const InventoryCard = ({
  item,
  fmt,
  editingId,
  editMinStock,
  setEditMinStock,
  onStartEditMin,
  onSaveMin,
  onCancelEditMin,
  onAddStock,
  onRemoveStock,
  onDelete,
}) => {
  const current = Number(item.current_stock) || 0;
  const min = Number(item.min_stock) || 0;
  const max = Math.max(current * 1.5, min * 2, 1);
  const ratio = Math.min(100, Math.max(5, (current / max) * 100));
  const lowStock = current <= min;
  const ok = current > min * 1.5;

  const barColor = lowStock
    ? 'bg-gradient-to-r from-rose-400 to-rose-500'
    : ok
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : 'bg-gradient-to-r from-amber-400 to-amber-500';

  const stockColor = lowStock ? 'text-rose-500' : ok ? 'text-emerald-500' : 'text-amber-500';
  const category = guessCategory(item.material_name);
  const unit = item.unit || 'kg';
  const supplier = item.supplier || '';
  const unitPrice = Number(item.unit_price) || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{item.material_name}</h3>
          <p className="text-[11px] text-gray-500">{category}</p>
        </div>
        <div className="flex items-center gap-1">
          {lowStock && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-rose-50 text-rose-500">
              Low Stock
            </span>
          )}
          <button
            onClick={() => onDelete(item.id, item.material_name)}
            title="Delete"
            className="w-7 h-7 rounded-full bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-gray-500">Stock Level</p>
        <p className={`text-sm font-bold ${stockColor}`}>
          {formatStock(current)} {unit}
        </p>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${ratio}%` }} />
      </div>

      {/* Min stock row */}
      <div className="flex items-center justify-between mt-2.5 text-xs text-gray-500">
        {editingId === item.id ? (
          <div className="flex items-center gap-1.5 w-full">
            <input
              type="number"
              min="0"
              step="0.01"
              value={editMinStock}
              onChange={(e) => setEditMinStock(e.target.value)}
              className="flex-1 px-2 py-1 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              autoFocus
            />
            <button
              onClick={() => onSaveMin(item.id)}
              className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
              title="Save"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={onCancelEditMin}
              className="w-6 h-6 rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <span>
              Min stock: <span className="font-semibold text-gray-700">{formatStock(min)} {unit}</span>
            </span>
            <button
              onClick={() => onStartEditMin(item.id, min)}
              title="Edit min stock"
              className="w-6 h-6 rounded-md hover:bg-orange-50 text-gray-400 hover:text-orange-500 flex items-center justify-center"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {supplier ? (
          <span className="text-[11px] text-gray-500 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 truncate max-w-[55%]">
            {supplier}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onRemoveStock(item.id)}
              className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center"
              title="Remove stock"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onAddStock(item.id)}
              className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-500 hover:bg-emerald-100 flex items-center justify-center"
              title="Add stock"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-sm font-bold text-orange-500">
          {unitPrice > 0 ? `${fmt(unitPrice)}/${unit}` : ''}
        </p>
      </div>
    </div>
  );
};

export default InventoryManagement;
