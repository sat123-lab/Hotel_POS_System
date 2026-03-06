import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, DollarSign, Package, Calendar, BarChart3, PieChart as PieChartIcon, ShoppingCart, TrendingDown, Activity, Download, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { io } from 'socket.io-client';
import API_URL from '../utils/api';







const Dashboard = ({ locationSettings }) => {


    // Authentication check
    const navigate = useNavigate();
    useEffect(() => {
        const user = localStorage.getItem("currentUser");
        const token = localStorage.getItem("authToken");
        if (!user || !token) {
            navigate("/login");
        }
    }, [navigate]);

    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [salesData, setSalesData] = useState({
        liveOrders: 0,
        totalOrdersToday: 0,
        totalSalesToday: 0,
        totalItemsSold: 0,
        topSellingItems: [],
        profitLoss: 0,
    });







    const [ordersData, setOrdersData] = useState([]);







    const [selectedDate, setSelectedDate] = useState(() => {



        const today = new Date();



        const year = today.getFullYear();



        const month = String(today.getMonth() + 1).padStart(2, '0');



        const day = String(today.getDate()).padStart(2, '0');



        return `${year}-${month}-${day}`;



    }); // YYYY-MM-DD



    



    // Get today's date in local format for max date attribute



    const getTodayLocalDate = () => {



        const today = new Date();



        const year = today.getFullYear();



        const month = String(today.getMonth() + 1).padStart(2, '0');



        const day = String(today.getDate()).padStart(2, '0');



        return `${year}-${month}-${day}`;



    };



    const todayLocalDate = getTodayLocalDate();


    const fetchDashboardData = useCallback(async () => {
        try {
            if (!isRefreshing) setIsLoading(true);
            
            const res = await fetch(`${API_URL}/api/orders?date=${selectedDate}`);
            
            if (!res.ok) {
                console.error('Server error:', res.status, res.statusText);
                setSalesData({
                    liveOrders: 0,
                    totalOrdersToday: 0,
                    totalSalesToday: 0,
                    totalItemsSold: 0,
                    topSellingItems: [],
                    profitLoss: 0,
                });
                setOrdersData([]);
                setIsLoading(false);
                return;
            }

            const orders = await res.json();
            setOrdersData(orders);
            setLastUpdated(new Date());
            
            if (!Array.isArray(orders)) {
                console.error('Orders response is not an array:', orders);
                setSalesData({
                    liveOrders: 0,
                    totalOrdersToday: 0,
                    totalSalesToday: 0,
                    totalItemsSold: 0,
                    topSellingItems: [],
                    profitLoss: 0,
                });
                setOrdersData([]);
                setIsLoading(false);
                return;
            }

            const activeOrders = orders.filter(o => o.status !== 'NOT_AVAILABLE');
            const completedOrders = orders.filter(o => o.status === 'completed');
            let totalOrdersToday = activeOrders.length;
            const totalSalesToday = completedOrders.reduce((sum, order) => sum + order.total, 0);

            let liveOrders = 0;
            if (selectedDate === todayLocalDate) {
                const liveOrdersRes = await fetch(`${API_URL}/api/orders/live-count`);
                if (liveOrdersRes.ok) {
                    const liveOrdersData = await liveOrdersRes.json();
                    liveOrders = liveOrdersData.count || 0;
                }
            }

            totalOrdersToday = activeOrders.length;

            const itemCounts = {};
            let totalItemsSold = 0;
            completedOrders.forEach(order => {
                (order.items || []).forEach(item => {
                    const quantity = item.quantity || item.qty || 1;
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + quantity;
                    totalItemsSold += quantity;
                });
            });

            const topSellingItems = Object.entries(itemCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));

            const totalCosts = totalItemsSold * 50; // Assume ₹50 cost per item
            const operationalCosts = 500; // Daily operational costs
            const profitLoss = totalSalesToday - totalCosts - operationalCosts;

            setSalesData({
                liveOrders,
                totalOrdersToday,
                totalSalesToday: totalSalesToday.toFixed(2),
                totalItemsSold,
                topSellingItems,
                profitLoss: profitLoss.toFixed(2),
            });
            setIsLoading(false);
            setIsRefreshing(false);

        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedDate, isRefreshing, todayLocalDate]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchDashboardData();
    };

    const getProfitLossColor = (value) => {
        const num = parseFloat(value);
        if (num > 0) return 'text-green-600';
        if (num < 0) return 'text-red-600';
        return 'text-gray-600';
    };

    const getProfitLossGradient = (value) => {
        const num = parseFloat(value);
        if (num > 0) return 'from-green-500 to-green-700';
        if (num < 0) return 'from-red-500 to-red-700';
        return 'from-gray-500 to-gray-700';
    };

    // Skeleton loading component
    const MetricCardSkeleton = () => (
        <div className="bg-gray-200 rounded-2xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gray-300 rounded-xl"></div>
                <div className="w-16 h-4 bg-gray-300 rounded"></div>
            </div>
            <div className="w-24 h-4 bg-gray-300 rounded mb-2"></div>
            <div className="w-32 h-8 bg-gray-300 rounded"></div>
        </div>
    );

    // Enhanced tooltip component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-sm text-gray-600">
                        {payload[0].name}: <span className="font-bold text-indigo-600">{locationSettings.currencySymbol}{payload[0].value.toFixed(2)}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomPieTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{payload[0].name}</p>
                    <p className="text-sm text-gray-600">
                        Orders: <span className="font-bold text-indigo-600">{payload[0].value}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    useEffect(() => {
        const socket = io(API_URL.replace('https://', 'wss://').replace('http://', 'ws://'));
        socket.on('order_status_updated', () => {
            fetchDashboardData();
        });
        socket.on('order_created', () => {
            fetchDashboardData();
        });
        socket.on('order_deleted', () => {
            fetchDashboardData();
        });
        return () => {
            socket.disconnect();
        };
    }, [fetchDashboardData]);

    const getOrdersByType = () => {
        const typeCounts = {
            'Dine-In': 0,
            'Takeaway': 0,
            'QR Code': 0
        };

        ordersData.forEach(order => {
            if (order.type === 'DINE_IN') {
                typeCounts['Dine-In']++;
            } else if (order.type === 'TAKEAWAY') {
                typeCounts['Takeaway']++;
            } else if (order.type === 'QR_CODE') {
                typeCounts['QR Code']++;
            }
        });

        return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
    };

    const getSalesTrend = () => {
        const hourlySales = {};

        for (let hour = 0; hour <= 23; hour++) {
            const displayHour = hour === 0 ? '12 AM' : 
                               hour === 12 ? '12 PM' : 
                               hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
            hourlySales[displayHour] = 0;
        }

        const completedOrders = ordersData.filter(order => order.status === 'completed');

        completedOrders.forEach(order => {
            const orderDate = new Date(order.timestamp || order.created_at);
            const hour = orderDate.getHours();
            const displayHour = hour === 0 ? '12 AM' : 
                               hour === 12 ? '12 PM' : 
                               hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
            if (hourlySales[displayHour] !== undefined) {
                hourlySales[displayHour] += order.total || 0;
            }
        });

        return Object.entries(hourlySales).map(([hour, sales]) => ({ hour, sales }));
    };



    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xl">
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-2">Dashboard & Analytics</h2>
                            <p className="text-blue-100 text-lg">Real-time restaurant performance metrics</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                                <Activity className="w-4 h-4 text-green-300 animate-pulse" />
                                <span className="text-white text-sm font-medium">Live</span>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors"
                                disabled={isRefreshing}
                            >
                                <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span className="text-white text-sm font-medium">Refresh</span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <BarChart3 className="w-8 h-8 text-blue-200" />
                                <PieChartIcon className="w-8 h-8 text-purple-200" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-blue-100 text-sm">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                        {selectedDate === todayLocalDate && (
                            <div className="flex items-center space-x-2 bg-green-500/20 px-3 py-1 rounded-full">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-green-100 text-xs font-medium">Real-time updates enabled</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Date Picker Section */}
            <div className="px-6 py-4">
                <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                        <div className="flex items-center space-x-3">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <label htmlFor="date-picker" className="text-lg font-semibold text-gray-700">
                                Select Date:
                            </label>
                        </div>
                        <input
                            type="date"
                            id="date-picker"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all duration-200"
                            max={todayLocalDate}
                        />
                        <span className="text-sm text-gray-600 bg-indigo-50 px-4 py-2 rounded-lg font-medium">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </span>
                    </div>
                </div>
            </div>



            <div className="px-6 pb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="group relative bg-gradient-to-br from-orange-400 to-orange-600 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <ShoppingCart className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-white/80 text-sm font-medium">Live</span>
                            </div>
                            <p className="text-white/90 text-sm font-medium mb-1">Live Orders</p>
                            <p className="text-4xl font-bold text-white">{salesData.liveOrders}</p>
                        </div>
                    </div>

                    <div className="group relative bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-white/80 text-sm font-medium">Today</span>
                            </div>
                            <p className="text-white/90 text-sm font-medium mb-1">Total Orders</p>
                            <p className="text-4xl font-bold text-white">{salesData.totalOrdersToday}</p>
                        </div>
                    </div>

                    <div className="group relative bg-gradient-to-br from-green-500 to-green-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <DollarSign className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-white/80 text-sm font-medium">Revenue</span>
                            </div>
                            <p className="text-white/90 text-sm font-medium mb-1">Total Sales</p>
                            <p className="text-4xl font-bold text-white">{locationSettings.currencySymbol}{salesData.totalSalesToday}</p>
                        </div>
                    </div>

                    <div className="group relative bg-gradient-to-br from-purple-500 to-purple-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Package className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-white/80 text-sm font-medium">Items</span>
                            </div>
                            <p className="text-white/90 text-sm font-medium mb-1">Total Items</p>
                            <p className="text-4xl font-bold text-white">{salesData.totalItemsSold}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="px-6 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Orders by Type Pie Chart */}
                    <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                                    <PieChartIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Orders by Type</h3>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Download className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                        {isLoading ? (
                            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={getOrdersByType()}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        fill="#8884d8"
                                        label={({ name, value, percent }) => value > 0 ? `${name}: ${value}` : ''}
                                        labelLine={false}
                                        minAngle={15}
                                    >
                                        <Cell key="dinein" fill="#34d399" />
                                        <Cell key="takeaway" fill="#60a5fa" />
                                        <Cell key="qr" fill="#f59e42" />
                                    </Pie>
                                    <RechartsTooltip content={<CustomPieTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36}
                                        formatter={(value, entry) => `${entry.payload.name}: ${entry.payload.value}`}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Sales Trend Line Chart */}
                    <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="p-2 bg-green-100 rounded-lg mr-3">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Sales Trend ({new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</h3>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Download className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                        {isLoading ? (
                            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={getSalesTrend()}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis 
                                        dataKey="hour" 
                                        stroke="#6b7280"
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis 
                                        stroke="#6b7280"
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => `${locationSettings.currencySymbol}${value}`}
                                    />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line 
                                        type="monotone" 
                                        dataKey="sales" 
                                        stroke="#6366f1" 
                                        strokeWidth={3} 
                                        dot={{ r: 5, fill: '#6366f1' }}
                                        activeDot={{ r: 7 }}
                                        name="Sales"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>



            {/* Top Selling Items Section */}
            <div className="px-6 pb-8">
                <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg mr-3">
                                <Package className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Top-Selling Items ({new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</h3>
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Download className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
                                        <div>
                                            <div className="w-32 h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                                            <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="w-16 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                                        <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : salesData.topSellingItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-lg">No sales data yet.</p>
                            <p className="text-gray-400 text-sm mt-2">Start taking orders to see your best-selling items here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {salesData.topSellingItems.map((item, index) => (
                                <div key={index} className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:shadow-md">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold text-gray-900">{item.name}</p>
                                            <p className="text-sm text-gray-500">Best seller</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-gray-900">{item.count}</p>
                                        <p className="text-sm text-gray-500">items sold</p>
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
                    <p>Dashboard updates automatically every 10 seconds</p>
                    <p className="mt-1">Last sync: {lastUpdated.toLocaleString()}</p>
                </div>
            </div>
        </div>

    );



};







export default Dashboard; 



