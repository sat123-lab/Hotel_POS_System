const express = require("express");
const cors = require("cors");
const { Sequelize, Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const MenuItem = require("./models/MenuItem");
const Order = require("./models/Order");
const OrderItem = require("./models/OrderItem");
const Inventory = require("./models/Inventory");
const Permission = require("./models/Permission");
const Role = require("./models/Role");
const RolePermission = require("./models/RolePermission");
const Bill = require("./models/Bill");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 3001; // Choose a port for your backend
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const isNotAvailableStatus = (status) => {
  if (typeof status !== "string") return false;
  const normalized = status.replace(/[^a-z]/gi, "").toUpperCase();
  return normalized === "NOTAVAILABLE";
};

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable parsing JSON request bodies

// Mock data for demo mode
const mockOrders = [
  {
    id: 1,
    table_name: "T1",
    status: "completed",
    total: 25.99,
    timestamp: new Date("2026-02-12T10:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 12.99 },
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
    ],
  },
  {
    id: 2,
    table_name: "Takeaway",
    status: "completed",
    total: 18.5,
    timestamp: new Date("2026-02-12T11:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 1, price: 3.0 },
    ],
  },
  {
    id: 3,
    table_name: "T2",
    status: "completed",
    total: 42.98,
    timestamp: new Date("2026-02-12T12:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 3, price: 3.0 },
    ],
  },
  {
    id: 4,
    table_name: "T3",
    status: "completed",
    total: 31.0,
    timestamp: new Date("2026-02-12T13:20:00"),
    type: "DINE_IN",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
    ],
  },
  {
    id: 5,
    table_name: "Takeaway",
    status: "completed",
    total: 15.5,
    timestamp: new Date("2026-02-12T14:10:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
    ],
  },
  {
    id: 6,
    table_name: "QR-001",
    status: "completed",
    total: 22.98,
    timestamp: new Date("2026-02-12T15:30:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 1, price: 3.0 },
    ],
  },
  {
    id: 7,
    table_name: "T4",
    status: "completed",
    total: 38.97,
    timestamp: new Date("2026-02-12T16:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 8,
    table_name: "Takeaway",
    status: "completed",
    total: 51.48,
    timestamp: new Date("2026-02-12T17:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
    ],
  },
  {
    id: 9,
    table_name: "T5",
    status: "completed",
    total: 12.99,
    timestamp: new Date("2026-02-12T18:15:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 12.99 },
    ],
  },
  {
    id: 10,
    table_name: "QR-002",
    status: "completed",
    total: 29.97,
    timestamp: new Date("2026-02-12T19:00:00"),
    type: "QR_CODE",
    items: [
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  // Add some orders from previous days for weekly/monthly reports
  {
    id: 11,
    table_name: "T1",
    status: "completed",
    total: 35.97,
    timestamp: new Date("2026-02-11T12:00:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 12,
    table_name: "Takeaway",
    status: "completed",
    total: 45.99,
    timestamp: new Date("2026-02-10T13:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 5, price: 3.0 },
    ],
  },
  {
    id: 13,
    table_name: "T2",
    status: "completed",
    total: 25.98,
    timestamp: new Date("2026-02-09T18:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 12.99 },
    ],
  },
  {
    id: 14,
    table_name: "QR-003",
    status: "completed",
    total: 18.49,
    timestamp: new Date("2026-02-08T14:20:00"),
    type: "QR_CODE",
    items: [
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 4, price: 3.0 },
    ],
  },
  // Add some orders from previous month for yearly reports
  {
    id: 15,
    table_name: "T3",
    status: "completed",
    total: 62.96,
    timestamp: new Date("2026-01-15T19:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
    ],
  },
  {
    id: 16,
    table_name: "Takeaway",
    status: "completed",
    total: 78.48,
    timestamp: new Date("2026-01-20T12:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 3, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 6, price: 3.0 },
    ],
  },
  // Add today's orders for real data visibility
  {
    id: 17,
    table_name: "T1",
    status: "completed",
    total: 45.98,
    timestamp: new Date("2026-02-13T10:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 18,
    table_name: "Takeaway",
    status: "completed",
    total: 31.49,
    timestamp: new Date("2026-02-13T12:45:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
    ],
  },
  {
    id: 19,
    table_name: "QR-004",
    status: "completed",
    total: 52.96,
    timestamp: new Date("2026-02-13T14:20:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 20,
    table_name: "T2",
    status: "completed",
    total: 28.98,
    timestamp: new Date("2026-02-13T16:10:00"),
    type: "DINE_IN",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 4, price: 3.0 },
    ],
  },
  {
    id: 21,
    table_name: "Takeaway",
    status: "completed",
    total: 39.97,
    timestamp: new Date("2026-02-13T17:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 4, price: 4.99 },
    ],
  },
  // Add historical data from previous years
  {
    id: 22,
    table_name: "T1",
    status: "completed",
    total: 85.96,
    timestamp: new Date("2025-12-25T12:00:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 5, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 3, price: 3.0 },
    ],
  },
  {
    id: 23,
    table_name: "Takeaway",
    status: "completed",
    total: 62.99,
    timestamp: new Date("2025-11-15T14:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 3, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
    ],
  },
  {
    id: 24,
    table_name: "QR-005",
    status: "completed",
    total: 125.95,
    timestamp: new Date("2025-10-20T18:45:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 4, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 6, price: 3.0 },
    ],
  },
  {
    id: 25,
    table_name: "T2",
    status: "completed",
    total: 45.98,
    timestamp: new Date("2024-08-10T16:20:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 26,
    table_name: "Takeaway",
    status: "completed",
    total: 78.47,
    timestamp: new Date("2024-06-05T13:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 4, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 27,
    table_name: "QR-006",
    status: "completed",
    total: 92.94,
    timestamp: new Date("2024-03-15T19:30:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 4, price: 4.99 },
    ],
  },
];

// ...existing code...

const mockInventory = [
  { id: 1, name: "Beef Patty", currentStock: 50, minStock: 10 },
  { id: 2, name: "Burger Buns", currentStock: 100, minStock: 20 },
  { id: 3, name: "Potatoes", currentStock: 25, minStock: 5 },
  { id: 4, name: "Pizza Dough", currentStock: 30, minStock: 8 },
];

const sequelize = require("./models/sequelize");

let dbConnected = false;

async function startServer() {
  try {
    // Railway provides these environment variables automatically
    const sequelizeConfig = {
      host: process.env.RAILWAY_PRIVATE_DOMAIN || process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      dialectOptions: {
        ssl: process.env.RAILWAY_ENVIRONMENT ? {
          require: true,
          rejectUnauthorized: false,
        } : false,
      },
    };

    // Use Railway database URL if available, otherwise use individual env vars
    if (process.env.DATABASE_URL) {
      const sequelizeUrl = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      });
      
      await sequelizeUrl.authenticate();
      console.log("MySQL connection established via DATABASE_URL.");
      await sequelizeUrl.sync();
      console.log("Database tables synchronized.");
    } else {
      // Use individual environment variables
      const sequelizeDefault = new Sequelize(
        process.env.DB_NAME || 'hotel_pos',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        sequelizeConfig
      );
      
      await sequelizeDefault.authenticate();
      console.log("MySQL connection established with environment variables.");
      await sequelizeDefault.sync();
      console.log("Database tables synchronized.");
    }
    
    app.listen(process.env.PORT || 3001, () => {
      console.log("Server running on port", process.env.PORT || 3001);
    });
    dbConnected = true;
  } catch (err) {
    console.error("Database startup error:", err);
    console.error("Server cannot start without database connection.");
    dbConnected = false;
    process.exit(1); // Exit if database connection fails
  }
}

startServer();

// Set up associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// Permission system associations
Role.hasMany(RolePermission, { foreignKey: "roleId", as: "RolePermissions" });
RolePermission.belongsTo(Role, { foreignKey: "roleId" });
RolePermission.belongsTo(Permission, {
  foreignKey: "permissionId",
  as: "Permission",
});
Permission.hasMany(RolePermission, { foreignKey: "permissionId" });

// Sync all models (completely disabled to avoid key constraints issues)
// sequelize
//   .sync({ alter: true, force: false })
//   .then(() => console.log("All models were synchronized successfully."))
//   .catch((err) => console.error("Model sync error:", err));

// Default admin credentials for demo mode
const defaultUsers = {
  admin: { password: "admin", role: "admin", name: "Admin User" },
  franchise1: { password: "pass", role: "franchise", name: "Franchise Owner" },
  subfranchise1: {
    password: "pass",
    role: "subfranchise",
    name: "Sub Franchise Owner",
  },
  manager1: { password: "pass", role: "manager", name: "Manager" },
  waiter1: { password: "pass", role: "waiter", name: "Waiter" },
  chef1: { password: "pass", role: "chef", name: "Chef" },
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Optional token verification - allows QR-based guest orders without token
const optionalToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token is invalid, but we allow the request to continue for guest orders
      console.warn("Invalid token provided, allowing as guest access");
    }
  }
  // Allow request to continue regardless of token status
  next();
};

// Login Endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", { username, password: "***" });
  
  try {
    // Only allow database authentication
    if (!dbConnected) {
      console.log("Database not connected - login unavailable");
      return res.status(500).json({ message: "Database connection unavailable" });
    }

    // Try database authentication only
    const user = await User.findOne({ where: { username } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const userData = {
        username: user.username,
        role: user.role,
        name: user.name,
      };
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
      console.log("Login successful with database user:", username);
      res.json({
        success: true,
        user: userData,
        token,
      });
    } else {
      console.log("Invalid credentials for user:", username);
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login error", error: err.message });
  }
});

// Menu Endpoints
app.get("/api/menu", async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll();
    res.json(menuItems);
  } catch (error) {
    console.error("REAL DATABASE ERROR:", error);
    res.status(500).json({ message: "Database error", error: error.message });
  }
});

