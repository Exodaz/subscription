// =============================================
// Subscription Manager - Express Server + SQLite
// =============================================

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Database setup
const db = new Database('subscription.db');

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS houses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        house_id TEXT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        monthly_fee REAL DEFAULT 0,
        payment_date TEXT,
        expiration_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        member_id TEXT,
        amount REAL,
        paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
`);

// Helper: Generate ID
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// =============================================
// HOUSES API
// =============================================

// Get all houses
app.get('/api/houses', (req, res) => {
    try {
        const houses = db.prepare('SELECT * FROM houses ORDER BY created_at DESC').all();
        res.json(houses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get house by ID
app.get('/api/houses/:id', (req, res) => {
    try {
        const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
        if (!house) return res.status(404).json({ error: 'House not found' });
        res.json(house);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create house
app.post('/api/houses', (req, res) => {
    try {
        const { name, description } = req.body;
        const id = generateId();
        db.prepare('INSERT INTO houses (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '');
        const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(id);
        res.status(201).json(house);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update house
app.put('/api/houses/:id', (req, res) => {
    try {
        const { name, description } = req.body;
        const result = db.prepare('UPDATE houses SET name = ?, description = ? WHERE id = ?').run(name, description || '', req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'House not found' });
        const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
        res.json(house);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete house
app.delete('/api/houses/:id', (req, res) => {
    try {
        // Delete members first
        db.prepare('DELETE FROM members WHERE house_id = ?').run(req.params.id);
        const result = db.prepare('DELETE FROM houses WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'House not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// MEMBERS API
// =============================================

// Get all members
app.get('/api/members', (req, res) => {
    try {
        const members = db.prepare(`
            SELECT m.*, h.name as house_name 
            FROM members m 
            LEFT JOIN houses h ON m.house_id = h.id 
            ORDER BY m.created_at DESC
        `).all();

        // Get payment history for each member
        members.forEach(m => {
            m.paymentHistory = db.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').all(m.id);
        });

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get member by ID
app.get('/api/members/:id', (req, res) => {
    try {
        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        member.paymentHistory = db.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').all(member.id);
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create member
app.post('/api/members', (req, res) => {
    try {
        const { houseId, name, email, phone, monthlyFee, paymentDate, expirationDate } = req.body;
        const id = generateId();
        db.prepare(`
            INSERT INTO members (id, house_id, name, email, phone, monthly_fee, payment_date, expiration_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, houseId, name, email || '', phone || '', monthlyFee || 0, paymentDate, expirationDate);
        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
        member.paymentHistory = [];
        res.status(201).json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update member
app.put('/api/members/:id', (req, res) => {
    try {
        const { houseId, name, email, phone, monthlyFee, paymentDate, expirationDate } = req.body;
        const result = db.prepare(`
            UPDATE members SET house_id = ?, name = ?, email = ?, phone = ?, monthly_fee = ?, payment_date = ?, expiration_date = ? 
            WHERE id = ?
        `).run(houseId, name, email || '', phone || '', monthlyFee || 0, paymentDate, expirationDate, req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });
        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
        member.paymentHistory = db.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').all(member.id);
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete member
app.delete('/api/members/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM payment_history WHERE member_id = ?').run(req.params.id);
        const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record payment
app.post('/api/members/:id/pay', (req, res) => {
    try {
        const { amount, newExpirationDate } = req.body;
        const memberId = req.params.id;

        // Add to payment history
        const paymentId = generateId();
        db.prepare('INSERT INTO payment_history (id, member_id, amount) VALUES (?, ?, ?)').run(paymentId, memberId, amount);

        // Update expiration date
        db.prepare('UPDATE members SET expiration_date = ? WHERE id = ?').run(newExpirationDate, memberId);

        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
        member.paymentHistory = db.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').all(memberId);
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PAYMENT HISTORY API
// =============================================

app.get('/api/payments', (req, res) => {
    try {
        const payments = db.prepare(`
            SELECT ph.*, m.name as member_name, h.name as house_name
            FROM payment_history ph
            JOIN members m ON ph.member_id = m.id
            LEFT JOIN houses h ON m.house_id = h.id
            ORDER BY ph.paid_at DESC
        `).all();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// STATS API
// =============================================

app.get('/api/stats', (req, res) => {
    try {
        const totalHouses = db.prepare('SELECT COUNT(*) as count FROM houses').get().count;
        const totalMembers = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
        const totalMonthlyFee = db.prepare('SELECT COALESCE(SUM(monthly_fee), 0) as total FROM members').get().total;

        // Calculate expiring and expired
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const expiredMembers = db.prepare('SELECT COUNT(*) as count FROM members WHERE expiration_date < ?').get(today).count;
        const expiringMembers = db.prepare('SELECT COUNT(*) as count FROM members WHERE expiration_date >= ? AND expiration_date <= ?').get(today, sevenDaysLater).count;
        const activeMembers = totalMembers - expiredMembers - expiringMembers;

        res.json({
            totalHouses,
            totalMembers,
            totalMonthlyFee,
            activeMembers,
            expiringMembers,
            expiredMembers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// SAMPLE DATA
// =============================================

app.post('/api/sample-data', (req, res) => {
    try {
        // Clear existing data
        db.prepare('DELETE FROM payment_history').run();
        db.prepare('DELETE FROM members').run();
        db.prepare('DELETE FROM houses').run();

        // Sample houses
        const houseNames = ['บ้านที่ 1', 'บ้านที่ 2', 'บ้านที่ 3', 'บ้านที่ 4', 'บ้านที่ 5'];
        const houseIds = [];

        houseNames.forEach(name => {
            const id = generateId();
            houseIds.push(id);
            db.prepare('INSERT INTO houses (id, name, description) VALUES (?, ?, ?)').run(id, name, `รายละเอียดของ${name}`);
        });

        // Sample members with monthly fees
        const memberData = [
            { name: 'สมชาย ใจดี', fee: 299 },
            { name: 'สมหญิง รักเรียน', fee: 199 },
            { name: 'วิชัย ทำงานหนัก', fee: 299 },
            { name: 'นารี สวยงาม', fee: 399 },
            { name: 'ประเสริฐ แข็งแรง', fee: 199 },
            { name: 'พรทิพย์ เก่งมาก', fee: 299 },
            { name: 'อนุชา ขยัน', fee: 399 },
            { name: 'จินตนา ฉลาด', fee: 199 },
            { name: 'ธีระ มั่นคง', fee: 299 },
            { name: 'ปราณี อดทน', fee: 199 }
        ];

        const today = new Date();

        memberData.forEach((m, i) => {
            const id = generateId();
            const houseId = houseIds[i % houseIds.length];

            const payDate = new Date(today);
            payDate.setDate(payDate.getDate() + (i * 3) - 10);

            const expDate = new Date(today);
            expDate.setDate(expDate.getDate() + (i * 5) - 15);

            db.prepare(`
                INSERT INTO members (id, house_id, name, email, phone, monthly_fee, payment_date, expiration_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                houseId,
                m.name,
                `member${i + 1}@example.com`,
                `08${Math.floor(10000000 + Math.random() * 90000000)}`,
                m.fee,
                payDate.toISOString().split('T')[0],
                expDate.toISOString().split('T')[0]
            );
        });

        res.json({ success: true, message: 'Sample data created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 Database: subscription.db`);
});
