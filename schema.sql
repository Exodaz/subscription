-- Schema for Cloudflare D1

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
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    monthly_fee REAL DEFAULT 0,
    payment_date TEXT,
    expiration_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
);

-- Payment history table
CREATE TABLE IF NOT EXISTS payment_history (
    id TEXT PRIMARY KEY,
    member_id TEXT,
    amount REAL,
    paid_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