app.post("/api/menu", verifyToken, async (req, res) => {
  try {
    const newItem = await MenuItem.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: "Error creating menu item", error: err.message });
  }
});

app.put("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await MenuItem.update(req.body, { where: { id } });
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      res.json({ message: "Menu item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Error updating menu item", error: err.message });
  }
});

app.delete("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const index = mockMenuItems.findIndex(
        (m) => m.id === parseInt(req.params.id),
      );
      if (index !== -1) {
        mockMenuItems.splice(index, 1);
        return res.json({ message: "Menu item deleted" });
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    const { id } = req.params;
    const deleted = await MenuItem.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Menu item deleted" });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting menu item", error: err.message });
  }
});

// Menu Item Availability Endpoint
app.put("/api/menu/:id/availability", verifyToken, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const { id } = req.params;
    
    console.log('Availability update request:', { id, isAvailable, dbConnected });
    
    if (!dbConnected) {
      console.log('Using mock data for availability update');
      const item = mockMenuItems.find((m) => m.id === parseInt(id));
      if (item) {
        item.isAvailable = isAvailable;
        console.log('Mock item updated:', item);
        return res.json({ message: "Menu item availability updated", item });
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    const [updated] = await MenuItem.update(
      { isAvailable },
      { where: { id } }
    );
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      console.log('Updated item from database:', updatedItem);
      res.json({ message: "Menu item availability updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error('Error in availability endpoint:', err);
    res
      .status(500)
      .json({ message: "Error updating menu item availability", error: err.message });
  }
});

// Orders Endpoints
app.get("/api/orders", async (req, res) => {
  try {
    const { status, type, table_name, date, startDate, endDate } = req.query;
    if (!dbConnected) {
      // Return mock data in demo mode
      let filteredOrders = [...mockOrders];

      if (status)
        filteredOrders = filteredOrders.filter((o) => o.status === status);
      if (type) filteredOrders = filteredOrders.filter((o) => o.type === type);
      if (table_name)
        filteredOrders = filteredOrders.filter(
          (o) => o.table_name === table_name,
        );
      
      // Apply date filtering for mock data
      if (date) {
        const filterDate = new Date(date);
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate.toDateString() === filterDate.toDateString();
        });
      } else if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate >= start && orderDate <= end;
        });
      }
      
      res.json(filteredOrders);
      return;
    }
    
    let whereClause = {};
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (table_name) whereClause.table_name = table_name;
    
    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      whereClause.timestamp = {
        [Op.gte]: startOfDay,
        [Op.lte]: endOfDay,
      };
    } else if (startDate && endDate) {
      whereClause.timestamp = {
        [Op.gte]: new Date(startDate + 'T00:00:00'),
        [Op.lte]: new Date(endDate + 'T23:59:59'),
      };
    }
    
    const orders = await Order.findAll({
      where: whereClause,
      include: [{ model: OrderItem, as: "items" }],
      order: [["timestamp", "DESC"]],
    });
    res.json(orders);
  } catch (err) {
    console.error("Error in /api/orders:", err);
    // Return mock data on error
    let filteredOrders = mockOrders;
    
    if (req.query.date) {
      const filterDate = new Date(req.query.date);
      filteredOrders = mockOrders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate.toDateString() === filterDate.toDateString();
      });
    } else if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate + 'T00:00:00');
      const end = new Date(req.query.endDate + 'T23:59:59');
      filteredOrders = mockOrders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    res.json(filteredOrders);
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const { table_name, items, total, type, parentOrderId } = req.body;
      const newOrder = {
        id: mockOrders.length + 1,
        table_name,
        items,
        total,
        status: "pending",
        type: type || "DINE_IN",
        parentOrderId, // Store parent order reference
        timestamp: new Date(),
      };
      mockOrders.push(newOrder);
      return res.json(newOrder);
    }

    const { table_name, items, total, type, parentOrderId } = req.body;
    const newOrder = await Order.create({
      table_name,
      total,
      status: "pending",
      type: type || "DINE_IN",
      parentOrderId, // Store parent order reference
      timestamp: new Date(),
    });
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await OrderItem.create({
          orderId: newOrder.id,
          menuItemId: item.productId || item.menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: item.price,
        });
      }
    }
    const orderWithItems = await Order.findByPk(newOrder.id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    io.emit("order_created");
    res.status(201).json(orderWithItems);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating order", error: err.message });
  }
});

