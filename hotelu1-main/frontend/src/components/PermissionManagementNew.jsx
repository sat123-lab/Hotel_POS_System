import React, { useState, useEffect } from 'react';
import Notification from './Notification';
import {
  Users,
  Clipboard,
  Box,
  CreditCard,
  BarChart2,
  Settings,
  Lock,
  Crown,
  Briefcase,
  UserCheck,
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';

// Permission descriptions in simple language
const PERMISSION_GROUPS = {
  user_management: {
    title: 'User Management',
    icon: <Users className="inline-block mr-2 text-blue-500" />,
    description: 'Control who can access the system',
    permissions: [
      { name: 'view_users', label: 'View Staff List', simple: 'See all employees in the system' },
      { name: 'create_user', label: 'Add New Staff', simple: 'Create new employee accounts' },
      { name: 'edit_user', label: 'Edit Staff Info', simple: 'Change employee details' },
      { name: 'delete_user', label: 'Remove Staff', simple: 'Delete employee accounts' },
      { name: 'manage_roles', label: 'Assign Roles', simple: 'Give employees different job titles with permissions' },
    ],
  },
  menu_management: {
    title: 'Menu Management',
    icon: <Box className="inline-block mr-2 text-amber-500" />,
    description: 'Manage restaurant menu items',
    permissions: [
      { name: 'view_menu', label: 'View Menu', simple: 'See all dishes and items' },
      { name: 'create_menu_item', label: 'Add Dishes', simple: 'Add new items to the menu' },
      { name: 'edit_menu_item', label: 'Edit Dishes', simple: 'Change dish names, prices, descriptions' },
      { name: 'delete_menu_item', label: 'Remove Dishes', simple: 'Delete items from menu' },
    ],
  },
  order_management: {
    title: 'Order Management',
    icon: <Clipboard className="inline-block mr-2 text-emerald-500" />,
    description: 'Handle customer orders',
    permissions: [
      { name: 'view_orders', label: 'View Orders', simple: 'See all customer orders' },
      { name: 'create_order', label: 'Create Orders', simple: 'Take orders from customers' },
      { name: 'edit_order', label: 'Edit Orders', simple: 'Modify order details' },
      { name: 'delete_order', label: 'Cancel Orders', simple: 'Cancel customer orders' },
      { name: 'manage_qr_codes', label: 'QR Code Ordering', simple: 'Allow customers to order via QR codes' },
      { name: 'mark_order_preparing', label: 'Mark Orders Preparing', simple: 'Mark orders as being prepared in kitchen' },
      { name: 'mark_order_ready', label: 'Mark Orders Ready', simple: 'Mark orders as ready for pickup' },
      { name: 'confirm_order_delivery', label: 'Confirm Delivery', simple: 'Confirm order delivery and generate bills' },
    ],
  },
  inventory_management: {
    title: 'Inventory Management',
    icon: <Box className="inline-block mr-2 text-violet-500" />,
    description: 'Track stock and ingredients',
    permissions: [
      { name: 'view_inventory', label: 'Check Stock', simple: 'See what items are in stock' },
      { name: 'edit_inventory', label: 'Update Stock', simple: 'Add or remove items from inventory' },
    ],
  },
  billing: {
    title: 'Billing & Payments',
    icon: <CreditCard className="inline-block mr-2 text-indigo-500" />,
    description: 'Process payments and bills',
    permissions: [
      { name: 'view_billing', label: 'View Bills', simple: 'See billing information' },
      { name: 'process_payments', label: 'Process Payments', simple: 'Accept and process customer payments' },
      { name: 'view_bills', label: 'Bill History', simple: 'View past bills and transactions' },
    ],
  },
  reporting: {
    title: 'Dashboard & Reports',
    icon: <BarChart2 className="inline-block mr-2 text-sky-500" />,
    description: 'View business analytics',
    permissions: [
      { name: 'view_dashboard', label: 'View Dashboard', simple: 'See sales, orders, and business overview' },
      { name: 'view_reports', label: 'View Reports', simple: 'Access detailed business reports' },
      { name: 'kitchen_display', label: 'Kitchen Display', simple: 'View orders in kitchen' },
    ],
  },
  settings: {
    title: 'System Settings',
    icon: <Settings className="inline-block mr-2 text-gray-600" />,
    description: 'Configure system features',
    permissions: [
      { name: 'manage_settings', label: 'System Settings', simple: 'Configure system preferences' },
      { name: 'manage_subfranchise', label: 'Multi-Location Control', simple: 'Manage multiple restaurant locations' },
    ],
  },
};

const ROLE_PRESETS = {
  admin: {
    title: 'Super Admin',
    description: 'Full access to everything',
    icon: <Crown className="text-red-500" />,
    color: 'from-red-500 to-red-600',
  },
  manager: {
    title: 'Restaurant Manager',
    description: 'Manage daily operations',
    icon: <Briefcase className="text-blue-500" />,
    color: 'from-blue-500 to-blue-600',
  },
  waiter: {
    title: 'Waiter/Server',
    description: 'Take orders and process payments',
    icon: <UserCheck className="text-green-500" />,
    color: 'from-green-500 to-green-600',
  },
  chef: {
    title: 'Chef/Kitchen',
    description: 'Prepare food and track orders',
    icon: <Briefcase className="text-orange-500" />,
    color: 'from-orange-500 to-orange-600',
  },
  franchise: {
    title: 'Franchise Owner',
    description: 'View all locations and reports',
    icon: <Briefcase className="text-purple-500" />,
    color: 'from-purple-500 to-purple-600',
  },
};

const PermissionManagementNew = ({ token }) => {
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [editingRoleId, setEditingRoleId] = useState(null);

  // Fetch roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setNotification({ message: 'Could not load roles', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions
  const fetchPermissions = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setNotification({ message: 'Could not load permissions', type: 'error' });
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  // Create role
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setNotification({ message: 'Please enter a role name', type: 'error' });
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDesc,
          permissions: selectedPermissions,
        }),
      });

      if (response.ok) {
        setNotification({ message: 'Role created successfully! ✓', type: 'success' });
        setNewRoleName('');
        setNewRoleDesc('');
        setSelectedPermissions([]);
        setShowCreateForm(false);
        fetchRoles();
      } else {
        const error = await response.json();
        setNotification({ message: error.message || 'Error creating role', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const togglePermission = (permName) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName]
    );
  };

  const startEditingRole = (role) => {
    setEditingRoleId(role.id);
    setSelectedPermissions(role.permissions || []);
    setExpandedRole(role.id);
  };

  const handleUpdateRolePermissions = async (roleId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: selectedPermissions }),
      });

      if (response.ok) {
        setNotification({ message: 'Permissions updated successfully! ✓', type: 'success' });
        setEditingRoleId(null);
        fetchRoles();
      } else {
        const error = await response.json();
        setNotification({ message: error.message, type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
            <Lock className="mr-3 text-blue-600" /> System Access Control
          </h1>
          <p className="text-gray-700 text-lg">Manage who can do what in your restaurant</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'roles'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="inline-flex items-center gap-2"><Users className="text-blue-500" /> Manage Roles (Jobs)</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'permissions'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="inline-flex items-center gap-2"><Clipboard className="text-emerald-500" /> View Permissions</span>
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {/* Create New Role Button */}
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 text-lg flex items-center justify-center gap-3"
              >
                <Plus className="w-5 h-5" /> Create New Role / Job Title
              </button>
            )}

            {/* Create Role Form */}
            {showCreateForm && (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Role</h2>
                <form onSubmit={handleCreateRole} className="space-y-6">
                  <div>
                    <label className="block text-gray-900 font-semibold mb-2">Role/Job Title Name</label>
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g., Senior Waiter, Assistant Chef"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Description</label>
                    <textarea
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      placeholder="What does this person do? e.g., Takes orders, manages tables, handles payments"
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                      rows="3"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-900 font-semibold mb-4">What can they do? (Select all that apply)</label>
                    <div className="grid md:grid-cols-2 gap-4">
                      {Object.values(PERMISSION_GROUPS).map((group) => (
                        <div key={group.title} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <h3 className="font-semibold text-gray-900 mb-3">{group.icon} {group.title}</h3>
                          <div className="space-y-2">
                            {group.permissions.map((perm) => (
                              <label key={perm.name} className="flex items-start gap-3 cursor-pointer hover:bg-slate-600 p-2 rounded transition">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.name)}
                                  onChange={() => togglePermission(perm.name)}
                                  className="w-5 h-5 mt-0.5 rounded accent-blue-500"
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{perm.label}</div>
                                  <div className="text-xs text-gray-600">{perm.simple}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition inline-flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Create Role
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition inline-flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Existing Roles */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Existing Roles</h2>
              {loading ? (
                <div className="text-center text-gray-600">Loading roles...</div>
              ) : roles.length === 0 ? (
                <div className="text-center text-gray-600 py-8">No roles created yet</div>
              ) : (
                roles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition"
                  >
                    <button
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900 capitalize">{role.name}</h3>
                        <p className="text-gray-600 text-sm">{role.description}</p>
                      </div>
                      <div className="text-gray-500">{expandedRole === role.id ? <ChevronDown /> : <ChevronRight />}</div>
                    </button>

                    {expandedRole === role.id && (
                      <div className="bg-gray-50 border-t border-gray-100 p-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-4">Current Permissions: {role.permissions?.length || 0}</h4>
                          {editingRoleId === role.id ? (
                            <div className="space-y-6">
                              <div className="grid md:grid-cols-2 gap-4">
                                {Object.values(PERMISSION_GROUPS).map((group) => (
                                  <div key={group.title} className="bg-white rounded-lg p-4 border border-gray-100">
                                    <h3 className="font-semibold text-gray-900 mb-3">{group.icon} {group.title}</h3>
                                    <div className="space-y-2">
                                      {group.permissions.map((perm) => (
                                        <label key={perm.name} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition">
                                          <input
                                            type="checkbox"
                                            checked={selectedPermissions.includes(perm.name)}
                                            onChange={() => togglePermission(perm.name)}
                                            className="w-5 h-5 mt-0.5 rounded accent-blue-500"
                                          />
                                          <div>
                                            <div className="font-medium text-gray-900">{perm.label}</div>
                                            <div className="text-xs text-gray-600">{perm.simple}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleUpdateRolePermissions(role.id)}
                                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition inline-flex items-center justify-center gap-2"
                                >
                                  <Check className="w-4 h-4" /> Save Changes
                                </button>
                                <button
                                  onClick={() => setEditingRoleId(null)}
                                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition inline-flex items-center justify-center gap-2"
                                >
                                  <X className="w-4 h-4" /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {role.permissions?.map((perm) => (
                                  <span
                                    key={perm}
                                    className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border border-gray-200"
                                  >
                                    <Check className="w-3 h-3 text-green-600" /> {perm.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => startEditingRole(role)}
                                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md inline-flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" /> Edit Permissions
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">All Available Permissions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(PERMISSION_GROUPS).map((group) => (
                <div key={group.title} className="bg-white rounded-lg p-6 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{group.icon} {group.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{group.description}</p>
                  <div className="space-y-3">
                    {group.permissions.map((perm) => (
                      <div key={perm.name} className="bg-gray-50 rounded p-3 border border-gray-100">
                        <div className="font-semibold text-gray-900">{perm.label}</div>
                        <div className="text-sm text-gray-600">{perm.simple}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionManagementNew;
