import React, { useState, useEffect } from 'react';
import Notification from './Notification';

import { getAPI_URL } from '../utils/api';

const UserManagement = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'waiter',
  });

  const roles = ['admin', 'franchise', 'subfranchise', 'manager', 'waiter', 'chef'];

  // Fetch all users on component mount
  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', name: '', role: 'waiter' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.name || !formData.role) {
      setNotification({ message: 'Username, name, and role are required', type: 'error' });
      return;
    }

    if (!editingId && !formData.password) {
      setNotification({ message: 'Password is required for new users', type: 'error' });
      return;
    }

    if (formData.password && formData.password.length < 4) {
      setNotification({ message: 'Password must be at least 4 characters', type: 'error' });
      return;
    }

    try {
      const API_URL = getAPI_URL();
      const url = editingId
        ? `${API_URL}/api/users/${editingId}`
        : `${API_URL}/api/users`;

      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? {
            username: formData.username,
            name: formData.name,
            role: formData.role,
            ...(formData.password && { password: formData.password })
          }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ message: data.message || 'Operation failed', type: 'error' });
        return;
      }

      const message = editingId ? 'User updated successfully!' : 'User created successfully!';
      setNotification({ message, type: 'success' });
      resetForm();
      fetchUsers();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const handleEdit = (user) => {
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setNotification({ message: data.message || 'Failed to delete user', type: 'error' });
        return;
      }

      setNotification({ message: `User "${username}" deleted successfully!`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 bg-[#FFF8F0] min-h-screen">
      {/* Header Section - Orange Theme */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">User Management</h2>
              <p className="text-orange-100 text-base">Manage system users and roles</p>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-white text-sm font-medium">Team</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Add/Edit User Button - Orange Style */}
      <div className="mb-6">
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
              setEditingId(null);
              setFormData({ username: '', password: '', name: '', role: 'waiter' });
            }
          }}
          className={`px-6 py-3 rounded-xl font-bold transition ${
            showForm
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg'
          }`}
        >
          {showForm ? 'Cancel' : '+ Add New User'}
        </button>
      </div>

      {/* Form - White Card with Orange Accents */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 border border-orange-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="w-2 h-6 bg-orange-500 rounded-full mr-3"></span>
            {editingId ? 'Edit User' : 'Create New User'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  disabled={editingId ? true : false}
                    className={`w-full px-4 py-3 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 ${
                    editingId ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  required
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {editingId && <span className="text-gray-500">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={editingId ? 'Leave blank to keep current' : 'Enter password (min 4 chars)'}
                  className="w-full px-4 py-3 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  required={!editingId}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingId ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-700 font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-orange-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-orange-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800">
              Existing Users ({users.length})
            </h3>
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-xl">
              <svg className="w-5 h-5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-orange-600 font-medium">Loading users...</span>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold text-lg">No users found</p>
            <p className="text-gray-500 text-sm mt-2">Add a new user to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-50 to-white border-b-2 border-orange-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Username
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .884-.56 1.634-1.333 1.918M12 13a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                      Full Name
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Role
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Actions
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className={`border-b hover:bg-gradient-to-r hover:from-orange-50 hover:to-white transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-sm">{user.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-gray-800 font-semibold">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                        user.role === 'admin'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                          : user.role === 'chef'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                          : user.role === 'waiter'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                          : user.role === 'manager'
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                          : user.role === 'franchise'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                      }`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.username)}
                          className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
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

export default UserManagement;
