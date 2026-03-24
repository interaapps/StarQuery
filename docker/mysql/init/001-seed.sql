USE starquery;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  country_code CHAR(2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email)
);

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  order_number VARCHAR(40) NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') NOT NULL DEFAULT 'pending',
  ordered_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_customer_id (customer_id),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_items_order_product (order_id, product_id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
);

INSERT INTO customers (email, full_name, country_code, created_at) VALUES
  ('ava@example.com', 'Ava Johnson', 'US', '2026-01-04 09:15:00'),
  ('liam@example.com', 'Liam Carter', 'DE', '2026-01-08 13:42:00'),
  ('mia@example.com', 'Mia Chen', 'GB', '2026-01-12 17:05:00')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  country_code = VALUES(country_code),
  created_at = VALUES(created_at);

INSERT INTO products (sku, name, category, price, stock) VALUES
  ('LAP-14-PRO', 'StarQuery Laptop Pro 14', 'hardware', 1499.00, 12),
  ('MON-27-IPS', 'Nebula Monitor 27', 'hardware', 329.90, 24),
  ('DOCK-USB-C', 'Orbit USB-C Dock', 'accessories', 119.50, 50),
  ('MOU-WL-ERG', 'Comet Ergonomic Mouse', 'accessories', 59.99, 80)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  price = VALUES(price),
  stock = VALUES(stock);

INSERT INTO orders (customer_id, order_number, status, ordered_at) VALUES
  (1, 'SQ-1001', 'paid', '2026-02-02 10:30:00'),
  (2, 'SQ-1002', 'shipped', '2026-02-05 15:10:00'),
  (1, 'SQ-1003', 'pending', '2026-02-17 08:00:00')
ON DUPLICATE KEY UPDATE
  customer_id = VALUES(customer_id),
  status = VALUES(status),
  ordered_at = VALUES(ordered_at);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 1499.00),
  (1, 3, 1, 119.50),
  (2, 2, 2, 329.90),
  (2, 4, 1, 59.99),
  (3, 3, 3, 119.50)
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity),
  unit_price = VALUES(unit_price);
