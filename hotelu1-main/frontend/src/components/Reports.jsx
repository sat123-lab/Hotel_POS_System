import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { TrendingUp, DollarSign, Package, Calendar, Download, FileText, BarChart3, PieChart as PieChartIcon, Filter, RefreshCw, Activity } from 'lucide-react';
import * as XLSX from 'xlsx';

const Reports = ({ locationSettings }) => {
    const [reportType, setReportType] = useState('daily');
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [endDate, setEndDate] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [ordersData, setOrdersData] = useState([]);
    const [reportData, setReportData] = useState({
        totalSales: 0,
        totalOrders: 0,
        totalItems: 0,
        topSellingItems: [],
        ordersByType: [],
        salesTrend: [],
        profitLoss: 0,
        avgOrderValue: 0
    });
    const [isLoading, setIsLoading] = useState(false);
    const [dateError, setDateError] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    
    // Get today's date in local format for max date attributes
    const getTodayLocalDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const todayLocalDate = getTodayLocalDate();

    const buildExcelFileName = useCallback((type, start, end) => {
        const safeType = (type || 'report').toLowerCase();
        if (!start || !end) return `${safeType}-report.xlsx`;
        return `${safeType}-report_${start}_to_${end}.xlsx`;
    }, []);

    // Enhanced tooltip components
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-sm text-gray-600">
                        Sales: <span className="font-bold text-indigo-600">{locationSettings.currencySymbol}{payload[0].value.toFixed(2)}</span>
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

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchReportData(false);
    };

    const toDateTime = (value) => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d;
    };

    const getOrderItemsArray = (order) => {
        if (!order) return [];
        const items = order.items;
        if (Array.isArray(items)) return items;
        if (items && Array.isArray(items.dataValues)) return items.dataValues;
        return [];
    };

    const getItemField = (item, field) => {
        if (!item) return undefined;
        if (item[field] !== undefined) return item[field];
        if (item.dataValues && item.dataValues[field] !== undefined) return item.dataValues[field];
        return undefined;
    };

    const getItemName = (item) => {
        return getItemField(item, 'name') ?? getItemField(item, 'itemName') ?? getItemField(item, 'title');
    };

    const getItemQuantity = (item) => {
        const q = getItemField(item, 'quantity') ?? getItemField(item, 'qty');
        const n = Number(q);
        return Number.isFinite(n) && n > 0 ? n : 1;
    };

    const getItemPrice = (item) => {
        const p = getItemField(item, 'price') ?? getItemField(item, 'unitPrice');
        const n = Number(p);
        return Number.isFinite(n) ? n : undefined;
    };

    const formatYMD = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const formatYM = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    };

    const formatHourLabel = (d) => {
        const hour = d.getHours();
        const displayHour = hour === 0 ? 12 : (hour <= 12 ? hour : hour - 12);
        const ampm = hour < 12 ? 'AM' : 'PM';
        return `${displayHour} ${ampm}`;
    };

    const isSingleDayRange = (start, end) => {
        if (!start || !end) return false;
        return start === end;
    };

    const getPeriodKeyForItemSales = (type, d, start, end) => {
        if (type === 'daily') {
            return isSingleDayRange(start, end) ? formatHourLabel(d) : formatYMD(d);
        }
        if (type === 'yearly') return formatYM(d);
        return formatYMD(d); // weekly + monthly
    };

    const exportReportToExcel = useCallback((type, start, end, summary, orders, currencySymbol) => {
        const workbook = XLSX.utils.book_new();

        const summaryRows = [
            { Metric: 'Report Type', Value: type },
            { Metric: 'Start Date', Value: start },
            { Metric: 'End Date', Value: end },
            { Metric: 'Total Sales', Value: `${currencySymbol || ''}${summary.totalSales}` },
            { Metric: 'Total Orders', Value: summary.totalOrders },
            { Metric: 'Total Items Sold', Value: summary.totalItems },
            { Metric: 'Avg. Order Value', Value: `${currencySymbol || ''}${summary.avgOrderValue}` },
            { Metric: 'Profit/Loss', Value: `${currencySymbol || ''}${summary.profitLoss}` },
        ];
        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

        const orderRows = (orders || []).map((o) => ({
            OrderId: o.id,
            Table: o.table_name,
            Type: o.type,
            Status: o.status,
            Total: o.total,
            Timestamp: o.timestamp || o.created_at,
            PaymentMethod: o.payment_method,
            ItemCount: getOrderItemsArray(o).reduce((s, it) => s + getItemQuantity(it), 0),
            ItemsSummary: getOrderItemsArray(o)
                .map((it) => `${getItemName(it) || ''} x${getItemQuantity(it)}`)
                .filter(Boolean)
                .join(', '),
        }));
        const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
        XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders');

        const orderItemRows = (orders || []).flatMap((o) => {
            const ts = toDateTime(o.timestamp || o.created_at);
            const tsIso = ts ? ts.toISOString() : (o.timestamp || o.created_at);
            const orderItems = getOrderItemsArray(o);
            return orderItems.map((it) => {
                const qty = getItemQuantity(it);
                const price = getItemPrice(it);
                const lineTotal = typeof price === 'number' ? price * qty : undefined;
                return {
                    OrderId: o.id,
                    Timestamp: tsIso,
                    Type: o.type,
                    Status: o.status,
                    ItemName: getItemName(it),
                    Quantity: qty,
                    Price: price,
                    LineTotal: lineTotal,
                };
            });
        });
        const orderItemsSheet = XLSX.utils.json_to_sheet(orderItemRows);
        XLSX.utils.book_append_sheet(workbook, orderItemsSheet, 'OrderItems');

        const agg = new Map();
        (orders || []).forEach((o) => {
            const ts = toDateTime(o.timestamp || o.created_at);
            if (!ts) return;
            const period = getPeriodKeyForItemSales(type, ts, start, end);
            const orderItems = getOrderItemsArray(o);
            orderItems.forEach((it) => {
                const name = getItemName(it);
                const qty = getItemQuantity(it);
                const price = getItemPrice(it);
                const sale = typeof price === 'number' ? price * qty : 0;

                const key = `${period}__${name}`;
                const prev = agg.get(key) || { Period: period, ItemName: name, Quantity: 0, Sales: 0 };
                prev.Quantity += qty;
                prev.Sales += sale;
                agg.set(key, prev);
            });
        });
        const itemSalesRows = Array.from(agg.values())
            .sort((a, b) => {
                if (a.Period < b.Period) return -1;
                if (a.Period > b.Period) return 1;
                return (a.ItemName || '').localeCompare(b.ItemName || '');
            })
            .map((r) => ({
                Period: r.Period,
                ItemName: r.ItemName,
                Quantity: r.Quantity,
                Sales: Number.isFinite(r.Sales) ? r.Sales.toFixed(2) : r.Sales,
            }));
        const itemSalesSheet = XLSX.utils.json_to_sheet(itemSalesRows);
        XLSX.utils.book_append_sheet(workbook, itemSalesSheet, 'ItemSalesByPeriod');

        const topItemsSheet = XLSX.utils.json_to_sheet(summary.topSellingItems || []);
        XLSX.utils.book_append_sheet(workbook, topItemsSheet, 'TopItems');

        const ordersByTypeSheet = XLSX.utils.json_to_sheet(summary.ordersByType || []);
        XLSX.utils.book_append_sheet(workbook, ordersByTypeSheet, 'OrdersByType');

        const salesTrendSheet = XLSX.utils.json_to_sheet(summary.salesTrend || []);
        XLSX.utils.book_append_sheet(workbook, salesTrendSheet, 'SalesTrend');

        const fileName = buildExcelFileName(type, start, end);
        XLSX.writeFile(workbook, fileName);
    }, [buildExcelFileName]);

    // Date validation function
    const validateDateRange = (start, end) => {
        if (!start || !end) {
            setDateError('Please select both start and end dates');
            return false;
        }
        
        // Parse as local time (YYYY-MM-DD is treated as UTC by Date constructor)
        const startDateObj = new Date(start + 'T00:00:00');
        const endDateObj = new Date(end + 'T23:59:59');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // start of today
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999); // end of today
        
        // Check if start date is in the future
        if (startDateObj > todayStart) {
            setDateError('Start date cannot be greater than today\'s date');
            return false;
        }
        
        // Check if end date is in the future
        if (endDateObj > todayEnd) {
            setDateError('End date cannot be greater than today\'s date');
            return false;
        }
        
        // Check if end date is before start date
        if (startDateObj > endDateObj) {
            setDateError('End date cannot be earlier than start date');
            return false;
        }
        
        setDateError('');
        return true;
    };

    // Handle date changes with validation
    const handleStartDateChange = (date) => {
        setStartDate(date);
        if (endDate && validateDateRange(date, endDate)) {
            setDateError('');
        }
    };

    const handleEndDateChange = (date) => {
        setEndDate(date);
        if (startDate && validateDateRange(startDate, date)) {
            setDateError('');
        }
    };

    const fetchReportData = useCallback(async (download = false) => {
        // Validate date range before fetching
        if (!validateDateRange(startDate, endDate)) {
            return;
        }
        
        try {
            if (!isRefreshing) setIsLoading(true);
            console.log('Fetching report data for dates:', { startDate, endDate, reportType });
            const res = await fetch(`https://hotel-pos-system.onrender.com/api/orders?startDate=${startDate}&endDate=${endDate}`);
            if (!res.ok) {
                console.error('Server error:', res.status, res.statusText);
                setReportData({
                    totalSales: 0,
                    totalOrders: 0,
                    totalItems: 0,
                    topSellingItems: [],
                    ordersByType: [],
                    salesTrend: [],
                    profitLoss: 0,
                    avgOrderValue: 0
                });
                setOrdersData([]);
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            }
            const orders = await res.json();
            console.log('Orders received:', orders.length, 'orders');
            console.log('Orders details:', orders);
            setOrdersData(orders);
            setLastUpdated(new Date());
            
            if (!Array.isArray(orders)) {
                console.error('Orders response is not an array:', orders);
                setReportData({
                    totalSales: 0,
                    totalOrders: 0,
                    totalItems: 0,
                    topSellingItems: [],
                    ordersByType: [],
                    salesTrend: [],
                    profitLoss: 0,
                    avgOrderValue: 0
                });
                setOrdersData([]);
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            }

            // Check order statuses
            const statuses = orders.map(o => o.status);
            console.log('Order statuses:', statuses);
            
            // Treat delivered + completed as successful sales for reporting
            const reportableOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
            console.log('Reportable orders:', reportableOrders.length);
            console.log('Filtered orders:', reportableOrders);
            const totalOrders = reportableOrders.length;
            const totalSales = reportableOrders.reduce((sum, order) => sum + order.total, 0);
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
            console.log('Calculated totals:', { totalOrders, totalSales, avgOrderValue });

            // Calculate item sales
            const itemCounts = {};
            let totalItems = 0;
            reportableOrders.forEach(order => {
                (order.items || []).forEach(item => {
                    const quantity = item.quantity || item.qty || 1;
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + quantity;
                    totalItems += quantity;
                });
            });

            const topSellingItems = Object.entries(itemCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }));

            // Calculate orders by type
            const typeCounts = {
                'Dine-In': 0,
                'Takeaway': 0,
                'QR Code': 0
            };
            
            reportableOrders.forEach(order => {
                if (order.type === 'DINE_IN') {
                    typeCounts['Dine-In']++;
                } else if (order.type === 'TAKEAWAY') {
                    typeCounts['Takeaway']++;
                } else if (order.type === 'QR_CODE') {
                    typeCounts['QR Code']++;
                }
            });

            const ordersByType = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

            // Calculate sales trend based on report type
            const salesTrend = getSalesTrend(reportableOrders, reportType);

            // Simple profit/loss calculation
            const profitLoss = totalSales * 0.7 - (totalOrders * 10); // 70% revenue, minus costs

            setReportData({
                totalSales: totalSales.toFixed(2),
                totalOrders,
                totalItems,
                topSellingItems,
                ordersByType,
                salesTrend,
                profitLoss: profitLoss.toFixed(2),
                avgOrderValue: avgOrderValue.toFixed(2)
            });

            if (download) {
                exportReportToExcel(
                    reportType,
                    startDate,
                    endDate,
                    {
                        totalSales: totalSales.toFixed(2),
                        totalOrders,
                        totalItems,
                        topSellingItems,
                        ordersByType,
                        salesTrend,
                        profitLoss: profitLoss.toFixed(2),
                        avgOrderValue: avgOrderValue.toFixed(2),
                    },
                    reportableOrders,
                    locationSettings?.currencySymbol,
                );
            }
            setIsLoading(false);
            setIsRefreshing(false);
        } catch (err) {
            console.error('Failed to fetch report data:', err);
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [startDate, endDate, reportType, locationSettings?.currencySymbol, exportReportToExcel, isRefreshing]);

    const getSalesTrend = (orders, type) => {
        const trendData = {};
        
        // Filter only completed orders for sales trend
        const completedOrders = orders.filter(order => order.status === 'completed');
        
        if (type === 'daily') {
            // Hourly trend for daily reports - show all 24 hours
            for (let hour = 0; hour <= 23; hour++) {
                const displayHour = hour === 0 ? '12 AM' : 
                                   hour === 12 ? '12 PM' : 
                                   hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
                trendData[displayHour] = 0;
            }
            
            completedOrders.forEach(order => {
                const orderDate = new Date(order.timestamp || order.created_at);
                const hour = orderDate.getHours();
                const displayHour = hour === 0 ? '12 AM' : 
                                   hour === 12 ? '12 PM' : 
                                   hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
                
                if (trendData[displayHour] !== undefined) {
                    trendData[displayHour] += order.total || 0;
                }
            });
        } else if (type === 'weekly') {
            // Daily trend for weekly reports
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            days.forEach(day => {
                trendData[day] = 0;
            });
            
            completedOrders.forEach(order => {
                const orderDate = new Date(order.timestamp || order.created_at);
                const dayName = days[orderDate.getDay()];
                trendData[dayName] += order.total || 0;
            });
        } else if (type === 'monthly') {
            // Daily trend for monthly reports
            const daysInMonth = new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth() + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                trendData[`Day ${day}`] = 0;
            }
            
            completedOrders.forEach(order => {
                const orderDate = new Date(order.timestamp || order.created_at);
                const day = orderDate.getDate();
                trendData[`Day ${day}`] += order.total || 0;
            });
        } else if (type === 'yearly') {
            // Monthly trend for yearly reports
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach(month => {
                trendData[month] = 0;
            });
            
            completedOrders.forEach(order => {
                const orderDate = new Date(order.timestamp || order.created_at);
                const monthName = months[orderDate.getMonth()];
                trendData[monthName] += order.total || 0;
            });
        }
        
        return Object.entries(trendData).map(([period, sales]) => ({ period, sales }));
    };

    const setQuickDateRange = (range) => {
        const today = new Date();
        let start = new Date();
        
        switch(range) {
            case 'today':
                start = new Date(today);
                setReportType('daily');
                break;
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - 7);
                setReportType('weekly');
                break;
            case 'month':
                start = new Date(today);
                start.setMonth(today.getMonth() - 1);
                setReportType('monthly');
                break;
            case 'year':
                start = new Date(today);
                start.setFullYear(today.getFullYear() - 1);
                setReportType('yearly');
                break;
            default:
                return;
        }
        
        const getLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        setStartDate(getLocalDateString(start));
        setEndDate(getLocalDateString(today));
    };

    useEffect(() => {
        fetchReportData(false);
    }, [fetchReportData]);

    const getProfitLossColor = (value) => {
        const num = parseFloat(value);
        if (num > 0) return 'text-green-600';
        if (num < 0) return 'text-red-600';
        return 'text-gray-600';
    };

    const getReportTitle = () => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        
        // Format dates as DD-MM-YYYY
        const formatStartDate = start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formatEndDate = end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        if (formatStartDate === formatEndDate) {
            return `Report from ${formatStartDate}`;
        } else {
            return `Report from ${formatStartDate} to ${formatEndDate}`;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xl">
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-2">Sales Reports</h2>
                            <p className="text-blue-100 text-lg">Comprehensive business analytics & insights</p>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                            <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                                <FileText className="w-4 h-4 text-green-300" />
                                <span className="text-white text-sm font-medium">Reports</span>
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
                    </div>
                </div>
            </div>

            {/* Report Controls */}
            <div className="px-6 py-4">
                <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-6">
                    <div className="flex items-center mb-6">
                        <Filter className="w-5 h-5 text-indigo-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-800">Report Filters</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Date Range Selection */}
                        <div>
                            <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 mr-2" />
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all duration-200"
                                max={todayLocalDate}
                            />
                        </div>

                        <div>
                            <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 mr-2" />
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm transition-all duration-200"
                                max={todayLocalDate}
                            />
                        </div>

                        {/* Quick Date Range Buttons */}
                        <div>
                            <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                                <Activity className="w-4 h-4 mr-2" />
                                Quick Select
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setQuickDateRange('today')}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setQuickDateRange('week')}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                                >
                                    This Week
                                </button>
                                <button
                                    onClick={() => setQuickDateRange('month')}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => setQuickDateRange('year')}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                                >
                                    This Year
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Validation Error Message */}
                    {dateError && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                            {dateError}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={() => fetchReportData(true)}
                            disabled={isLoading}
                            className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all duration-200 flex items-center justify-center ${
                                isLoading 
                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                                    Generating Report...
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5 mr-2" />
                                    Export to Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Title */}
            <div className="px-6 py-4">
                <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-6 text-center">
                    <div className="flex items-center justify-center mb-2">
                        <FileText className="w-6 h-6 text-indigo-600 mr-2" />
                        <h3 className="text-2xl font-bold text-gray-800">{getReportTitle()}</h3>
                    </div>
                    <p className="text-gray-600">Business performance analytics for selected period</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="px-6 pb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {isLoading ? (
                        <>
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                        </>
                    ) : (
                        <>
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
                                    <p className="text-4xl font-bold text-white">{locationSettings.currencySymbol}{reportData.totalSales}</p>
                                </div>
                            </div>

                            <div className="group relative bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                            <BarChart3 className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="text-white/80 text-sm font-medium">Orders</span>
                                    </div>
                                    <p className="text-white/90 text-sm font-medium mb-1">Total Orders</p>
                                    <p className="text-4xl font-bold text-white">{reportData.totalOrders}</p>
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
                                    <p className="text-white/90 text-sm font-medium mb-1">Items Sold</p>
                                    <p className="text-4xl font-bold text-white">{reportData.totalItems}</p>
                                </div>
                            </div>

                            <div className="group relative bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                            <TrendingUp className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="text-white/80 text-sm font-medium">Average</span>
                                    </div>
                                    <p className="text-white/90 text-sm font-medium mb-1">Avg Order Value</p>
                                    <p className="text-4xl font-bold text-white">{locationSettings.currencySymbol}{reportData.avgOrderValue}</p>
                                </div>
                            </div>
                        </>
                    )}
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
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={reportData.ordersByType}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        fill="#8884d8"
                                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
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

                    {/* Sales Trend Chart */}
                    <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="p-2 bg-green-100 rounded-lg mr-3">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Sales Trend</h3>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Download className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                        {isLoading ? (
                            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                {reportType === 'daily' ? (
                                    <LineChart data={reportData.salesTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis 
                                            dataKey="period" 
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
                                ) : (
                                    <BarChart data={reportData.salesTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis 
                                            dataKey="period" 
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
                                        <Bar 
                                            dataKey="sales" 
                                            fill="#6366f1" 
                                            name="Sales"
                                            radius={[8, 8, 0, 0]}
                                        />
                                    </BarChart>
                                )}
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
                            <h3 className="text-xl font-bold text-gray-800">Top Selling Items</h3>
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Download className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
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
                    ) : reportData.topSellingItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-lg">No sales data for the selected period.</p>
                            <p className="text-gray-400 text-sm mt-2">Try adjusting the date range to see your best-selling items</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reportData.topSellingItems.map((item, index) => (
                                <div key={index} className="group bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 hover:from-purple-50 hover:to-purple-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                            {index + 1}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                                            <p className="text-xs text-gray-500">units sold</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 truncate">{item.name}</p>
                                        <p className="text-sm text-gray-600 mt-1">Best seller</p>
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
                    <p>Reports generated automatically based on completed orders</p>
                    <p className="mt-1">Last updated: {lastUpdated.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};

export default Reports;
