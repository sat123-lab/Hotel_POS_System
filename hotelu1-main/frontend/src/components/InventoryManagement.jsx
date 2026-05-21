import React, { useState, useEffect } from 'react';
import { fetchWithErrorHandling } from '../utils/api';
import Notification from './Notification';

const InventoryManagement = () => {
    const [inventory, setInventory] = useState([]);
    const [notification, setNotification] = useState(null);
    const [newItem, setNewItem] = useState({ material_name: '', current_stock: '', min_stock: '' });
    const [editingId, setEditingId] = useState(null);
    const [editMinStock, setEditMinStock] = useState('');

    const fetchInventory = async () => {
        try {
            const data = await fetchWithErrorHandling('/api/inventory');
            setInventory(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            setInventory([]);
            setNotification({
                message: error.message || 'Failed to load inventory',
                type: 'error'
            });
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const handleAddItem = async (e) => {
        e.preventDefault();
        
        // Validate input
        if (!newItem.material_name || newItem.current_stock === '' || newItem.min_stock === '') {
            setNotification({ 
                message: 'Please fill in all fields', 
                type: 'error' 
            });
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        
        try {
            const added = await fetchWithErrorHandling('/api/inventory', {
                method: 'POST',
                body: JSON.stringify({
                    material_name: newItem.material_name.trim(),
                    current_stock: parseFloat(newItem.current_stock),
                    min_stock: parseFloat(newItem.min_stock)
                })
            });
            
            setInventory(prev => [...prev, added]);
            setNotification({ 
                message: 'Inventory item added successfully!', 
                type: 'success' 
            });
            setNewItem({ material_name: '', current_stock: '', min_stock: '' });
            fetchInventory();
        } catch (error) {
            console.error('Error adding inventory item:', error);
            
            let errorMessage = 'Error adding inventory item';
            if (error.message && error.message.includes('409')) {
                errorMessage = 'Material with this name already exists';
            } else if (error.message && error.message.includes('401')) {
                errorMessage = 'Authentication error. Please login again.';
            } else if (error.message && error.message.includes('403')) {
                errorMessage = 'Permission denied. You do not have access to add inventory items.';
            } else if (error.message) {
                errorMessage = `Error adding inventory item: ${error.message}`;
            }
            
            setNotification({ 
                message: errorMessage, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 5000);
    };

    const handleStatusToggle = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === 'In Stock' ? 'Out of Stock' : 'In Stock';
            const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            
            setInventory(prev => prev.map(item => 
                item.id === id ? updated.item : item
            ));
            setNotification({ 
                message: 'Status updated successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error toggling status:', error);
            setNotification({ 
                message: `Error updating status: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAddStock = async (id) => {
        try {
            const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ operation: 'add' })
            });
            
            setInventory(prev => prev.map(item => 
                item.id === id ? updated.item : item
            ));
            setNotification({ 
                message: 'Stock added successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error adding stock:', error);
            setNotification({ 
                message: `Error adding stock: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleRemoveStock = async (id) => {
        try {
            const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ operation: 'remove' })
            });
            
            setInventory(prev => prev.map(item => 
                item.id === id ? updated.item : item
            ));
            setNotification({ 
                message: 'Stock removed successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error removing stock:', error);
            setNotification({ 
                message: `Error removing stock: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) {
            return;
        }
        
        try {
            await fetchWithErrorHandling(`/api/inventory/${id}`, {
                method: 'DELETE'
            });
            
            setInventory(prev => prev.filter(item => item.id !== id));
            setNotification({ 
                message: 'Item deleted successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error deleting item:', error);
            setNotification({ 
                message: `Error deleting item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleEditMinStock = (id, currentMinStock) => {
        setEditingId(id);
        setEditMinStock(currentMinStock.toString());
    };

    const handleSaveMinStock = async (id) => {
        try {
            const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ min_stock: parseFloat(editMinStock) })
            });
            
            setInventory(prev => prev.map(item => 
                item.id === id ? updated.item : item
            ));
            setNotification({ 
                message: 'Min stock updated successfully!', 
                type: 'success' 
            });
            setEditingId(null);
            setEditMinStock('');
        } catch (error) {
            console.error('Error updating min stock:', error);
            setNotification({ 
                message: `Error updating min stock: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditMinStock('');
    };

    return (
        <div className="p-6 bg-[#FFF8F0] min-h-screen rounded-lg shadow-inner">
            {/* Header Section - Orange Theme */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-1">Inventory Management</h2>
                            <p className="text-orange-100 text-base">Track and manage restaurant inventory</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className="text-white text-sm font-medium">Stock</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            
            {/* Add New Material Card - Orange Accent */}
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-8 border border-orange-100">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-orange-500 rounded-full mr-3"></span>
                    Add New Material
                </h3>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label htmlFor="material_name" className="block text-gray-700 text-sm font-bold mb-2">Material Name</label>
                        <input 
                            type="text" 
                            id="material_name" 
                            name="material_name" 
                            value={newItem.material_name}
                            onChange={(e) => setNewItem(prev => ({ ...prev, material_name: e.target.value }))}
                            className="w-full py-3 px-4 border-2 border-orange-100 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200" 
                            placeholder="e.g., Flour" 
                            required 
                        />
                    </div>
                    <div>
                        <label htmlFor="current_stock" className="block text-gray-700 text-sm font-bold mb-2">Initial Stock</label>
                        <input 
                            type="number" 
                            id="current_stock" 
                            name="current_stock" 
                            value={newItem.current_stock}
                            onChange={(e) => setNewItem(prev => ({ ...prev, current_stock: e.target.value }))}
                            className="w-full py-3 px-4 border-2 border-orange-100 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200" 
                            placeholder="e.g., 100" 
                            min="0" 
                            step="0.01"
                            required 
                        />
                    </div>
                    <div>
                        <label htmlFor="min_stock" className="block text-gray-700 text-sm font-bold mb-2">Min Stock Alert</label>
                        <input 
                            type="number" 
                            id="min_stock" 
                            name="min_stock" 
                            value={newItem.min_stock}
                            onChange={(e) => setNewItem(prev => ({ ...prev, min_stock: e.target.value }))}
                            className="w-full py-3 px-4 border-2 border-orange-100 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200" 
                            placeholder="e.g., 10" 
                            min="0" 
                            step="0.01"
                            required 
                        />
                    </div>
                    <div>
                        <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-200">
                            Add Material
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-orange-100">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-orange-500 rounded-full mr-3"></span>
                    Inventory List
                </h3>
                <div className="overflow-x-auto rounded-xl border border-orange-100">
                    <table className="min-w-full divide-y divide-orange-100">
                        <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Material</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Current Stock</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Min Stock</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-orange-50">
                            {inventory.map(item => (
                                <tr key={item.id} className={`hover:bg-orange-50/50 transition-colors duration-200 ${item.status === 'Out of Stock' ? 'bg-red-50/80' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center mr-3 shadow-sm">
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-800">{item.material_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className={`text-sm font-bold ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                                                {item.current_stock}
                                            </span>
                                            {/* Stock level indicator */}
                                            <div className="ml-3 w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${
                                                        item.current_stock <= item.min_stock 
                                                            ? 'bg-red-500' 
                                                            : item.current_stock <= item.min_stock * 1.5 
                                                                ? 'bg-yellow-500' 
                                                                : 'bg-green-500'
                                                    }`}
                                                    style={{ 
                                                        width: `${Math.min(100, (item.current_stock / Math.max(item.min_stock * 2, 1)) * 100)}%` 
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {editingId === item.id ? (
                                            <input
                                                type="number"
                                                value={editMinStock}
                                                onChange={(e) => setEditMinStock(e.target.value)}
                                                className="w-24 px-3 py-1.5 border-2 border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                min="0"
                                                step="0.01"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-medium">
                                                {item.min_stock}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleStatusToggle(item.id, item.status)}
                                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                                                item.status === 'In Stock' 
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                                            }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full mr-2 ${item.status === 'In Stock' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {item.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            {editingId === item.id ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleSaveMinStock(item.id)}
                                                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Save
                                                    </button>
                                                    <button 
                                                        onClick={handleCancelEdit}
                                                        className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={() => handleEditMinStock(item.id, item.min_stock)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                        title="Edit Min Stock"
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAddStock(item.id)}
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                        title="Add Stock"
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        Add
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRemoveStock(item.id)}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                        title="Remove Stock"
                                                        disabled={item.current_stock <= 0}
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                        </svg>
                                                        Remove
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm flex items-center"
                                                        title="Delete Item"
                                                    >
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {inventory.length === 0 && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <p className="text-gray-500 font-medium">No inventory items found.</p>
                            <p className="text-gray-400 text-sm mt-1">Add your first material above.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryManagement; 
