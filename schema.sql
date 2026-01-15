-- Schema for Cloudflare D1

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Houses table
CREATE TABLE IF NOT EXISTS houses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    house_id TEXT,
    product_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    monthly_fee REAL DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',
    payment_date TEXT,
    expiration_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Payment history table
CREATE TABLE IF NOT EXISTS payment_history (
    id TEXT PRIMARY KEY,
    member_id TEXT,
    amount REAL,
    paid_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Default products
INSERT OR IGNORE INTO products (id, name, icon, color) VALUES 
    ('prod_apple_one', 'Apple One', '🍎', '#000000'),
    ('prod_icloud', 'iCloud+', '☁️', '#3b82f6'),
    ('prod_apple_music', 'Apple Music', '🎵', '#fc3c44'),
    ('prod_google_one', 'Google One', '🔵', '#4285f4'),
    ('prod_gemini', 'Gemini Advanced', '✨', '#8b5cf6'),
    ('prod_netflix', 'Netflix', '🎬', '#e50914'),
    ('prod_ms365', 'Microsoft 365', '📊', '#0078d4'),
    ('prod_prime', 'Prime Video', '📺', '#00a8e1'),
    ('prod_iqiyi', 'iQIYI', '🎭', '#00be06'),
    ('prod_spotify', 'Spotify', '🎧', '#1db954'),
    ('prod_youtube', 'YouTube Premium', '▶️', '#ff0000'),
    ('prod_disney', 'Disney+', '🏰', '#113ccf');