app.put("/api/orders/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        const { status, items, total } = req.body;
        if (status) order.status = status;
        if (total !== undefined) order.total = total;
        if (items && Array.isArray(items)) {
          order.items = items;
        }
        
        // Only emit socket event if status is changing to a different status
        if (status) {
          io.emit('order_status_updated', { orderId: req.params.id, status: status });
        }
        
        return res.json({ message: "Order updated", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    const { id } = req.params;
    const { status, items, total } = req.body;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    
    // Update order status for all orders including Takeaway
    if (status) {
      order.status = status;
    }
    if (total !== undefined) order.total = total;
    await order.save();
    
    // Optionally update items if provided
    if (items && Array.isArray(items)) {
      await OrderItem.destroy({ where: { orderId: id } });
      for (const item of items) {
        await OrderItem.create({
          orderId: id,
          menuItemId: item.productId || item.menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: item.price,
        });
      }
    }
    
    // Emit socket event for all orders when status is changing
    if (status) {
      const previousStatus = order.status;
      if (previousStatus !== status) {
        io.emit('order_status_updated', { orderId: id, status: status });
      }
    }
    const updatedOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating order", error: err.message });
  }
});

// Mark Order as Not Available Endpoint
app.put("/api/orders/:id/not-available", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "NOT_AVAILABLE";
        io.emit("order_status_updated");
        return res.json({ message: "Order marked as not available", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    
    order.status = "NOT_AVAILABLE";
    await order.save();

    io.emit("order_status_updated");
    
    const updatedOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    
    res.json({ message: "Order marked as not available", order: updatedOrder });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error marking order as not available", error: err.message });
  }
});

