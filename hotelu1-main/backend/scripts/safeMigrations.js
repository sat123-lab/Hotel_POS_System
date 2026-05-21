const { DataTypes } = require("sequelize");

/**
 * Add missing columns/tables without sequelize.sync({ alter: true }).
 * alter:true on users caused "Too many keys" and broke orders queries.
 */
async function runSafeMigrations(sequelize, models = {}) {
  const { SubFranchise } = models;
  const qi = sequelize.getQueryInterface();

  try {
    const tables = await qi.showAllTables();
    const tableNames = tables.map((t) =>
      typeof t === "string" ? t : t.tableName || t
    );

    if (tableNames.includes("orders")) {
      const ordersDesc = await qi.describeTable("orders");
      if (!ordersDesc.subfranchise_id) {
        await qi.addColumn("orders", "subfranchise_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added orders.subfranchise_id");
      }
    }

    if (tableNames.includes("users")) {
      const usersDesc = await qi.describeTable("users");
      if (!usersDesc.subfranchise_id) {
        await qi.addColumn("users", "subfranchise_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added users.subfranchise_id");
      }
    }

    if (tableNames.includes("sub_franchises")) {
      const sfDesc = await qi.describeTable("sub_franchises");
      if (!sfDesc.owner_user_id) {
        await qi.addColumn("sub_franchises", "owner_user_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added sub_franchises.owner_user_id");
      }
    }

    if (!tableNames.includes("user_permissions")) {
      await qi.createTable("user_permissions", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        permission_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });
      console.log("Migration: created user_permissions table");
    }

    if (SubFranchise) {
      await SubFranchise.sync();
      console.log("Migration: sub_franchises table ready");
    }
  } catch (err) {
    console.warn("Safe migration warning:", err.message);
  }
}

module.exports = { runSafeMigrations };
