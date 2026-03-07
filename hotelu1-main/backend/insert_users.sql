-- Insert required users for POS system
-- These users will work with both plain text and hashed passwords

INSERT INTO users (username, password, role, name)
VALUES ('admin', 'admin', 'admin', 'Administrator')
ON DUPLICATE KEY UPDATE password = 'admin', role = 'admin', name = 'Administrator';

INSERT INTO users (username, password, role, name)
VALUES ('waiter', 'pass', 'waiter', 'Waiter User')
ON DUPLICATE KEY UPDATE password = 'pass', role = 'waiter', name = 'Waiter User';

INSERT INTO users (username, password, role, name)
VALUES ('chef', 'pass1', 'chef', 'Chef User')
ON DUPLICATE KEY UPDATE password = 'pass1', role = 'chef', name = 'Chef User';

INSERT INTO users (username, password, role, name)
VALUES ('manager', 'pass2', 'manager', 'Manager User')
ON DUPLICATE KEY UPDATE password = 'pass2', role = 'manager', name = 'Manager User';