// Get Live Orders Count Endpoint
app.get("/api/orders/live-count", async (req, res) => {
  try {
    if (!dbConnected) {
      // Live orders are those with status in ['PENDING', 'PREPARING', 'READY', 'DELIVERED']
      const liveOrders = mockOrders.filter(order => 
        ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'pending', 'preparing', 'ready', 'delivered'].includes(order.status)
      );
      return res.json({ count: liveOrders.length });
    }
    
    const liveOrdersCount = await Order.count({
      where: {
        status: {
          [Op.in]: [
            "PENDING",
            "PREPARING",
            "READY",
            "DELIVERED",
            "pending",
            "preparing",
            "ready",
            "delivered",
          ],
        },
      }
    });
    
    res.json({ count: liveOrdersCount });
  } catch (err) {
    console.error("Error fetching live orders count:", err);
    res.status(500).json({ message: "Error fetching live orders count", error: err.message });
  }
});

// Get Total Orders Count Endpoint (exclude NOT_AVAILABLE)
app.get("/api/orders/total-count", async (req, res) => {
  try {
    if (!dbConnected) {
      const totalOrders = mockOrders.filter(order => order.status !== 'NOT_AVAILABLE');
      return res.json({ count: totalOrders.length });
    }

    const totalOrdersCount = await Order.count({
      where: {
        status: {
          [Op.notIn]: ["NOT_AVAILABLE", "not_available"],
        },
      },
    });

    res.json({ count: totalOrdersCount });
  } catch (err) {
    console.error("Error fetching total orders count:", err);
    res.status(500).json({ message: "Error fetching total orders count", error: err.message });
  }
});

