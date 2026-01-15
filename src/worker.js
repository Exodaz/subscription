// Cloudflare Worker for Subscription Manager

// Helper: Generate ID
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// JSON response helper
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

// CSV response helper
function csvResponse(data, filename) {
    return new Response(data, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            ...corsHeaders
        }
    });
}

// Router
async function handleRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (path.startsWith('/api/')) {
        try {
            // Products
            if (path === '/api/products' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY name').all();
                return jsonResponse(results);
            }

            if (path === '/api/products' && method === 'POST') {
                const { name, icon, color } = await request.json();
                const id = 'prod_' + Date.now();
                await env.DB.prepare('INSERT INTO products (id, name, icon, color) VALUES (?, ?, ?, ?)').bind(id, name, icon || '📦', color || '#6366f1').run();
                const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
                return jsonResponse(product, 201);
            }

            if (path.match(/^\/api\/products\/[^/]+$/) && method === 'PUT') {
                const id = path.split('/')[3];
                const { name, icon, color } = await request.json();
                await env.DB.prepare('UPDATE products SET name = ?, icon = ?, color = ? WHERE id = ?').bind(name, icon || '📦', color || '#6366f1', id).run();
                const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
                return jsonResponse(product);
            }

            if (path.match(/^\/api\/products\/[^/]+$/) && method === 'DELETE') {
                const id = path.split('/')[3];
                await env.DB.prepare('UPDATE houses SET product_id = NULL WHERE product_id = ?').bind(id).run();
                await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true });
            }

            // Houses
            if (path === '/api/houses' && method === 'GET') {
                const { results } = await env.DB.prepare(`
                    SELECT h.*, p.name as product_name, p.icon as product_icon, p.color as product_color
                    FROM houses h
                    LEFT JOIN products p ON h.product_id = p.id
                    ORDER BY h.created_at DESC
                `).all();
                return jsonResponse(results);
            }

            if (path === '/api/houses' && method === 'POST') {
                const { name, description, productId } = await request.json();
                const id = generateId();
                await env.DB.prepare('INSERT INTO houses (id, name, description, product_id) VALUES (?, ?, ?, ?)').bind(id, name, description || '', productId || null).run();
                const house = await env.DB.prepare('SELECT * FROM houses WHERE id = ?').bind(id).first();
                return jsonResponse(house, 201);
            }

            if (path.match(/^\/api\/houses\/[^/]+$/) && method === 'PUT') {
                const id = path.split('/')[3];
                const { name, description, productId } = await request.json();
                await env.DB.prepare('UPDATE houses SET name = ?, description = ?, product_id = ? WHERE id = ?').bind(name, description || '', productId || null, id).run();
                const house = await env.DB.prepare('SELECT * FROM houses WHERE id = ?').bind(id).first();
                return jsonResponse(house);
            }

            if (path.match(/^\/api\/houses\/[^/]+$/) && method === 'DELETE') {
                const id = path.split('/')[3];
                await env.DB.prepare('DELETE FROM payment_history WHERE member_id IN (SELECT id FROM members WHERE house_id = ?)').bind(id).run();
                await env.DB.prepare('DELETE FROM members WHERE house_id = ?').bind(id).run();
                await env.DB.prepare('DELETE FROM houses WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true });
            }

            // Members
            if (path === '/api/members' && method === 'GET') {
                const { results } = await env.DB.prepare(`
                    SELECT m.*, h.name as house_name, h.product_id, p.name as product_name, p.icon as product_icon, p.color as product_color
                    FROM members m 
                    LEFT JOIN houses h ON m.house_id = h.id 
                    LEFT JOIN products p ON h.product_id = p.id
                    ORDER BY m.created_at DESC
                `).all();

                for (const m of results) {
                    const { results: history } = await env.DB.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').bind(m.id).all();
                    m.paymentHistory = history;
                }
                return jsonResponse(results);
            }

            if (path === '/api/members' && method === 'POST') {
                const { houseId, name, email, phone, monthlyFee, billingCycle, paymentDate, expirationDate } = await request.json();
                const id = generateId();
                await env.DB.prepare(`
                    INSERT INTO members (id, house_id, name, email, phone, monthly_fee, billing_cycle, payment_date, expiration_date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(id, houseId, name, email || '', phone || '', monthlyFee || 0, billingCycle || 'monthly', paymentDate, expirationDate).run();
                const member = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first();
                member.paymentHistory = [];
                return jsonResponse(member, 201);
            }

            if (path.match(/^\/api\/members\/[^/]+$/) && method === 'PUT') {
                const id = path.split('/')[3];
                const { houseId, name, email, phone, monthlyFee, billingCycle, paymentDate, expirationDate } = await request.json();
                await env.DB.prepare(`
                    UPDATE members SET house_id = ?, name = ?, email = ?, phone = ?, monthly_fee = ?, billing_cycle = ?, payment_date = ?, expiration_date = ? 
                    WHERE id = ?
                `).bind(houseId, name, email || '', phone || '', monthlyFee || 0, billingCycle || 'monthly', paymentDate, expirationDate, id).run();
                const member = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first();
                const { results: history } = await env.DB.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').bind(id).all();
                member.paymentHistory = history;
                return jsonResponse(member);
            }

            if (path.match(/^\/api\/members\/[^/]+$/) && method === 'DELETE') {
                const id = path.split('/')[3];
                await env.DB.prepare('DELETE FROM payment_history WHERE member_id = ?').bind(id).run();
                await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true });
            }

            // Record payment
            if (path.match(/^\/api\/members\/[^/]+\/pay$/) && method === 'POST') {
                const id = path.split('/')[3];
                const { amount, newExpirationDate } = await request.json();
                const paymentId = generateId();
                await env.DB.prepare('INSERT INTO payment_history (id, member_id, amount) VALUES (?, ?, ?)').bind(paymentId, id, amount).run();
                await env.DB.prepare('UPDATE members SET expiration_date = ? WHERE id = ?').bind(newExpirationDate, id).run();
                const member = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first();
                const { results: history } = await env.DB.prepare('SELECT * FROM payment_history WHERE member_id = ? ORDER BY paid_at DESC').bind(id).all();
                member.paymentHistory = history;
                return jsonResponse(member);
            }

            // Export members as CSV
            if (path === '/api/members/export' && method === 'GET') {
                const { results } = await env.DB.prepare(`
                    SELECT m.name, m.email, m.phone, m.monthly_fee, m.billing_cycle, m.payment_date, m.expiration_date, h.name as house_name
                    FROM members m 
                    LEFT JOIN houses h ON m.house_id = h.id 
                    ORDER BY h.name, m.name
                `).all();

                let csv = 'ชื่อสมาชิก,อีเมล,เบอร์โทร,ยอดชำระ,รอบบิล,วันชำระ,วันหมดอายุ,บ้าน\n';
                for (const m of results) {
                    csv += `"${m.name}","${m.email || ''}","${m.phone || ''}",${m.monthly_fee || 0},"${m.billing_cycle || 'monthly'}","${m.payment_date || ''}","${m.expiration_date || ''}","${m.house_name || ''}"\n`;
                }

                return csvResponse(csv, 'members_export.csv');
            }

            // Import members from CSV
            if (path === '/api/members/import' && method === 'POST') {
                const { csvData, houseId } = await request.json();
                const lines = csvData.split('\n').filter(line => line.trim());
                let imported = 0;

                // Skip header if present
                const startIndex = lines[0].includes('ชื่อสมาชิก') || lines[0].toLowerCase().includes('name') ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const parts = lines[i].split(',').map(p => p.replace(/^"|"$/g, '').trim());
                    if (parts.length >= 1 && parts[0]) {
                        const id = generateId();
                        const name = parts[0];
                        const email = parts[1] || '';
                        const phone = parts[2] || '';
                        const monthlyFee = parseFloat(parts[3]) || 0;
                        const billingCycle = parts[4] || 'monthly';
                        const paymentDate = parts[5] || new Date().toISOString().split('T')[0];
                        const expirationDate = parts[6] || new Date().toISOString().split('T')[0];

                        await env.DB.prepare(`
                            INSERT INTO members (id, house_id, name, email, phone, monthly_fee, billing_cycle, payment_date, expiration_date) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(id, houseId, name, email, phone, monthlyFee, billingCycle, paymentDate, expirationDate).run();
                        imported++;
                    }
                }

                return jsonResponse({ success: true, imported });
            }

            // Payments
            if (path === '/api/payments' && method === 'GET') {
                const { results } = await env.DB.prepare(`
                    SELECT ph.*, m.name as member_name, h.name as house_name, p.name as product_name
                    FROM payment_history ph
                    JOIN members m ON ph.member_id = m.id
                    LEFT JOIN houses h ON m.house_id = h.id
                    LEFT JOIN products p ON h.product_id = p.id
                    ORDER BY ph.paid_at DESC
                `).all();
                return jsonResponse(results);
            }

            // Stats
            if (path === '/api/stats' && method === 'GET') {
                const totalHouses = (await env.DB.prepare('SELECT COUNT(*) as count FROM houses').first()).count;
                const totalMembers = (await env.DB.prepare('SELECT COUNT(*) as count FROM members').first()).count;
                const totalProducts = (await env.DB.prepare('SELECT COUNT(*) as count FROM products').first()).count;

                // Total paid amount (yearly) - sum of all payments
                const totalPaidYearly = (await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payment_history').first()).total;

                // Count unique months with payments for average calculation
                const monthsWithPayments = (await env.DB.prepare(`
                    SELECT COUNT(DISTINCT strftime('%Y-%m', paid_at)) as months FROM payment_history
                `).first()).months || 1;

                const avgMonthlyPaid = monthsWithPayments > 0 ? totalPaidYearly / monthsWithPayments : 0;

                // Expected monthly fee (for reference)
                const totalMonthlyFee = (await env.DB.prepare('SELECT COALESCE(SUM(monthly_fee), 0) as total FROM members').first()).total;

                const today = new Date().toISOString().split('T')[0];
                const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const expiredMembers = (await env.DB.prepare('SELECT COUNT(*) as count FROM members WHERE expiration_date < ?').bind(today).first()).count;
                const expiringMembers = (await env.DB.prepare('SELECT COUNT(*) as count FROM members WHERE expiration_date >= ? AND expiration_date <= ?').bind(today, sevenDaysLater).first()).count;

                return jsonResponse({
                    totalHouses,
                    totalMembers,
                    totalProducts,
                    totalMonthlyFee,
                    totalPaidYearly,
                    avgMonthlyPaid,
                    activeMembers: totalMembers - expiredMembers - expiringMembers,
                    expiringMembers,
                    expiredMembers
                });
            }

            // Sample data
            if (path === '/api/sample-data' && method === 'POST') {
                await env.DB.prepare('DELETE FROM payment_history').run();
                await env.DB.prepare('DELETE FROM members').run();
                await env.DB.prepare('DELETE FROM houses').run();

                // Get products
                const { results: products } = await env.DB.prepare('SELECT id FROM products').all();
                const productIds = products.map(p => p.id);

                const houseData = [
                    { name: 'บ้านที่ 1 - Netflix', productIdx: 5 },
                    { name: 'บ้านที่ 2 - Apple One', productIdx: 1 },
                    { name: 'บ้านที่ 3 - Spotify', productIdx: 9 },
                    { name: 'บ้านที่ 4 - YouTube', productIdx: 10 },
                    { name: 'บ้านที่ 5 - Disney+', productIdx: 11 }
                ];

                const houseIds = [];
                for (const h of houseData) {
                    const id = generateId();
                    houseIds.push(id);
                    const productId = productIds.length > h.productIdx ? productIds[h.productIdx] : null;
                    await env.DB.prepare('INSERT INTO houses (id, name, description, product_id) VALUES (?, ?, ?, ?)').bind(id, h.name, `รายละเอียดของ${h.name}`, productId).run();
                }

                const billingCycles = ['monthly', '6months', 'yearly'];
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
                for (let i = 0; i < memberData.length; i++) {
                    const m = memberData[i];
                    const memberId = generateId();
                    const houseId = houseIds[i % houseIds.length];
                    const billingCycle = billingCycles[i % billingCycles.length];

                    const payDate = new Date(today);
                    payDate.setDate(payDate.getDate() + (i * 3) - 10);
                    const expDate = new Date(today);
                    expDate.setDate(expDate.getDate() + (i * 5) - 15);

                    await env.DB.prepare(`
                        INSERT INTO members (id, house_id, name, email, phone, monthly_fee, billing_cycle, payment_date, expiration_date) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(memberId, houseId, m.name, `member${i + 1}@example.com`, `08${Math.floor(10000000 + Math.random() * 90000000)}`, m.fee, billingCycle, payDate.toISOString().split('T')[0], expDate.toISOString().split('T')[0]).run();

                    // Add sample payment history
                    if (i % 2 === 0) {
                        const paymentId = generateId();
                        await env.DB.prepare('INSERT INTO payment_history (id, member_id, amount) VALUES (?, ?, ?)').bind(paymentId, memberId, m.fee).run();
                    }
                }

                return jsonResponse({ success: true, message: 'Sample data created' });
            }

            return jsonResponse({ error: 'Not Found' }, 404);
        } catch (err) {
            return jsonResponse({ error: err.message }, 500);
        }
    }

    return null;
}

export default {
    async fetch(request, env, ctx) {
        const response = await handleRequest(request, env);
        if (response) return response;
        return new Response('Not Found', { status: 404 });
    }
};
