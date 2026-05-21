// Load environment variables from .env file
require('dotenv').config();

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
const UserPermission = require("./models/UserPermission");
const Bill = require("./models/Bill");
const Settings = require("./models/Settings");
const SubFranchise = require("./models/SubFranchise");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    credentials: true,
  },
});

const isNotAvailableStatus = (status) => {
  if (typeof status !== "string") return false;
  const normalized = status.replace(/[^a-z]/gi, "").toUpperCase();
  return normalized === "NOTAVAILABLE";
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", db: dbConnected, time: new Date().toISOString() });
});

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

let mockSubFranchises = [
  {
    id: 1,
    name: "Downtown Branch",
    code: "SF-DT",
    address: "Main Road",
    city: "Hyderabad",
    phone: "9876543210",
    email: "downtown@restaurant.com",
    manager_name: "Ravi Kumar",
    status: "active",
    notes: "",
  },
];

const mockInventory = [
  { id: 1, name: "Beef Patty", currentStock: 50, minStock: 10 },
  { id: 2, name: "Burger Buns", currentStock: 100, minStock: 20 },
  { id: 3, name: "Potatoes", currentStock: 25, minStock: 5 },
  { id: 4, name: "Pizza Dough", currentStock: 30, minStock: 8 },
];

const sequelize = require("./models/sequelize");
const { runSafeMigrations } = require("./scripts/safeMigrations");
const {
  computeLocationStats,
  computeStatsFromOrderList,
  enrichSubFranchise,
} = require("./utils/franchiseStats");

let dbConnected = false;

