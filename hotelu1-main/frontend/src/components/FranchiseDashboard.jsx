import React, { useState, useEffect, useCallback } from "react";
import {
  Building,
  DollarSign,
  ShoppingBag,
  MapPin,
  RefreshCw,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { authFetch } from "../utils/api";
import LocationDetailPanel from "./LocationDetailPanel";
import useCurrency from "../hooks/useCurrency";

const FranchiseDashboard = ({ currentUser, locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const isSubFranchise = currentUser?.role === "subfranchise";
  const isFranchiseOwner = currentUser?.role === "franchise";
  const isFranchiseLogin = isSubFranchise || isFranchiseOwner;
  const isAdmin = currentUser?.role === "admin";

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/franchise/overview");
      if (!res.ok) throw new Error("Failed to load franchise overview");
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000);
    return () => clearInterval(interval);
  }, [loadOverview]);

  const stats = data?.stats || {};
  const locations = data?.subfranchises || [];
  const unassigned = data?.unassigned;
  const recentOrders = data?.recentOrders || [];
  const myLocation = isSubFranchise ? locations[0] : null;

  return (
    <div className="p-4 md:p-6 bg-[#FFF8F0] min-h-screen">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
        <div className="px-6 py-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-1 flex items-center justify-center gap-2">
            <Building className="w-8 h-8" />
            {isSubFranchise ? "My Location Overview" : "Franchise Overview"}
          </h2>
          <p className="text-orange-100">
            Welcome, {currentUser?.name || "Franchise Owner"}
            {isFranchiseLogin && " — only your franchise orders & sales"}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadOverview();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 rounded-lg text-orange-600 hover:bg-orange-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh (live)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Sales", value: fmt(stats.totalSales), icon: DollarSign, color: "text-orange-600" },
          { label: "Today's Sales", value: fmt(stats.todaySales), icon: Calendar, color: "text-blue-600" },
          { label: "Amount Generated", value: fmt(stats.amountGenerated), icon: TrendingUp, color: "text-green-600" },
          { label: "Active Orders", value: stats.activeOrders ?? 0, icon: ShoppingBag, color: "text-green-600" },
          {
            label: isSubFranchise ? "Total Orders" : "Locations",
            value: isSubFranchise ? (stats.totalOrders ?? 0) : (stats.subfranchiseCount ?? 0),
            icon: isSubFranchise ? ShoppingBag : MapPin,
            color: "text-orange-600",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-2xl shadow-lg border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-600">{card.label}</h3>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {isSubFranchise && myLocation && (
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{myLocation.name}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {myLocation.city || "—"} · Code: {myLocation.code}
            {myLocation.manager_name && ` · Manager: ${myLocation.manager_name}`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs">Total sales</p>
              <p className="font-bold text-orange-600">{fmt(myLocation.totalSales)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs">Today</p>
              <p className="font-bold text-blue-600">{fmt(myLocation.todaySales)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs">Active orders</p>
              <p className="font-bold text-green-700">{myLocation.activeOrders || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs">Total orders</p>
              <p className="font-bold">{myLocation.totalOrders || 0}</p>
            </div>
          </div>
        </div>
      )}

      {isAdmin && unassigned && unassigned.totalOrders > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900">
          <strong>Main branch (unassigned orders):</strong> {unassigned.totalOrders} orders · Sales{" "}
          {fmt(unassigned.totalSales)} — orders not linked to a sub-franchise location yet.
        </div>
      )}

      {isFranchiseOwner && locations.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-900">
          <strong>No location linked yet.</strong> Ask admin to assign your franchise account to a location, or
          create one under Manage Sub-Franchises.
        </div>
      )}

      {!isSubFranchise && (
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-bold text-gray-800">Location Performance</h3>
            </div>
            {isAdmin && (
              <p className="text-xs text-gray-500">Admin: click a row for orders & details</p>
            )}
          </div>
          {loading && !data ? (
            <p className="p-8 text-center text-gray-500">Loading...</p>
          ) : locations.length === 0 ? (
            <p className="p-8 text-center text-gray-500">
              No locations yet. Add sub-franchises in Manage Sub-Franchises.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 text-gray-700">
                  <tr>
                    <th className="text-left p-4">Location</th>
                    <th className="text-left p-4">City</th>
                    <th className="text-right p-4">Total Sales</th>
                    <th className="text-right p-4">Today</th>
                    <th className="text-right p-4">Orders</th>
                    <th className="text-right p-4">Active</th>
                    <th className="text-center p-4">Login</th>
                    <th className="text-center p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr
                      key={loc.id}
                      onClick={isAdmin ? () => setSelectedId(loc.id) : undefined}
                      className={`border-t border-gray-100 transition-colors ${
                        isAdmin ? "hover:bg-orange-50 cursor-pointer" : ""
                      }`}
                    >
                      <td className="p-4 font-medium text-gray-900">{loc.name}</td>
                      <td className="p-4 text-gray-600">{loc.city || "—"}</td>
                      <td className="p-4 text-right font-semibold text-orange-600">
                        {fmt(loc.totalSales)}
                      </td>
                      <td className="p-4 text-right text-blue-600">{fmt(loc.todaySales)}</td>
                      <td className="p-4 text-right">{loc.totalOrders ?? 0}</td>
                      <td className="p-4 text-right text-green-600">{loc.activeOrders || 0}</td>
                      <td className="p-4 text-center text-xs font-mono text-gray-600">
                        {loc.loginUsername || "—"}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            loc.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {loc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(isFranchiseLogin || isAdmin) && (
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-100">
            <h3 className="text-lg font-bold text-gray-800">
              {isSubFranchise ? "My Orders" : isFranchiseOwner ? "My Franchise Orders" : "Recent orders (all locations)"}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isFranchiseLogin
                ? "Only orders linked to your franchise locations"
                : "Admin: open a location row above for full detail"}
            </p>
          </div>
          {recentOrders.length === 0 ? (
            <p className="p-8 text-center text-gray-500">No orders for this scope yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Table / Type</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-left p-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="p-3 font-mono text-xs">{o.id}</td>
                      <td className="p-3">
                        {o.table_name || "—"} <span className="text-gray-400">({o.type || "—"})</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700">
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(o.total)}</td>
                      <td className="p-3 text-gray-500 text-xs">
                        {o.timestamp ? new Date(o.timestamp).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isAdmin && selectedId && (
        <LocationDetailPanel
          locationId={selectedId}
          locationSettings={locationSettings}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
};

export default FranchiseDashboard;
