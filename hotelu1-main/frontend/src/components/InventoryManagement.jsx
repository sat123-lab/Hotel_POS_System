import React, { useState, useEffect } from 'react';
import { fetchWithErrorHandling } from '../utils/api';
import Notification from './Notification';

const InventoryManagement = () => {
    const [inventory, setInventory] = useState([]);
    const [notification, setNotification] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', currentStock: '', minStock: '' });

    const fetchInventory = async () => {
        try {
            const data = await fetchWithErrorHandling('http://localhost:3001/api/inventory');
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
        try {
            const added = await fetchWithErrorHandling('http://localhost:3001/api/inventory', {
                method: 'POST',
                body: JSON.stringify({
                    name: newItem.name,
                    currentStock: parseFloat(newItem.currentStock),
                    minStock: parseFloat(newItem.minStock)
                })
            });
            setInventory(prev => [...prev, added]);
            setNotification({ 
                message: 'Inventory item added successfully!', 
                type: 'success' 
            });
            setNewItem({ name: '', currentStock: '', minStock: '' });
            fetchInventory(); // Refresh the inventory list
        } catch (error) {
            console.error('Error adding inventory item:', error);
            setNotification({ 
                message: `Error adding inventory item: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleUpdateStock = async (id, currentStock) => {
        try {
            const updated = await fetchWithErrorHandling(`http://localhost:3001/api/inventory/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ currentStock })
            });
            setInventory(prev => prev.map(item => item.id === id ? updated : item));
            setNotification({ 
                message: 'Stock updated successfully!', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error updating stock:', error);
            setNotification({ 
                message: `Error updating stock: ${error.message || 'Please try again'}`, 
                type: 'error' 
            });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen rounded-lg shadow-inner">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Inventory Management</h2>
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">Add New Raw Material</h3>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Material Name</label>
                        <input type="text" id="name" name="name" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="e.g., Flour (kg)" required />
                    </div>
                    <div>
                        <label htmlFor="stock" className="block text-gray-700 text-sm font-bold mb-2">Initial Stock</label>
                        <input type="number" id="stock" name="stock" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="e.g., 100" min="0" required />
                    </div>
                    <div>
                        <label htmlFor="minStock" className="block text-gray-700 text-sm font-bold mb-2">Min Stock Alert</label>
                        <input type="number" id="minStock" name="minStock" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="e.g., 10" min="0" required />
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                        <button type="submit" className="btn-gradient px-6 py-2.5 transition-transform hover:scale-105">
                            Add Material
                        </button>
                    </div>
                </form>
            </div>
            <h3 className="text-2xl font-semibold text-gray-700 mb-4">Current Stock Levels</h3>
            <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {inventory.map(item => (
                            <tr key={item.id} className={item.currentStock < item.minStock ? 'bg-red-50' : ''}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.currentStock}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.minStock}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.currentStock < item.minStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {item.currentStock < item.minStock ? 'Low Stock' : 'In Stock'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleUpdateStock(item.id, item.currentStock + 1)} className="text-green-600 hover:text-green-900 mr-3">Add</button>
                                    <button onClick={() => handleUpdateStock(item.id, item.currentStock - 1)} className="text-red-600 hover:text-red-900">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InventoryManagement; 