// Delete Order Endpoint - Delete order and its associated items
app.delete("/api/orders/:id", optionalToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!dbConnected) {
      const orderIndex = mockOrders.findIndex((o) => o.id === parseInt(id));
      if (orderIndex === -1) {
        return res.status(404).json({ message: "Not found" });
      }
      // Allow deletion of empty orders (total = 0) or NOT_AVAILABLE orders
      const order = mockOrders[orderIndex];
      console.log('Mock order to delete:', order);
      if (order.total > 0 && !isNotAvailableStatus(order.status)) {
        console.log('Cannot delete order - total > 0 and not NOT_AVAILABLE:', order.total, order.status);
        return res.status(400).json({
          message: "Only empty orders or NOT_AVAILABLE orders can be deleted",
        });
      }
      mockOrders.splice(orderIndex, 1);
      console.log('Order deleted from mock data');
      return res.json({ success: true });
    }

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Not found" });

    console.log('Order to delete:', order.dataValues);

    // Allow deletion of empty orders (total = 0) or NOT_AVAILABLE orders
    if (order.total > 0 && !isNotAvailableStatus(order.status)) {
      console.log('Cannot delete order - total > 0 and not NOT_AVAILABLE:', order.total, order.status);
      return res.status(400).json({
        message: "Only empty orders or NOT_AVAILABLE orders can be deleted",
      });
    }

    await OrderItem.destroy({ where: { orderId: order.id } });
    await order.destroy();

    console.log('Order deleted from database');

    // Emit socket event to update dashboard
    io.emit('order_deleted', { orderId: id });

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
});

// Request Bill Endpoint
app.put("/api/orders/:id/request-bill", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.bill_requested = true;
        return res.json({ message: "Bill requested", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.bill_requested = true;
    await order.save();
    res.json({ message: "Bill requested", order });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error requesting bill", error: err.message });
  }
});

// Reset Order Endpoint - Delete NOT_AVAILABLE orders and their items
app.put("/api/orders/:id/reset", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const orderIndex = mockOrders.findIndex((o) => o.id === parseInt(req.params.id));
      if (orderIndex !== -1) {
        const order = mockOrders[orderIndex];
        if (isNotAvailableStatus(order.status)) {
          mockOrders.splice(orderIndex, 1);
          return res.json({
            success: true,
            message: "Order deleted successfully",
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            message: "Only NOT_AVAILABLE orders can be reset" 
          });
        }
      }
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }
    
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }
    
    if (!isNotAvailableStatus(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Only NOT_AVAILABLE orders can be reset" 
      });
    }
    
    // Delete associated order items first
    await OrderItem.destroy({ where: { orderId: id } });
    
    // Delete the order
    await Order.destroy({ where: { id } });

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ 
        success: false, 
        message: "Error resetting order", 
        error: err.message 
      });
  }
});

