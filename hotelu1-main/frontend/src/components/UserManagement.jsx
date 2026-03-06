import React, { useState, useEffect } from 'react';
import Notification from './Notification';

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
      const response = await fetch('http://localhost:3001/api/users', {
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
      const url = editingId
        ? `http://localhost:3001/api/users/${editingId}`
        : 'http://localhost:3001/api/users';

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
      const response = await fetch(`http://localhost:3001/api/users/${id}`, {
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">User Management</h2>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Add/Edit User Button */}
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
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            showForm
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'btn-gradient'
          }`}
        >
          {showForm ? 'Cancel' : '+ Add New User'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 ${
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
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
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                {editingId ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h3 className="text-xl font-bold text-gray-800 p-6 border-b">
          Existing Users ({users.length})
        </h3>
        
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-white font-semibold text-xs ${
                        user.role === 'admin'
                          ? 'bg-red-500'
                          : user.role === 'chef'
                          ? 'bg-orange-500'
                          : user.role === 'waiter'
                          ? 'bg-blue-500'
                          : user.role === 'manager'
                          ? 'bg-purple-500'
                          : 'bg-gray-500'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-3 py-1 btn-gradient text-xs rounded transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.username)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition"
                      >
                        Delete
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

export default UserManagement;
