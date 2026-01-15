-- Migration: Add products table and billing_cycle to members

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Add product_id and billing_cycle columns to members (if they don't exist)
-- SQLite doesn't support IF NOT EXISTS for columns, so we use a workaround

-- Insert default products
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
