-- Migration: Add Products and Billing Cycle
-- This migration adds the products table and updates members table

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default products with real app icons (using emoji representations)
INSERT INTO products (id, name, icon, color) VALUES
('prod_apple_music', 'Apple Music', '🎵', '#fa243c'),
('prod_apple_one', 'Apple One', '🍎', '#000000'),
('prod_icloud', 'iCloud+', '☁️', '#3693f3'),
('prod_disney', 'Disney+', '🏰', '#113ccf'),
('prod_gemini', 'Gemini Advanced', '✨', '#8e75f2'),
('prod_netflix', 'Netflix', '🎬', '#e50914'),
('prod_google_one', 'Google One', '🔷', '#4285f4'),
('prod_ms365', 'Microsoft 365', '📘', '#0078d4'),
('prod_prime', 'Prime Video', '📺', '#00a8e1'),
('prod_spotify', 'Spotify', '🎧', '#1db954'),
('prod_youtube', 'YouTube Premium', '▶️', '#ff0000'),
('prod_iqiyi', 'iQIYI', '🎭', '#5fd801');