// Confirm Delivery Endpoint - Mark order as delivered and auto-generate bill
app.put("/api/orders/:id/confirm-delivery", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "delivered";
        order.delivered_at = new Date();
        order.bill_generated = true;
        
        // Emit socket event to update dashboard
        io.emit('order_status_updated', { orderId: req.params.id, status: 'delivered' });
        
        return res.json({
          message: "Order delivered and bill generated",
          order,
        });
      }
      return res.status(404).json({ message: "Order not found" });
    }

    const { id } = req.params;
    const { tax_rate } = req.body;
    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "ready") {
      return res.status(400).json({
        message: "Order must be in 'ready' status to confirm delivery",
      });
    }

    // Update order status
    order.status = "delivered";
    order.delivered_at = new Date();
    order.bill_generated = true;
    await order.save();

    // Emit socket event to update dashboard
    io.emit('order_status_updated', { orderId: id, status: 'delivered' });

    // Auto-generate bill
    const taxRate = tax_rate || 0.05;
    const subtotal = (order.items || []).reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const bill = await Bill.create({
      orderId: order.id,
      subtotal,
      tax,
      total,
      bill_status: "pending",
      generated_at: new Date(),
    });

    res.json({
      message: "Order delivered and bill generated",
      order,
      bill,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error confirming delivery", error: err.message });
  }
});

// Get bills for an order
app.get("/api/orders/:id/bill", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ message: "No bill system in demo mode" });
    }

    const { id } = req.params;
    const bill = await Bill.findOne({ where: { orderId: id } });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found for this order" });
    }

    res.json(bill);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error retrieving bill", error: err.message });
  }
});

// Get all delivered orders (for billing page)
app.get("/api/orders/status/delivered", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json([]);
    }

    const orders = await Order.findAll({
      where: { status: "delivered" },
      include: [{ model: OrderItem, as: "items" }],
      order: [["delivered_at", "DESC"]],
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      message: "Error retrieving delivered orders",
      error: err.message,
    });
  }
});

// Complete order and mark bill as paid
app.put("/api/orders/:id/complete-payment", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "completed";
        order.payment_method = req.body.payment_method || "cash";
        order.bill_generated = true; // Mark bill as generated to remove from live orders
        
        // Emit socket event to update dashboard
        io.emit('order_status_updated', { orderId: req.params.id, status: 'completed' });
        
        return res.json({
          message: "Payment completed and order closed",
          order,
        });
      }
      return res.status(404).json({ message: "Order not found" });
    }

    const { id } = req.params;
    const { payment_method } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = "completed";
    order.payment_method = payment_method || "cash";
    order.bill_generated = true; // Mark bill as generated to remove from live orders
    await order.save();

    // Emit socket event to update dashboard
    io.emit('order_status_updated', { orderId: id, status: 'completed' });

    // Update bill status to paid
    const bill = await Bill.findOne({ where: { orderId: id } });
    if (bill) {
      bill.bill_status = "paid";
      bill.paid_at = new Date();
      bill.payment_method = payment_method || "cash";
      await bill.save();
    }

    res.json({
      message: "Payment completed and order closed",
      order,
      bill,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error completing payment", error: err.message });
  }
});

// Inventory Endpoints
app.get("/api/inventory", async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(mockInventory);
    }
    const items = await Inventory.findAll();
    res.json(items);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.json(mockInventory);
  }
});

app.post("/api/inventory", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const newItem = { ...req.body, id: mockInventory.length + 1 };
      mockInventory.push(newItem);
      return res.status(201).json(newItem);
    }
    const newItem = await Inventory.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating inventory item", error: err.message });
  }
});

app.put("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const item = mockInventory.find((i) => i.id === parseInt(req.params.id));
      if (item) {
        Object.assign(item, req.body);
        return res.json({ message: "Inventory item updated", item });
      }
      return res.status(404).json({ message: "Inventory item not found" });
    }
    const { id } = req.params;
    const [updated] = await Inventory.update(req.body, { where: { id } });
    if (updated) {
      const updatedItem = await Inventory.findByPk(id);
      res.json({ message: "Inventory item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Inventory item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating inventory item", error: err.message });
  }
});

