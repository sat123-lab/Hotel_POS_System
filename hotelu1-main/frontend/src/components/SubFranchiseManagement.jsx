import React, { useState, useEffect, useCallback } from "react";
import { Building, Plus, Pencil, Trash2, MapPin, Phone, Mail, DollarSign, Eye } from "lucide-react";
import { authFetch } from "../utils/api";
import Notification from "./Notification";
import LocationDetailPanel from "./LocationDetailPanel";
import useCurrency from "../hooks/useCurrency";

const emptyForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  manager_name: "",
  status: "active",
  notes: "",
  login_username: "",
  login_password: "",
  owner_user_id: "",
};

const SubFranchiseManagement = ({ currentUser, locationSettings }) => {
  const isAdmin = currentUser?.role === "admin";
  const { format: fmt } = useCurrency(locationSettings);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notification, setNotification] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [franchiseUsers, setFranchiseUsers] = useState([]);

  const loadFranchiseUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const token = localStorage.getItem("token");
      const res = await authFetch("/api/users");
      if (res.ok) {
        const users = await res.json();
        setFranchiseUsers(users.filter((u) => u.role === "franchise"));
      }
    } catch (_) {
      /* ignore */
    }
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/subfranchises");
      if (!res.ok) throw new Error("Failed to load sub-franchises");
      setList(await res.json());
    } catch (e) {
      setNotification({ message: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadFranchiseUsers();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, loadFranchiseUsers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      code: row.code || "",
      address: row.address || "",
      city: row.city || "",
      phone: row.phone || "",
      email: row.email || "",
      manager_name: row.manager_name || "",
      status: row.status || "active",
      notes: row.notes || "",
      login_username: row.loginUsername || "",
      login_password: "",
      owner_user_id: row.owner_user_id ? String(row.owner_user_id) : "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setNotification({ message: "Name and code are required", type: "error" });
      return;
    }
    try {
      const url = editingId
        ? `/api/subfranchises/${editingId}`
        : "/api/subfranchises";
      const res = await authFetch(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Save failed");
      }
      const saved = await res.json();
      setNotification({
        message: editingId
          ? "Location updated"
          : `Location added${form.login_username ? `. Login: ${form.login_username}` : ""}`,
        type: "success",
      });
      setShowForm(false);
      load();
    } catch (err) {
      setNotification({ message: err.message, type: "error" });
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete sub-franchise "${name}"?`)) return;
    try {
      const res = await authFetch(`/api/subfranchises/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setNotification({ message: "Location removed", type: "success" });
      load();
    } catch (e) {
      setNotification({ message: e.message, type: "error" });
    }
  };

  return (
    <div className="p-4 md:p-6 bg-[#FFF8F0] min-h-screen">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              <Building className="w-8 h-8" /> Sub-Franchise Management
            </h2>
            <p className="text-orange-100 mt-1">Add and manage restaurant locations</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-white text-orange-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-orange-50"
          >
            <Plus className="w-5 h-5" /> Add Location
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Loading locations...</p>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-orange-100 p-12 text-center text-gray-600">
          <MapPin className="w-12 h-12 text-orange-300 mx-auto mb-3" />
          <p className="font-medium">No sub-franchises yet</p>
          <p className="text-sm mt-1">Click &quot;Add Location&quot; to create your first branch.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((sf) => (
            <div
              key={sf.id}
              role={isAdmin ? "button" : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              onClick={isAdmin ? () => setDetailId(sf.id) : undefined}
              onKeyDown={isAdmin ? (e) => e.key === "Enter" && setDetailId(sf.id) : undefined}
              className={`bg-white rounded-2xl border border-orange-100 p-5 shadow-sm transition-all text-left ${
                isAdmin ? "hover:shadow-md hover:border-orange-300 cursor-pointer" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{sf.name}</h3>
                  <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                    {sf.code}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    sf.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {sf.status}
                </span>
              </div>
              {sf.city && (
                <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> {sf.address ? `${sf.address}, ` : ""}
                  {sf.city}
                </p>
              )}
              {sf.manager_name && (
                <p className="text-sm text-gray-700">Manager: {sf.manager_name}</p>
              )}
              {sf.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-3.5 h-3.5" /> {sf.phone}
                </p>
              )}
              {sf.email && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {sf.email}
                </p>
              )}
              {sf.loginUsername && (
                <p className="text-xs text-orange-600 mt-2 font-mono">Login: {sf.loginUsername}</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3 p-3 bg-orange-50 rounded-lg text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Total sales</p>
                  <p className="font-bold text-orange-600">{fmt(sf.totalSales)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Active / Total orders</p>
                  <p className="font-bold">{sf.activeOrders || 0} / {sf.totalOrders || 0}</p>
                </div>
              </div>
              {isAdmin && (
                <p className="text-xs text-gray-500 mt-2">Click card for orders & sales detail</p>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDetailId(sf.id); }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  <Eye className="w-4 h-4" />
                </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openEdit(sf); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(sf.id, sf.name); }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingId ? "Edit Location" : "New Sub-Franchise"}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SF-HYD"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  value={form.manager_name}
                  onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              {isAdmin && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Franchise owner (links location to franchise login)
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={form.owner_user_id}
                    onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}
                  >
                    <option value="">— None —</option>
                    {franchiseUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-orange-700">Branch login (sub-franchise)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2"
                      value={form.login_username}
                      onChange={(e) => setForm({ ...form, login_username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2"
                      value={form.login_password}
                      onChange={(e) => setForm({ ...form, login_password: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600"
                >
                  {editingId ? "Save Changes" : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && detailId && (
        <LocationDetailPanel
          locationId={detailId}
          locationSettings={locationSettings}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
};

export default SubFranchiseManagement;
