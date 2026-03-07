import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import MenuItemForm from './MenuItemForm';
import { Plus, Edit, Trash2, Search, Filter, Package, DollarSign, RefreshCw, ChefHat, Utensils } from 'lucide-react';

const MenuManagement = ({ locationSettings }) => {
    const navigate = useNavigate();
    
    // Check authentication
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
        }
    }, [navigate]);
    const [menuItems, setMenuItems] = useState(() => []);
    const [notification, setNotification] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Safe filter function to prevent errors
    const safeFilter = (items, predicate) => {
        if (!Array.isArray(items)) return [];
        try {
            return items.filter(predicate);
        } catch (error) {
            console.error('Filter error:', error);
            return [];
        }
    };

    const fetchMenuItems = async () => {
        setIsLoading(true);
        try {
            const response = await authFetch('/api/menu');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // Ensure we always set an array, even if data is null/undefined
            const safeData = Array.isArray(data) ? data : [];
            // Add isAvailable property to all items (default to true)
            const itemsWithAvailability = safeData.map(item => ({
                ...item,
                isAvailable: item.isAvailable !== undefined ? item.isAvailable : true
            }));
            console.log('Fetched menu items:', itemsWithAvailability);
            setMenuItems(itemsWithAvailability);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error in fetchMenuItems:', error);
            setMenuItems([]);
            setNotification({
                message: error.message || 'Failed to load menu items',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Get unique categories for filter dropdown
    const getCategories = () => {
        const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
        return ['All', ...categories];
    };

    // Filter menu items based on search and category
    const getFilteredMenuItems = () => {
        let filtered = menuItems;
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.category?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Filter by category
        if (filterCategory !== 'All') {
            filtered = filtered.filter(item => item.category === filterCategory);
        }
        
        return filtered;
    };

    const handleRefresh = () => {
        fetchMenuItems();
    };

    useEffect(() => {
        fetchMenuItems();
    }, []);

    const handleAddMenuItem = async (item) => {
        try {
            console.log('Adding new menu item:', item);
            const response = await authFetch('https://hotel-pos-system.onrender.com/api/menu', {
                method: 'POST',
                body: JSON.stringify(item)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newItem = await response.json();
            console.log('New item added:', newItem);
            setMenuItems(prev => [...prev, newItem]);
            setNotification({ 
                message: 'Menu item added successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error adding menu item:', error);
            setNotification({ 
                message: `Error adding menu item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setShowAddForm(false);
        setEditingItem(null);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleUpdateMenuItem = async (item) => {
        try {
            console.log('Updating menu item:', item);
            const response = await authFetch(`https://hotel-pos-system.onrender.com/api/menu/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify(item)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            const updated = result.item;
            console.log('Item updated:', updated);
            setMenuItems(prev => prev.map(m => m.id === item.id ? updated : m));
            setNotification({ 
                message: 'Menu item updated successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error updating menu item:', error);
            setNotification({ 
                message: `Error updating menu item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setShowAddForm(false);
        setEditingItem(null);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleDeleteItem = async (id, name) => {
        try {
            console.log('Deleting item:', id);
            const response = await authFetch(`https://hotel-pos-system.onrender.com/api/menu/${id}`, { 
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Use safeFilter to prevent errors
            setMenuItems(prev => safeFilter(prev, item => item.id !== id));
            setNotification({ 
                message: `Menu item '${name}' deleted successfully!`, 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error deleting menu item:', error);
            setNotification({ 
                message: `Error deleting menu item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAvailabilityToggle = async (id, isAvailable) => {
        try {
            console.log('Toggling availability for item:', id, 'to:', isAvailable);
            const response = await authFetch(`https://hotel-pos-system.onrender.com/api/menu/${id}/availability`, {
                method: 'PUT',
                body: JSON.stringify({ isAvailable })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Availability update response:', result);
            
            // Update local state
            setMenuItems(prev => prev.map(item => 
                item.id === id ? { ...item, isAvailable } : item
            ));
            setNotification({ 
                message: `Item marked as ${isAvailable ? 'Available' : 'Not Available'}!`, 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error toggling availability:', error);
            setNotification({ 
                message: `Error updating availability: ${error.message}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xl">
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-2">Menu Management</h2>
                            <p className="text-blue-100 text-lg">Manage your restaurant menu items & pricing</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                                <ChefHat className="w-4 h-4 text-green-300" />
                                <span className="text-white text-sm font-medium">Menu</span>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 text-white" />
                                <span className="text-white text-sm font-medium">Refresh</span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <Utensils className="w-8 h-8 text-blue-200" />
                                <Package className="w-8 h-8 text-purple-200" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-blue-100 text-sm">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 bg-green-500/20 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-100 text-xs font-medium">{menuItems.length} items</span>
                        </div>
                    </div>
                </div>
            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

            {/* Controls Section */}
            <div className="px-6 py-4">
                <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Search and Filter */}
                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Search menu items..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all duration-200"
                                />
                            </div>
                            
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="pl-10 pr-8 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all duration-200 appearance-none"
                                >
                                    {getCategories().map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {/* Add New Item Button */}
                        <button
                            onClick={() => { setShowAddForm(true); setEditingItem(null); }}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Add New Item
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Add/Edit Item Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold text-gray-800">
                                    {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                                </h3>
                                <button
                                    onClick={() => { setShowAddForm(false); setEditingItem(null); }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <MenuItemForm
                                onSave={editingItem ? handleUpdateMenuItem : handleAddMenuItem}
                                onCancel={() => { setShowAddForm(false); setEditingItem(null); }}
                                initialData={editingItem || {}}
                                locationSettings={locationSettings}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Menu Items Section */}
            <div className="px-6 pb-8">
                <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg mr-3">
                                <Package className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Menu Items</h3>
                        </div>
                        <div className="text-sm text-gray-500">
                            {getFilteredMenuItems().length} of {menuItems.length} items
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <span className="ml-3 text-gray-600">Loading menu items...</span>
                        </div>
                    ) : getFilteredMenuItems().length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-lg">
                                {menuItems.length === 0 ? 'No menu items added yet' : 'No items found matching your search'}
                            </p>
                            <p className="text-gray-400 text-sm mt-2">
                                {menuItems.length === 0 ? 'Click "Add New Item" to get started' : 'Try adjusting your search or filters'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {getFilteredMenuItems().map(item => (
                                <div key={item.id} className="group bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:from-indigo-50 hover:to-purple-50">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-bold text-gray-900 mb-2">{item.name}</h4>
                                            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                                                {item.category || 'Uncategorized'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-600">{locationSettings.currencySymbol}{item.price.toFixed(2)}</p>
                                            <p className="text-xs text-gray-500">Price</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <p className="text-gray-600 text-sm line-clamp-2">
                                            {item.description || 'No description available'}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => handleAvailabilityToggle(item.id, !item.isAvailable)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                                item.isAvailable 
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full mr-2 ${
                                                item.isAvailable ? 'bg-green-500' : 'bg-red-500'
                                            }`}></div>
                                            {item.isAvailable ? 'Available' : 'Not Available'}
                                        </button>
                                        
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setEditingItem(item); setShowAddForm(true); }}
                                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                title="Edit item"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(item.id, item.name)}
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                title="Delete item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-8">
                <div className="text-center text-sm text-gray-500">
                    <p>Menu items updated automatically</p>
                    <p className="mt-1">Last updated: {lastUpdated.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};

export default MenuManagement; 