// User Registration Endpoint
app.post("/register", async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    if (!dbConnected) {
      return res
        .status(201)
        .json({ message: "User registered", user: { username, role, name } });
    }
    const existing = await User.findOne({ where: { username } });
    if (existing)
      return res.status(409).json({ message: "Username already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
    });
    res.status(201).json({
      message: "User registered",
      user: { username: user.username, role: user.role, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration error", error: err.message });
  }
});

// Admin-only endpoint to create new users
app.post("/api/users", verifyToken, async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create users" });
    }

    // Validate inputs
    if (!username || !password || !role || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate role
    const validRoles = [
      "admin",
      "franchise",
      "subfranchise",
      "manager",
      "waiter",
      "chef",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!dbConnected) {
      // Demo mode - just return success
      return res.status(201).json({
        message: "User created successfully",
        user: { username, role, name },
      });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
    });

    res.status(201).json({
      message: "User created successfully",
      user: { username: user.username, role: user.role, name: user.name },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating user", error: err.message });
  }
});

// Get all users (admin only)
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view users" });
    }

    if (!dbConnected) {
      // Return default users in demo mode
      return res.json(
        Object.keys(defaultUsers).map((username) => ({
          username,
          role: defaultUsers[username].role,
          name: defaultUsers[username].name,
        })),
      );
    }

    const users = await User.findAll({
      attributes: ["id", "username", "role", "name"],
    });
    res.json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: err.message });
  }
});

// Update user (admin only)
app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update users" });
    }

    const { id } = req.params;
    const { username, role, name, password } = req.body;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role
    const validRoles = [
      "admin",
      "franchise",
      "subfranchise",
      "manager",
      "waiter",
      "chef",
    ];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      user.username = username;
    }

    if (role) user.role = role;
    if (name) user.name = name;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      message: "User updated successfully",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating user", error: err.message });
  }
});

// Delete user (admin only)
app.delete("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete users" });
    }

    const { id } = req.params;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    // Prevent deleting yourself
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.username === req.user.username) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    await user.destroy();

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting user", error: err.message });
  }
});

// ===== PERMISSION MANAGEMENT ENDPOINTS =====

// Get all permissions
app.get("/api/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can view permissions" });
    }

    if (!dbConnected) {
      return res.json([
        { id: 1, name: "view_dashboard", category: "reporting" },
        { id: 2, name: "manage_users", category: "user_management" },
        { id: 3, name: "manage_menu", category: "menu_management" },
        { id: 4, name: "manage_orders", category: "order_management" },
        { id: 5, name: "manage_inventory", category: "inventory_management" },
        { id: 6, name: "view_billing", category: "billing" },
        { id: 7, name: "view_users", category: "user_management" },
        { id: 8, name: "create_user", category: "user_management" },
        { id: 9, name: "edit_user", category: "user_management" },
        { id: 10, name: "delete_user", category: "user_management" },
        { id: 11, name: "manage_roles", category: "user_management" },
        { id: 12, name: "view_menu", category: "menu_management" },
        { id: 13, name: "create_menu_item", category: "menu_management" },
        { id: 14, name: "edit_menu_item", category: "menu_management" },
        { id: 15, name: "delete_menu_item", category: "menu_management" },
        { id: 16, name: "view_orders", category: "order_management" },
        { id: 17, name: "create_order", category: "order_management" },
        { id: 18, name: "edit_order", category: "order_management" },
        { id: 19, name: "delete_order", category: "order_management" },
        { id: 20, name: "manage_qr_codes", category: "order_management" },
        { id: 21, name: "mark_order_preparing", category: "order_management" },
        { id: 22, name: "mark_order_ready", category: "order_management" },
        {
          id: 23,
          name: "confirm_order_delivery",
          category: "order_management",
        },
        { id: 24, name: "view_inventory", category: "inventory_management" },
        { id: 25, name: "edit_inventory", category: "inventory_management" },
        { id: 26, name: "view_billing", category: "billing" },
        { id: 27, name: "process_payments", category: "billing" },
        { id: 28, name: "view_bills", category: "billing" },
        { id: 29, name: "view_dashboard", category: "reporting" },
        { id: 30, name: "view_reports", category: "reporting" },
        { id: 31, name: "kitchen_display", category: "reporting" },
        { id: 32, name: "manage_settings", category: "settings" },
        { id: 33, name: "manage_subfranchise", category: "settings" },
      ]);
    }

    const permissions = await Permission.findAll();
    res.json(permissions);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching permissions", error: err.message });
  }
});

