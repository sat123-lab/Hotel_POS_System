-- mrbeast_schema.sql

CREATE DATABASE IF NOT EXISTS mrbeast_db;
USE mrbeast_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price FLOAT NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    isAvailable BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    status ENUM('pending', 'preparing', 'ready', 'delivered', 'completed') NOT NULL DEFAULT 'pending',
    total FLOAT NOT NULL,
    timestamp DATETIME NOT NULL,
    type VARCHAR(50) NOT NULL,
    bill_requested BOOLEAN DEFAULT FALSE,
    delivered_at DATETIME NULL,
    bill_generated BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50) NULL,
    bill_status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    menuItemId INT,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price FLOAT NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    currentStock FLOAT NOT NULL,
    minStock FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    subtotal FLOAT NOT NULL,
    tax FLOAT NOT NULL,
    total FLOAT NOT NULL,
    payment_method VARCHAR(50) NULL,
    bill_status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    generated_at DATETIME NOT NULL,
    paid_at DATETIME NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
); 