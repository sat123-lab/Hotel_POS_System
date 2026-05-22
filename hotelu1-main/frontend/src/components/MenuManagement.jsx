import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import MenuItemForm from './MenuItemForm';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Package,
  Eye,
  EyeOff,
  X,
  Soup,
  ChefHat,
  Utensils,
  Pizza,
  Coffee,
  Cookie,
  IceCream,
} from 'lucide-react';
import useCurrency from '../hooks/useCurrency';

const CATEGORY_ICONS = {
  All: Utensils,
  Starters: Soup,
  Biryani: ChefHat,
  'Main Course': Utensils,
  Chinese: Pizza,
  Breads: Cookie,
  Desserts: IceCream,
  Beverages: Coffee,
};

const MenuManagement = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [notification, setNotification] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  /* ------------------ auth gate ------------------ */
  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  /* ------------------ data ------------------ */
  const fetchMenuItems = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/menu');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const safe = Array.isArray(data) ? data : [];
      setMenuItems(
        safe.map((item) => ({
          ...item,
          isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
        }))
      );
    } catch (err) {
      console.error(err);
      setMenuItems([]);
      setNotification({ message: err.message || 'Failed to load menu', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  /* ------------------ handlers (unchanged) ------------------ */
  const handleAddMenuItem = async (item) => {
    try {
      const response = await authFetch('/api/menu', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const newItem = await response.json();
      setMenuItems((prev) => [...prev, newItem]);
      setNotification({ message: 'Menu item added!', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error adding item', type: 'error' });
    }
    setShowAddForm(false);
    setEditingItem(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateMenuItem = async (item) => {
    try {
      if (!item.id) throw new Error('Item ID missing');
      const payload = {
        name: item.name,
        price: parseFloat(item.price),
        category: item.category,
        description: item.description || null,
        image: item.image || null,
        isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
      };
      const response = await authFetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      const updated = result.item;
      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? updated : m)));
      setNotification({ message: 'Menu item updated!', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error updating item', type: 'error' });
    }
    setShowAddForm(false);
    setEditingItem(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      const response = await authFetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMenuItems((prev) => prev.filter((i) => i.id !== id));
      setNotification({ message: `Deleted "${name}"`, type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error deleting', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAvailabilityToggle = async (id, isAvailable) => {
    try {
      const response = await authFetch(`/api/menu/${id}/availability`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMenuItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isAvailable } : item))
      );
      setNotification({
        message: `Marked as ${isAvailable ? 'Available' : 'Unavailable'}`,
        type: 'success',
      });
    } catch (err) {
      setNotification({ message: err.message || 'Error updating', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  /* ------------------ filters ------------------ */
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map((i) => i.category).filter(Boolean))];
    return ['All', ...cats];
  }, [menuItems]);

  const filtered = useMemo(() => {
    let list = menuItems;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'All') {
      list = list.filter((i) => i.category === filterCategory);
    }
    return list;
  }, [menuItems, searchTerm, filterCategory]);

  /* ------------------ render ------------------ */
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your restaurant menu items</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingItem(null);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Search + categories */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = filterCategory === cat;
            const Icon = CATEGORY_ICONS[cat] || Utensils;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-orange-50/40 hover:text-orange-600'
                }`}
              >
                {active && cat === 'All' ? null : <Icon className="w-3.5 h-3.5" />}
                {cat === 'All' ? 'All Items' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white border border-gray-100 p-3 animate-pulse"
            >
              <div className="h-40 rounded-xl bg-gray-100 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-gray-600 font-semibold">No menu items found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              fmt={fmt}
              onEdit={() => {
                setEditingItem(item);
                setShowAddForm(true);
              }}
              onDelete={() => handleDeleteItem(item.id, item.name)}
              onToggle={() => handleAvailabilityToggle(item.id, !item.isAvailable)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <MenuItemForm
                onSave={editingItem ? handleUpdateMenuItem : handleAddMenuItem}
                onCancel={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                }}
                initialData={editingItem || {}}
                locationSettings={locationSettings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuCard = ({ item, fmt, onEdit, onDelete, onToggle }) => {
  const available = item.isAvailable;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="relative h-40 bg-gray-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{item.name}</h3>
            <p className="text-[11px] text-gray-500">{item.category || 'Uncategorized'}</p>
          </div>
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              available ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
            title={available ? 'Available' : 'Unavailable'}
          />
        </div>

        {item.description && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 min-h-[2rem]">
            {item.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <p className="text-orange-500 font-extrabold">{fmt(item.price)}</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggle}
              title={available ? 'Mark unavailable' : 'Mark available'}
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                available
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              }`}
            >
              {available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onEdit}
              title="Edit"
              className="w-7 h-7 rounded-full bg-gray-50 text-gray-500 hover:bg-orange-50 hover:text-orange-600 flex items-center justify-center"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="w-7 h-7 rounded-full bg-gray-50 text-gray-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuManagement;