// Get all roles with their permissions
app.get("/api/roles", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view roles" });
    }

    if (!dbConnected) {
      return res.json([
        {
          id: 1,
          name: "admin",
          description: "Full access",
          permissions: ["*"],
        },
        {
          id: 2,
          name: "franchise",
          description: "Franchise owner access",
          permissions: [],
        },
        {
          id: 3,
          name: "waiter",
          description: "Waiter access",
          permissions: [],
        },
        { id: 4, name: "chef", description: "Chef access", permissions: [] },
      ]);
    }

    const roles = await Role.findAll({
      include: [
        {
          model: RolePermission,
          as: "RolePermissions",
          include: [
            {
              model: Permission,
              as: "Permission",
            },
          ],
        },
      ],
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.RolePermissions.map((rp) => rp.Permission.name),
    }));

    res.json(formattedRoles);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching roles", error: err.message });
  }
});

// Create role (admin only)
app.post("/api/roles", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create roles" });
    }

    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    if (!dbConnected) {
      return res.status(201).json({
        message: "Role created successfully",
        role: { id: 1, name, description, permissions },
      });
    }

    const existing = await Role.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: "Role already exists" });
    }

    const role = await Role.create({ name, description });

    if (permissions && Array.isArray(permissions)) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({
          where: { name: permName },
        });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.status(201).json({
      message: "Role created successfully",
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating role", error: err.message });
  }
});

// Update role permissions (admin only)
app.put("/api/roles/:id/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update roles" });
    }

    const { id } = req.params;
    const { permissions } = req.body;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Remove existing permissions
    await RolePermission.destroy({ where: { roleId: id } });

    // Add new permissions
    if (permissions && Array.isArray(permissions)) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({
          where: { name: permName },
        });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.json({
      message: "Role permissions updated successfully",
      role: { id: role.id, name: role.name, permissions },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating role", error: err.message });
  }
});

// Create a new permission (admin only)
app.post("/api/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can create permissions" });
    }

    const { name, description, category } = req.body;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    const existing = await Permission.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: "Permission already exists" });
    }

    const permission = await Permission.create({
      name,
      description: description || "",
      category: category || "general",
    });

    res.status(201).json({
      message: "Permission created successfully",
      permission,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating permission", error: err.message });
  }
});

// Get user's permissions
app.get("/api/my-permissions", verifyToken, async (req, res) => {
  try {
    const username = req.user.username;

    if (req.user.role === "admin") {
      return res.json({ permissions: ["*"], role: "admin" });
    }

    if (!dbConnected) {
      return res.json({ permissions: [], role: req.user.role });
    }

    const role = await Role.findOne({ where: { name: req.user.role } });
    if (!role) {
      console.log(`❌ Role not found: ${req.user.role}`);
      return res.json({ permissions: [], role: req.user.role });
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`);

    const rolePermissions = await RolePermission.findAll({
      where: { roleId: role.id },
      include: [{ model: Permission, as: "Permission" }],
    });

    console.log(`✅ Found ${rolePermissions.length} role-permission mappings`);

    const permissions = rolePermissions.map((rp) => {
      console.log(`  - Permission: ${rp.Permission.name}`);
      return rp.Permission.name;
    });

    console.log(
      `✅ Returning ${permissions.length} permissions for role ${req.user.role}`,
    );
    res.json({ permissions, role: req.user.role });
  } catch (err) {
    console.error(`❌ Error fetching permissions:`, err);
    res
      .status(500)
      .json({ message: "Error fetching permissions", error: err.message });
  }
});

server.listen(port, () => {
  console.log(`Mock backend running at http://localhost:${port}`);
});

  // Login API
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }
    try {
      // Query users table
      const user = await User.findOne({ where: { username, password } });
      if (user) {
        return res.json({ success: true, user });
      } else {
        return res.status(401).json({ success: false, message: "Invalid username or password" });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
  });