// Test database connection and start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log("Database connected successfully");
    
    // Create missing tables only (never alter:true — breaks users indexes)
    await sequelize.sync();
    await runSafeMigrations(sequelize, { SubFranchise });
    await UserPermission.sync();
    console.log("Database synchronized successfully");

    dbConnected = true;
    
    // Create or reset demo users to ensure default passwords work
    const demoUsersList = [
      { username: "admin", password: "admin", role: "admin", name: "Administrator" },
      { username: "manager", password: "pass2", role: "manager", name: "Manager User" },
      { username: "waiter", password: "pass", role: "waiter", name: "Waiter User" },
      { username: "chef", password: "pass1", role: "chef", name: "Chef User" },
    ];
    
    for (const demoUser of demoUsersList) {
      try {
        const existing = await User.findOne({ where: { username: demoUser.username } });
        if (existing) {
          // Reset password to default for demo users
          await existing.update({ password: demoUser.password });
          console.log(`Reset demo user password: ${demoUser.username}`);
        } else {
          await User.create({
            username: demoUser.username,
            password: demoUser.password,
            role: demoUser.role,
            name: demoUser.name,
          });
          console.log(`Created demo user: ${demoUser.username}`);
        }
      } catch (err) {
        console.error(`Error with demo user ${demoUser.username}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Database connection failed:", error.message);
    console.warn("Server starting without database connection - using fallback authentication");
    dbConnected = false;
  }
  
}

// DB init runs before the HTTP server starts (see boot() at end of file)

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
User.hasMany(UserPermission, { foreignKey: "userId", as: "UserPermissions" });
UserPermission.belongsTo(User, { foreignKey: "userId" });
UserPermission.belongsTo(Permission, { foreignKey: "permissionId", as: "Permission" });
Permission.hasMany(UserPermission, { foreignKey: "permissionId" });

async function getOwnedSubFranchiseIds(userId) {
  if (!dbConnected) {
    return mockSubFranchises
      .filter((s) => Number(s.owner_user_id) === Number(userId))
      .map((s) => Number(s.id));
  }
  const rows = await SubFranchise.findAll({
    where: { owner_user_id: userId },
    attributes: ["id"],
  });
  return rows.map((r) => Number(r.id));
}

/** All location IDs a franchise owner may access (owned + linked on user account). */
async function getFranchiseLocationIds(user) {
  if (!user || user.role !== "franchise") return [];
  const ids = new Set();
  if (user.subfranchise_id != null) {
    ids.add(Number(user.subfranchise_id));
  }
  const owned = await getOwnedSubFranchiseIds(user.id);
  owned.forEach((id) => ids.add(id));
  return [...ids];
}

async function resolveOrderSubFranchiseId(req, bodySubfranchiseId) {
  if (req.user?.role === "subfranchise" && req.user.subfranchise_id != null) {
    return Number(req.user.subfranchise_id);
  }
  if (req.user?.role === "franchise") {
    const locIds = await getFranchiseLocationIds(req.user);
    if (locIds.length === 0) return null;
    const requested =
      bodySubfranchiseId != null ? Number(bodySubfranchiseId) : null;
    if (requested != null && locIds.includes(requested)) return requested;
    if (locIds.length === 1) return locIds[0];
    return requested;
  }
  if (bodySubfranchiseId != null) return Number(bodySubfranchiseId);
  if (req.user?.subfranchise_id != null) return Number(req.user.subfranchise_id);
  return null;
}

function isMainBranchStaff(role) {
  return role && ["admin", "manager", "waiter", "chef"].includes(role);
}

/** Apply order list filters: main branch vs franchise locations stay separate. */
async function applyOrderScopeToWhere(whereClause, req, query = {}) {
  const user = req?.user;
  if (!user) {
    whereClause.subfranchise_id = { [Op.is]: null };
    return whereClause;
  }
  if (user.role === "subfranchise" && user.subfranchise_id != null) {
    whereClause.subfranchise_id = user.subfranchise_id;
    return whereClause;
  }
  if (user.role === "franchise") {
    const locIds = await getFranchiseLocationIds(user);
    whereClause.subfranchise_id =
      locIds.length > 0 ? { [Op.in]: locIds } : -1;
    return whereClause;
  }
  if (isMainBranchStaff(user.role)) {
    if (query.subfranchise_id != null && query.subfranchise_id !== "") {
      whereClause.subfranchise_id = query.subfranchise_id;
    } else if (query.scope !== "all") {
      whereClause.subfranchise_id = { [Op.is]: null };
    }
  }
  return whereClause;
}

async function assertOrderInScope(req, order, res) {
  if (!req.user) return true;
  const oid = order.subfranchise_id;
  if (req.user.role === "subfranchise") {
    if (Number(oid) !== Number(req.user.subfranchise_id)) {
      res.status(403).json({ message: "Order not in your branch scope" });
      return false;
    }
    return true;
  }
  if (req.user.role === "franchise") {
    const locIds = await getFranchiseLocationIds(req.user);
    if (!locIds.length || !locIds.includes(Number(oid))) {
      res.status(403).json({ message: "Order not in your franchise scope" });
      return false;
    }
    return true;
  }
  if (isMainBranchStaff(req.user.role)) {
    if (oid != null) {
      res.status(403).json({
        message: "This order belongs to a franchise location, not main branch",
      });
      return false;
    }
    return true;
  }
  return true;
}

async function getPermissionsForUser(user) {
  if (!user) return [];
  if (user.role === "admin") return ["*"];

  if (user.role === "franchise" || user.role === "subfranchise") {
    if (!dbConnected) {
      return mockUserPermissions[user.id] || [];
    }
    const userPerms = await UserPermission.findAll({
      where: { userId: user.id },
      include: [{ model: Permission, as: "Permission" }],
    });
    return userPerms.map((up) => up.Permission?.name).filter(Boolean);
  }

  if (!dbConnected) {
    const rolePermissions = {
      manager: [
        "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders",
        "create_order", "view_orders", "edit_order", "view_inventory",
        "manage_inventory", "edit_inventory", "view_billing", "process_payments",
        "view_bills", "kitchen_display", "view_menu", "manage_menu",
        "create_menu_item", "edit_menu_item", "delete_menu_item",
        "mark_order_preparing", "mark_order_ready", "confirm_order_delivery",
      ],
      waiter: [
        "view_dashboard", "manage_qr_codes", "create_order", "view_orders",
        "edit_order", "view_billing", "process_payments", "kitchen_display",
      ],
      chef: [
        "view_dashboard", "kitchen_display", "view_orders",
        "mark_order_preparing", "mark_order_ready",
      ],
    };
    return rolePermissions[user.role] || [];
  }

  const role = await Role.findOne({ where: { name: user.role } });
  if (!role) return [];
  const rolePermissions = await RolePermission.findAll({
    where: { roleId: role.id },
    include: [{ model: Permission, as: "Permission" }],
  });
  return rolePermissions.map((rp) => rp.Permission?.name).filter(Boolean);
}

// Default admin credentials for demo mode - matches login page
const defaultUsers = {
  admin: { password: "admin", role: "admin", name: "Administrator" },
  manager: { password: "pass2", role: "manager", name: "Manager User" },
  waiter: { password: "pass", role: "waiter", name: "Waiter User" },
  chef: { password: "pass1", role: "chef", name: "Chef User" },
};

// Mock users array for demo mode (in-memory storage)
let mockUsers = [
  { id: 1, username: "admin", password: "admin", role: "admin", name: "Administrator" },
  { id: 2, username: "manager", password: "pass2", role: "manager", name: "Manager User" },
  { id: 3, username: "waiter", password: "pass", role: "waiter", name: "Waiter User" },
  { id: 4, username: "chef", password: "pass1", role: "chef", name: "Chef User" },
];
const mockUserPermissions = {};

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
    // Fallback demo users for when database is not available
    const demoUsers = {
      admin: { password: "admin", role: "admin", name: "Administrator" },
      waiter: { password: "pass", role: "waiter", name: "Waiter User" },
      chef: { password: "pass1", role: "chef", name: "Chef User" },
      manager: { password: "pass2", role: "manager", name: "Manager User" },
    };
    
    // Try database authentication first if connected
    if (dbConnected) {
      try {
        const user = await User.findOne({ where: { username } });
        if (user) {
          // Check if password is hashed (starts with $2b$ or $2a$) or plain text
          let passwordMatch = false;
          if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))) {
            // Hashed password - use bcrypt compare
            passwordMatch = await bcrypt.compare(password, user.password);
          } else {
            // Plain text password - direct comparison
            passwordMatch = user.password === password;
          }
          
          if (passwordMatch) {
            const userData = {
              id: user.id,
              username: user.username,
              role: user.role,
              name: user.name,
              subfranchise_id: user.subfranchise_id || null,
            };
            const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
            console.log("Login successful with database user:", username);
            return res.json({
              success: true,
              user: userData,
              token,
            });
          } else {
            // Password doesn't match - return error (don't fall back to mockUsers)
            console.log("Invalid password for database user:", username);
            return res.status(401).json({ 
              success: false,
              message: "Invalid credentials" 
            });
          }
        } else {
          // User not found in database - return error (don't fall back to mockUsers)
          console.log("User not found in database:", username);
          return res.status(401).json({ 
            success: false,
            message: "Invalid credentials" 
          });
        }
      } catch (dbError) {
        console.log("Database authentication error:", dbError.message);
        return res.status(401).json({ 
          success: false,
          message: "Invalid credentials" 
        });
      }
    }
    
    // Only use mockUsers fallback when database is NOT connected
    const mockUser = mockUsers.find(u => u.username === username);
    if (mockUser && mockUser.password === password) {
      const userData = {
        username: mockUser.username,
        role: mockUser.role,
        name: mockUser.name,
      };
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
      console.log("Login successful with mock user:", username);
      return res.json({
        success: true,
        user: userData,
        token,
      });
    }
    
    console.log("Invalid credentials for user:", username);
    return res.status(401).json({ 
      success: false,
      message: "Invalid credentials" 
    });
    
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false,
      message: "Login error", 
      error: err.message 
    });
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
    const id = parseInt(req.params.id);
    console.log("Updating menu item with ID:", id, "Data:", req.body);
    const [updated] = await MenuItem.update(req.body, { where: { id } });
    console.log("Updated rows:", updated);
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      res.json({ message: "Menu item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error("Error updating menu item:", err);
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
    
    // First, delete any order items that reference this menu item
    const OrderItem = require('./models/OrderItem');
    await OrderItem.destroy({ where: { menuItemId: id } });
    
    // Then delete the menu item
    const deleted = await MenuItem.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Menu item deleted successfully" });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error("Delete menu item error:", err);
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

function tableNameVariants(tableId) {
  const t = String(tableId || "")
    .replace(/^T/i, "")
    .trim();
  return [...new Set([String(tableId), t, `T${t}`, `Table ${t}`, `table ${t}`])];
}

function orderMatchesTableId(order, tableId) {
  if (!tableId) return true;
  const names = tableNameVariants(tableId);
  return names.some(
    (n) => String(order.table_name).toLowerCase() === String(n).toLowerCase()
  );
}

function scopeOrdersForUser(orders, user, query = {}) {
  if (!user) {
    return orders.filter((o) => o.subfranchise_id == null);
  }
  if (user?.role === "subfranchise" && user.subfranchise_id != null) {
    return orders.filter(
      (o) => Number(o.subfranchise_id) === Number(user.subfranchise_id)
    );
  }
  if (user?.role === "franchise" && user.id != null) {
    const locIds = new Set();
    if (user.subfranchise_id != null) locIds.add(Number(user.subfranchise_id));
    mockSubFranchises
      .filter((s) => Number(s.owner_user_id) === Number(user.id))
      .forEach((s) => locIds.add(Number(s.id)));
    return orders.filter((o) => locIds.has(Number(o.subfranchise_id)));
  }
  if (isMainBranchStaff(user.role)) {
    if (query.subfranchise_id != null && query.subfranchise_id !== "") {
      return orders.filter(
        (o) => Number(o.subfranchise_id) === Number(query.subfranchise_id)
      );
    }
    if (query.scope === "all") return orders;
    return orders.filter((o) => o.subfranchise_id == null);
  }
  return orders;
}

// Orders Endpoints
app.get("/api/orders", optionalToken, async (req, res) => {
  try {
    const { status, type, table_name, tableId, date, startDate, endDate } = req.query;
    if (!dbConnected) {
      // Return mock data in demo mode
      let filteredOrders = scopeOrdersForUser([...mockOrders], req.user, req.query);

      if (status)
        filteredOrders = filteredOrders.filter((o) => o.status === status);
      if (type) filteredOrders = filteredOrders.filter((o) => o.type === type);
      if (table_name)
        filteredOrders = filteredOrders.filter(
          (o) => o.table_name === table_name,
        );
      if (tableId)
        filteredOrders = filteredOrders.filter((o) =>
          orderMatchesTableId(o, tableId)
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
    if (tableId) {
      whereClause.table_name = { [Op.in]: tableNameVariants(tableId) };
    }
    await applyOrderScopeToWhere(whereClause, req, req.query);

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
    res.status(500).json({
      message: "Error fetching orders",
      error: err.message,
    });
  }
});

// Generate unique takeaway token (numeric only for easy readability)
const generateTakeawayToken = () => {
  // Generate 4-digit numeric token (0001 to 9999)
  const random = Math.floor(Math.random() * 9999) + 1;
  return random.toString().padStart(4, '0');
};

async function getTaxDiscountSettings() {
  const defaults = { taxPercent: 5, discountPercent: 0 };
  if (!dbConnected) return defaults;
  try {
    const allSettings = await Settings.findAll();
    const map = {};
    allSettings.forEach((s) => {
      map[s.key] = JSON.parse(s.value);
    });
    return {
      taxPercent: Number(map.taxPercent) ?? defaults.taxPercent,
      discountPercent: Number(map.discountPercent) ?? defaults.discountPercent,
    };
  } catch (_) {
    return defaults;
  }
}

function getItemsSubtotal(items = []) {
  return items.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (item.quantity || item.qty || 1),
    0
  );
}

function calculateOrderTotals(subtotal, settings) {
  const taxPercent = Number(settings.taxPercent) || 0;
  const discountPercent = Number(settings.discountPercent) || 0;
  const safeSubtotal = Number(subtotal) || 0;
  const discountAmount = safeSubtotal * (discountPercent / 100);
  const afterDiscount = safeSubtotal - discountAmount;
  const taxAmount = afterDiscount * (taxPercent / 100);
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return {
    subtotal: Math.round(safeSubtotal * 100) / 100,
    discount: discountPercent,
    discountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxPercent,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total,
  };
}

function attachTotalsToOrder(order, items, totals) {
  const base = order.toJSON ? order.toJSON() : { ...order };
  const normalizedItems = (items || base.items || []).map((item) => ({
    ...item,
    qty: item.qty ?? item.quantity,
    quantity: item.quantity ?? item.qty,
  }));
  return { ...base, items: normalizedItems, ...totals };
}

app.post("/api/orders", optionalToken, async (req, res) => {
  try {
    const {
      table_name,
      items,
      type,
      parentOrderId,
      subfranchise_id,
    } = req.body;
    let linkedSubFranchiseId = await resolveOrderSubFranchiseId(
      req,
      subfranchise_id
    );
    if (req.user && isMainBranchStaff(req.user.role)) {
      linkedSubFranchiseId = null;
    }
    if (req.user?.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      if (locIds.length === 0) {
        return res.status(400).json({
          message:
            "No franchise location linked. Ask admin to link your account to a location.",
        });
      }
      if (linkedSubFranchiseId == null || !locIds.includes(linkedSubFranchiseId)) {
        return res.status(400).json({
          message:
            locIds.length > 1
              ? "Select a valid franchise location for this order"
              : "Could not assign order to your franchise location",
        });
      }
    }
    const settings = await getTaxDiscountSettings();
    const subtotal =
      req.body.subtotal != null
        ? Number(req.body.subtotal)
        : getItemsSubtotal(items || []);
    const totals = calculateOrderTotals(subtotal, settings);

    if (!dbConnected) {
      const newOrder = {
        id: mockOrders.length + 1,
        table_name,
        items,
        status: "pending",
        type: type || "DINE_IN",
        parentOrderId,
        subfranchise_id: linkedSubFranchiseId,
        timestamp: new Date(),
        token: type === "TAKEAWAY" ? generateTakeawayToken() : null,
        ...totals,
      };
      mockOrders.push(newOrder);
      io.emit("order_created");
      return res.json(newOrder);
    }

    const newOrder = await Order.create({
      table_name,
      total: totals.total,
      status: "pending",
      type: type || "DINE_IN",
      parentOrderId,
      subfranchise_id: linkedSubFranchiseId,
      timestamp: new Date(),
      token: type === "TAKEAWAY" ? generateTakeawayToken() : null,
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
    res
      .status(201)
      .json(attachTotalsToOrder(orderWithItems, orderWithItems.items, totals));
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
    if (!(await assertOrderInScope(req, order, res))) return;

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
    if (!(await assertOrderInScope(req, order, res))) return;

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
app.get("/api/orders/live-count", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const liveOrders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (order) =>
          ["PENDING", "PREPARING", "READY", "DELIVERED", "pending", "preparing", "ready", "delivered"].includes(
            order.status
          )
      );
      return res.json({ count: liveOrders.length });
    }

    const whereClause = {
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
    };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const liveOrdersCount = await Order.count({ where: whereClause });
    
    res.json({ count: liveOrdersCount });
  } catch (err) {
    console.error("Error fetching live orders count:", err);
    res.status(500).json({ message: "Error fetching live orders count", error: err.message });
  }
});

// Get Total Orders Count Endpoint (exclude NOT_AVAILABLE)
app.get("/api/orders/total-count", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const totalOrders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (order) => order.status !== "NOT_AVAILABLE"
      );
      return res.json({ count: totalOrders.length });
    }

    const whereClause = {
      status: { [Op.notIn]: ["NOT_AVAILABLE", "not_available"] },
    };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const totalOrdersCount = await Order.count({ where: whereClause });

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
    if (!(await assertOrderInScope(req, order, res))) return;

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
    if (!(await assertOrderInScope(req, order, res))) return;
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
    if (!(await assertOrderInScope(req, order, res))) return;

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
    if (!(await assertOrderInScope(req, order, res))) return;
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
      const orders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (o) => o.status === "delivered"
      );
      return res.json(orders);
    }

    const whereClause = { status: "delivered" };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const orders = await Order.findAll({
      where: whereClause,
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
    if (!(await assertOrderInScope(req, order, res))) return;

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
    const { material_name, current_stock, min_stock } = req.body;
    
    // Validate required fields
    if (!material_name || current_stock === undefined || min_stock === undefined) {
      return res.status(400).json({ message: "Material name, current stock, and min stock are required" });
    }

    // Check for duplicate material names
    if (dbConnected) {
      const existing = await Inventory.findOne({ where: { material_name } });
      if (existing) {
        return res.status(409).json({ message: "Material with this name already exists" });
      }
    } else {
      const existing = mockInventory.find(item => item.name === material_name);
      if (existing) {
        return res.status(409).json({ message: "Material with this name already exists" });
      }
    }

    // Auto-set status based on stock levels
    const status = current_stock > min_stock ? "In Stock" : "Out of Stock";

    if (!dbConnected) {
      const newItem = { 
        id: mockInventory.length + 1, 
        material_name, 
        current_stock: parseFloat(current_stock), 
        min_stock: parseFloat(min_stock), 
        status 
      };
      mockInventory.push(newItem);
      return res.status(201).json(newItem);
    }
    
    const newItem = await Inventory.create({
      material_name,
      current_stock: parseFloat(current_stock),
      min_stock: parseFloat(min_stock),
      status
    });
    res.status(201).json(newItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating inventory item", error: err.message });
  }
});

app.put("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_stock, min_stock, status, operation } = req.body;
    
    if (!dbConnected) {
      const item = mockInventory.find((i) => i.id === parseInt(id));
      if (item) {
        // Handle different operations
        if (operation === 'add') {
          item.current_stock = (item.current_stock || 0) + 1;
        } else if (operation === 'remove') {
          item.current_stock = Math.max(0, (item.current_stock || 0) - 1);
        } else if (current_stock !== undefined) {
          item.current_stock = Math.max(0, parseFloat(current_stock));
        }
        
        // Update min_stock if provided
        if (min_stock !== undefined) {
          item.min_stock = parseFloat(min_stock);
        }
        
        // Auto-update status if not explicitly set
        if (status !== undefined) {
          item.status = status;
        } else {
          item.status = item.current_stock > item.min_stock ? "In Stock" : "Out of Stock";
        }
        
        return res.json({ message: "Inventory item updated", item });
      }
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const inventoryItem = await Inventory.findByPk(id);
    if (!inventoryItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Handle different operations
    let updateData = {};
    if (operation === 'add') {
      updateData.current_stock = Math.max(0, (inventoryItem.current_stock || 0) + 1);
    } else if (operation === 'remove') {
      updateData.current_stock = Math.max(0, (inventoryItem.current_stock || 0) - 1);
    } else {
      if (current_stock !== undefined) {
        updateData.current_stock = Math.max(0, parseFloat(current_stock));
      }
      if (min_stock !== undefined) {
        updateData.min_stock = parseFloat(min_stock);
      }
    }

    // Auto-update status if not explicitly provided
    if (status !== undefined) {
      updateData.status = status;
    } else {
      const currentStock = updateData.current_stock !== undefined ? updateData.current_stock : inventoryItem.current_stock;
      const minStock = updateData.min_stock !== undefined ? updateData.min_stock : inventoryItem.min_stock;
      updateData.status = currentStock > minStock ? "In Stock" : "Out of Stock";
    }

    const [updated] = await Inventory.update(updateData, { where: { id } });
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

app.delete("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!dbConnected) {
      const index = mockInventory.findIndex((i) => i.id === parseInt(id));
      if (index !== -1) {
        const deletedItem = mockInventory.splice(index, 1)[0];
        return res.json({ message: "Inventory item deleted", item: deletedItem });
      }
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const deleted = await Inventory.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Inventory item deleted successfully" });
    } else {
      res.status(404).json({ message: "Inventory item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting inventory item", error: err.message });
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
      // Demo mode - create user in mockUsers array
      const { username, password, role, name } = req.body;
      
      // Check if username already exists
      const existing = mockUsers.find(u => u.username === username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const newUser = {
        id: mockUsers.length + 1,
        username,
        password: password, // Store plain text for demo
        role,
        name,
      };
      mockUsers.push(newUser);
      
      return res.status(201).json({
        message: "User created successfully",
        user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name },
      });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const { subfranchise_id: linkLocationId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
      subfranchise_id:
        linkLocationId && (role === "franchise" || role === "subfranchise")
          ? linkLocationId
          : null,
    });

    if (role === "franchise" && linkLocationId) {
      await SubFranchise.update(
        { owner_user_id: user.id },
        { where: { id: linkLocationId } }
      );
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        subfranchise_id: user.subfranchise_id,
      },
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
      // Return mock users in demo mode
      return res.json(mockUsers.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      })));
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
      // Demo mode - update user in mockUsers array
      const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
      if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = mockUsers[userIndex];
      
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
        const existing = mockUsers.find(u => u.username === username);
        if (existing) {
          return res.status(409).json({ message: "Username already exists" });
        }
        user.username = username;
      }
      
      if (role) user.role = role;
      if (name) user.name = name;
      if (password) {
        user.password = password; // Store plain text for demo
      }
      
      return res.json({
        message: "User updated successfully",
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
        },
      });
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
    const { subfranchise_id: linkLocationId } = req.body;
    if (linkLocationId !== undefined) {
      user.subfranchise_id = linkLocationId || null;
    }

    await user.save();

    if (user.role === "franchise" && linkLocationId) {
      await SubFranchise.update(
        { owner_user_id: user.id },
        { where: { id: linkLocationId } }
      );
    }

    res.json({
      message: "User updated successfully",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        subfranchise_id: user.subfranchise_id,
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
      // Demo mode - delete user from mockUsers array
      const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
      if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = mockUsers[userIndex];
      
      // Prevent deleting yourself
      if (user.username === req.user.username) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      mockUsers.splice(userIndex, 1);
      
      return res.json({ message: "User deleted successfully" });
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
    const permissions = await getPermissionsForUser(req.user);
    res.json({ permissions, role: req.user.role });
  } catch (err) {
    console.error(`❌ Error fetching permissions:`, err);
    res
      .status(500)
      .json({ message: "Error fetching permissions", error: err.message });
  }
});

// Get all users with their permissions (for Permission Management)
app.get("/api/users-with-permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view user permissions" });
    }

    if (!dbConnected) {
      // Demo mode - return mock users with role-based permissions
      const rolePermissions = {
        admin: ["*"],
        manager: [
          "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders", 
          "create_order", "view_orders", "edit_order", "view_inventory", 
          "manage_inventory", "edit_inventory", "view_billing", "process_payments", 
          "view_bills", "kitchen_display", "view_menu", "manage_menu", 
          "create_menu_item", "edit_menu_item", "delete_menu_item",
          "mark_order_preparing", "mark_order_ready", "confirm_order_delivery"
        ],
        waiter: [
          "view_dashboard", "manage_qr_codes", "create_order", "view_orders", 
          "edit_order", "view_billing", "process_payments", "kitchen_display"
        ],
        chef: [
          "view_dashboard", "kitchen_display", "view_orders", 
          "mark_order_preparing", "mark_order_ready"
        ],
        franchise: [
          "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders", 
          "create_order", "view_orders", "view_inventory", "view_billing", 
          "view_bills", "kitchen_display", "view_menu", "manage_subfranchise"
        ],
        subfranchise: [
          "view_dashboard", "manage_qr_codes", "create_order", "view_orders", 
          "view_inventory", "view_billing", "kitchen_display", "view_menu"
        ]
      };

      const usersWithPermissions = mockUsers.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions:
          user.role === "franchise" || user.role === "subfranchise"
            ? mockUserPermissions[user.id] || []
            : rolePermissions[user.role] || [],
      }));

      return res.json(usersWithPermissions.filter((u) => u.role !== "admin"));
    }

    const users = await User.findAll();

    const usersWithPermissions = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: await getPermissionsForUser(user),
      }))
    );

    res.json(usersWithPermissions.filter((u) => u.role !== "admin"));
  } catch (err) {
    console.error("Error fetching users with permissions:", err);
    res.status(500).json({ message: "Error fetching users with permissions", error: err.message });
  }
});

// Update user permissions (for Permission Management)
app.put("/api/users/:id/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update user permissions" });
    }

    const { id } = req.params;
    const { permissions } = req.body;

    const user = await User.findByPk(id);
    if (!user && dbConnected) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser =
      user ||
      mockUsers.find((u) => Number(u.id) === Number(id));

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role === "franchise" || targetUser.role === "subfranchise") {
      if (!dbConnected) {
        mockUserPermissions[targetUser.id] = permissions || [];
        return res.json({
          message: "Permissions updated successfully",
          userId: id,
          permissions: permissions || [],
        });
      }
      await UserPermission.destroy({ where: { userId: targetUser.id } });
      if (permissions && permissions.length > 0) {
        for (const permName of permissions) {
          const permission = await Permission.findOne({ where: { name: permName } });
          if (permission) {
            await UserPermission.create({
              userId: targetUser.id,
              permissionId: permission.id,
            });
          }
        }
      }
      return res.json({
        message: "Permissions updated successfully",
        userId: id,
        role: targetUser.role,
        permissions: permissions || [],
      });
    }

    if (!dbConnected) {
      return res.json({
        message: "Permissions updated (demo mode)",
        userId: id,
        permissions: permissions || [],
      });
    }

    const role = await Role.findOne({ where: { name: targetUser.role } });
    if (!role) {
      return res.status(404).json({ message: "Role not found for user" });
    }

    await RolePermission.destroy({ where: { roleId: role.id } });

    if (permissions && permissions.length > 0) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({ where: { name: permName } });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.json({
      message: "Permissions updated successfully",
      userId: id,
      role: targetUser.role,
      permissions: permissions || [],
    });
  } catch (err) {
    console.error("Error updating user permissions:", err);
    res.status(500).json({ message: "Error updating user permissions", error: err.message });
  }
});

// ============================================================================
// SETTINGS API ENDPOINTS
// ============================================================================

// Get all settings or a specific setting by key
app.get("/api/settings", async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!dbConnected) {
      // Fallback to defaults in demo mode
      const defaults = {
        taxPercent: 5,
        discountPercent: 0
      };
      if (key) {
        return res.json({ key, value: defaults[key] ?? null });
      }
      return res.json(defaults);
    }
    
    if (key) {
      const setting = await Settings.findOne({ where: { key } });
      if (setting) {
        return res.json({ key: setting.key, value: JSON.parse(setting.value) });
      }
      return res.status(404).json({ message: "Setting not found" });
    }
    
    const allSettings = await Settings.findAll();
    const settingsMap = {};
    allSettings.forEach(s => {
      settingsMap[s.key] = JSON.parse(s.value);
    });
    res.json(settingsMap);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ message: "Error fetching settings", error: err.message });
  }
});

// Update or create a setting (admin only)
app.put("/api/settings", verifyToken, async (req, res) => {
  try {
    // Check if user is admin - req.user is set by verifyToken middleware
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only admin can update settings" });
    }
    
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ message: "Key and value are required" });
    }
    
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    
    const [setting, created] = await Settings.upsert({
      key,
      value: JSON.stringify(value),
      description: description || '',
      updated_at: new Date()
    });
    
    res.json({
      message: created ? "Setting created" : "Setting updated",
      key,
      value
    });
  } catch (err) {
    console.error("Error updating setting:", err);
    res.status(500).json({ message: "Error updating setting", error: err.message });
  }
});

// Batch update settings (admin only)
app.put("/api/settings/batch", verifyToken, async (req, res) => {
  try {
    // Check if user is admin - req.user is set by verifyToken middleware
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only admin can update settings" });
    }
    
    const settings = req.body; // { taxPercent: 10, discountPercent: 5 }
    
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    
    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const [setting, created] = await Settings.upsert({
        key,
        value: JSON.stringify(value),
        description: `Setting for ${key}`,
        updated_at: new Date()
      });
      results.push({ key, value, created });
    }
    
    res.json({
      message: "Settings updated successfully",
      settings: results
    });
  } catch (err) {
    console.error("Error batch updating settings:", err);
    res.status(500).json({ message: "Error updating settings", error: err.message });
  }
});

// ============================================================================
// SUB-FRANCHISE & FRANCHISE OVERVIEW
// ============================================================================

const franchiseViewAuth = (req, res, next) => {
  if (
    !req.user ||
    !["admin", "franchise", "subfranchise"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Franchise access required" });
  }
  next();
};

const franchiseManageAuth = (req, res, next) => {
  if (!req.user || !["admin", "franchise"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Only admin or franchise owner can manage locations" });
  }
  next();
};

async function loadFranchiseData() {
  if (!dbConnected) {
    return {
      orders: mockOrders,
      menuCount: 10,
      subfranchises: mockSubFranchises,
      users: mockUsers,
    };
  }
  const [orders, menuCount, subfranchises, users] = await Promise.all([
    Order.findAll({ order: [["timestamp", "DESC"]] }),
    MenuItem.count(),
    SubFranchise.findAll({ order: [["name", "ASC"]] }),
    User.findAll({ attributes: ["id", "username", "role", "subfranchise_id"] }),
  ]);
  return { orders, menuCount, subfranchises, users };
}

function canAccessLocation(req, locationId) {
  if (req.user.role === "subfranchise") {
    return Number(req.user.subfranchise_id) === Number(locationId);
  }
  return true;
}

app.get("/api/subfranchises", verifyToken, franchiseViewAuth, async (req, res) => {
  try {
    const { orders, subfranchises, users } = await loadFranchiseData();
    let list = subfranchises;
    if (req.user.role === "subfranchise") {
      list = list.filter(
        (s) => Number(s.id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      list = list.filter((s) => locIds.includes(Number(s.id)));
    }
    const enriched = list.map((sf) => {
      const loginUser = users.find(
        (u) => Number(u.subfranchise_id) === Number(sf.id)
      );
      return enrichSubFranchise(sf, orders, loginUser);
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get(
  "/api/subfranchises/:id/detail",
  verifyToken,
  franchiseViewAuth,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admin can open location drill-down details" });
      }
      if (!canAccessLocation(req, id)) {
        return res.status(403).json({ message: "Access denied for this location" });
      }
      const { orders, subfranchises, users } = await loadFranchiseData();
      const sf = subfranchises.find((s) => Number(s.id) === id);
      if (!sf) return res.status(404).json({ message: "Location not found" });

      const loginUser = users.find((u) => Number(u.subfranchise_id) === id);
      const locOrders = orders.filter((o) => Number(o.subfranchise_id) === id);
      const stats = computeLocationStats(orders, id);

      const recentOrders = locOrders.slice(0, 25).map((o) => {
        const j = o.toJSON ? o.toJSON() : o;
        return {
          id: j.id,
          table_name: j.table_name,
          status: j.status,
          total: j.total,
          type: j.type,
          timestamp: j.timestamp,
        };
      });

      res.json({
        location: enrichSubFranchise(sf, orders, loginUser),
        stats,
        recentOrders,
        loginUsername: loginUser?.username || null,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

app.post("/api/subfranchises", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const {
      login_username,
      login_password,
      name,
      code,
      address,
      city,
      phone,
      email,
      manager_name,
      status,
      notes,
    } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }
    const sfData = {
      name,
      code,
      address,
      city,
      phone,
      email,
      manager_name,
      status: status || "active",
      notes,
    };
    if (req.user.role === "franchise") {
      sfData.owner_user_id = req.user.id;
    } else if (req.body.owner_user_id) {
      sfData.owner_user_id = req.body.owner_user_id;
    }

    if (!dbConnected) {
      const row = {
        id: mockSubFranchises.length + 1,
        ...sfData,
      };
      mockSubFranchises.push(row);
      if (login_username && login_password) {
        mockUsers.push({
          id: mockUsers.length + 1,
          username: login_username,
          password: login_password,
          role: "subfranchise",
          name: manager_name || name,
          subfranchise_id: row.id,
        });
      }
      return res.status(201).json(row);
    }

    const created = await SubFranchise.create(sfData);
    if (login_username && login_password) {
      const existing = await User.findOne({ where: { username: login_username } });
      if (existing) {
        return res.status(409).json({ message: "Login username already exists" });
      }
      await User.create({
        username: login_username,
        password: await bcrypt.hash(login_password, 10),
        role: "subfranchise",
        name: manager_name || name,
        subfranchise_id: created.id,
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/subfranchises/:id", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { login_username, login_password, ...updates } = req.body;
    if (!dbConnected) {
      const idx = mockSubFranchises.findIndex((s) => s.id === id);
      if (idx === -1) return res.status(404).json({ message: "Not found" });
      mockSubFranchises[idx] = { ...mockSubFranchises[idx], ...updates, id };
      return res.json(mockSubFranchises[idx]);
    }
    const row = await SubFranchise.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (
      req.user.role === "franchise" &&
      Number(row.owner_user_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({ message: "You can only edit your own locations" });
    }
    await row.update(updates);

    if (updates.owner_user_id && req.user.role === "admin") {
      const owner = await User.findByPk(updates.owner_user_id);
      if (owner?.role === "franchise") {
        await owner.update({ subfranchise_id: id });
      }
    }

    if (login_username) {
      let loginUser = await User.findOne({ where: { subfranchise_id: id } });
      if (!loginUser) {
        loginUser = await User.create({
          username: login_username,
          password: await bcrypt.hash(login_password || "pass", 10),
          role: "subfranchise",
          name: updates.manager_name || row.name,
          subfranchise_id: id,
        });
      } else {
        const patch = { username: login_username };
        if (login_password) patch.password = await bcrypt.hash(login_password, 10);
        await loginUser.update(patch);
      }
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/subfranchises/:id", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!dbConnected) {
      mockSubFranchises = mockSubFranchises.filter((s) => s.id !== id);
      return res.json({ message: "Deleted" });
    }
    const row = await SubFranchise.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    await User.destroy({ where: { subfranchise_id: id } });
    await row.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/franchise/overview", verifyToken, franchiseViewAuth, async (req, res) => {
  try {
    const { orders, menuCount, subfranchises, users } = await loadFranchiseData();

    let list = subfranchises;
    if (req.user.role === "subfranchise") {
      list = list.filter(
        (s) => Number(s.id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      list = list.filter((s) => locIds.includes(Number(s.id)));
    }

    const locationStats = list.map((sf) => {
      const loginUser = users.find(
        (u) => Number(u.subfranchise_id) === Number(sf.id)
      );
      return enrichSubFranchise(sf, orders, loginUser);
    });

    let scopedOrders = orders;
    if (req.user.role === "subfranchise") {
      scopedOrders = orders.filter(
        (o) => Number(o.subfranchise_id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = list.map((s) => Number(s.id));
      scopedOrders = orders.filter((o) =>
        locIds.includes(Number(o.subfranchise_id))
      );
    }

    const globalStats = computeStatsFromOrderList(scopedOrders);

    const unassignedStats =
      req.user.role === "admin"
        ? computeLocationStats(orders, null)
        : null;

    const recentOrders = scopedOrders.slice(0, 40).map((o) => {
      const j = o.toJSON ? o.toJSON() : o;
      return {
        id: j.id,
        table_name: j.table_name,
        status: j.status,
        total: j.total,
        type: j.type,
        timestamp: j.timestamp,
        subfranchise_id: j.subfranchise_id,
      };
    });

    res.json({
      scope: req.user.role,
      stats: {
        totalSales: globalStats.totalSales,
        amountGenerated: globalStats.amountGenerated,
        todaySales: globalStats.todaySales,
        activeOrders: globalStats.activeOrders,
        totalOrders: globalStats.totalOrders,
        menuItems: menuCount,
        subfranchiseCount: list.length,
        pendingAmount: globalStats.pendingAmount,
      },
      unassigned: unassignedStats,
      subfranchises: locationStats,
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================

const HOST = process.env.HOST || "0.0.0.0";

async function boot() {
  await startServer();
  server.listen(PORT, HOST, () => {
    console.log(`Backend running at http://${HOST}:${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(
      `Database: ${dbConnected ? "connected" : "disconnected (fallback mode)"}`
    );
  });
}

boot();
