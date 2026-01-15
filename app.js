// =============================================
// Subscription Manager - Application Logic (API Version)
// =============================================

const API_BASE = '/api';

// API Service
const Api = {
    async get(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error('API Error');
        return res.json();
    },

    async post(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('API Error');
        return res.json();
    },

    async put(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('API Error');
        return res.json();
    },

    async delete(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('API Error');
        return res.json();
    }
};

// Data Cache
const Store = {
    houses: [],
    members: [],
    stats: null,

    async loadAll() {
        try {
            [this.houses, this.members, this.stats] = await Promise.all([
                Api.get('/houses'),
                Api.get('/members'),
                Api.get('/stats')
            ]);
        } catch (err) {
            console.error('Failed to load data:', err);
            UI.showToast('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
        }
    }
};

// House Service
const HouseService = {
    getAll() { return Store.houses; },
    getById(id) { return Store.houses.find(h => h.id === id); },

    async create(data) {
        const house = await Api.post('/houses', data);
        Store.houses.unshift(house);
        return house;
    },

    async update(id, data) {
        const house = await Api.put(`/houses/${id}`, data);
        const index = Store.houses.findIndex(h => h.id === id);
        if (index !== -1) Store.houses[index] = house;
        return house;
    },

    async delete(id) {
        await Api.delete(`/houses/${id}`);
        Store.houses = Store.houses.filter(h => h.id !== id);
        Store.members = Store.members.filter(m => m.house_id !== id);
    },

    getMemberStats(houseId) {
        const members = Store.members.filter(m => m.house_id === houseId);
        let active = 0, expiring = 0, expired = 0, totalFee = 0;

        members.forEach(m => {
            const status = MemberService.getStatus(m);
            totalFee += m.monthly_fee || 0;
            if (status === 'active') active++;
            else if (status === 'expiring') expiring++;
            else expired++;
        });

        return { total: members.length, active, expiring, expired, totalFee };
    }
};

// Member Service
const MemberService = {
    getAll() { return Store.members; },
    getById(id) { return Store.members.find(m => m.id === id); },

    async create(data) {
        const member = await Api.post('/members', data);
        Store.members.unshift(member);
        await this.refreshStats();
        return member;
    },

    async update(id, data) {
        const member = await Api.put(`/members/${id}`, data);
        const index = Store.members.findIndex(m => m.id === id);
        if (index !== -1) Store.members[index] = member;
        await this.refreshStats();
        return member;
    },

    async delete(id) {
        await Api.delete(`/members/${id}`);
        Store.members = Store.members.filter(m => m.id !== id);
        await this.refreshStats();
    },

    async recordPayment(memberId, amount, newExpirationDate) {
        const member = await Api.post(`/members/${memberId}/pay`, { amount, newExpirationDate });
        const index = Store.members.findIndex(m => m.id === memberId);
        if (index !== -1) Store.members[index] = member;
        await this.refreshStats();
        return member;
    },

    async refreshStats() {
        Store.stats = await Api.get('/stats');
    },

    getStatus(member) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(member.expiration_date);
        expDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'expired';
        if (diffDays <= 7) return 'expiring';
        return 'active';
    },

    getUpcomingPayments(days = 7) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Store.members
            .filter(m => {
                const payDate = new Date(m.payment_date);
                payDate.setHours(0, 0, 0, 0);
                const diff = Math.ceil((payDate - today) / (1000 * 60 * 60 * 24));
                return diff >= 0 && diff <= days;
            })
            .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
    }
};

// UI Controller
const UI = {
    currentPage: 'dashboard',
    deleteCallback: null,

    async init() {
        await Store.loadAll();
        this.bindNavigation();
        this.bindModals();
        this.bindForms();
        this.bindFilters();
        this.bindMobileMenu();
        this.renderAll();
    },

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        this.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        document.getElementById('sidebar').classList.remove('open');
        this.renderPage(page);
    },

    renderPage(page) {
        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'houses': this.renderHouses(); break;
            case 'members': this.renderMembers(); break;
            case 'payments': this.renderPayments(); break;
        }
    },

    renderAll() {
        this.renderDashboard();
        this.updateHouseFilter();
    },

    // Dashboard
    renderDashboard() {
        const stats = Store.stats || { totalHouses: 0, totalMembers: 0, totalMonthlyFee: 0, expiringMembers: 0, expiredMembers: 0 };

        document.getElementById('totalHouses').textContent = stats.totalHouses;
        document.getElementById('totalMembers').textContent = stats.totalMembers;
        document.getElementById('totalMonthlyFee').textContent = `฿${(stats.totalMonthlyFee || 0).toLocaleString()}`;
        document.getElementById('expiringMembers').textContent = stats.expiringMembers;
        document.getElementById('expiredMembers').textContent = stats.expiredMembers;

        this.renderAlerts();
        this.renderUpcomingPayments();
    },

    renderAlerts() {
        const container = document.getElementById('alertsContainer');
        const alerts = [];

        Store.members.forEach(m => {
            const status = MemberService.getStatus(m);
            const house = HouseService.getById(m.house_id);
            const houseName = house ? house.name : 'ไม่ระบุบ้าน';

            if (status === 'expiring') {
                const days = Math.ceil((new Date(m.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
                alerts.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: m.name,
                    subtitle: `${houseName} • หมดอายุใน ${days} วัน • ฿${(m.monthly_fee || 0).toLocaleString()}`,
                    badge: 'ใกล้หมดอายุ'
                });
            } else if (status === 'expired') {
                alerts.push({
                    type: 'danger',
                    icon: '🚫',
                    title: m.name,
                    subtitle: `${houseName} • หมดอายุแล้ว • ฿${(m.monthly_fee || 0).toLocaleString()}`,
                    badge: 'หมดอายุ'
                });
            }
        });

        if (alerts.length === 0) {
            container.innerHTML = `<div class="no-alerts">✅ ไม่มีการแจ้งเตือน - ทุกอย่างเรียบร้อย!</div>`;
            return;
        }

        container.innerHTML = alerts.slice(0, 10).map(a => `
            <div class="alert-item alert-${a.type}">
                <span class="alert-icon">${a.icon}</span>
                <div class="alert-content">
                    <div class="alert-title">${a.title}</div>
                    <div class="alert-subtitle">${a.subtitle}</div>
                </div>
                <span class="alert-badge badge-${a.type}">${a.badge}</span>
            </div>
        `).join('');
    },

    renderUpcomingPayments() {
        const container = document.getElementById('upcomingPayments');
        const upcoming = MemberService.getUpcomingPayments(14);

        if (upcoming.length === 0) {
            container.innerHTML = `<div class="no-alerts">📅 ไม่มีการชำระเงินในช่วง 14 วันข้างหน้า</div>`;
            return;
        }

        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

        container.innerHTML = upcoming.slice(0, 10).map(m => {
            const house = HouseService.getById(m.house_id);
            const date = new Date(m.payment_date);
            return `
                <div class="upcoming-item">
                    <div class="upcoming-date">
                        <span class="upcoming-day">${date.getDate()}</span>
                        <span class="upcoming-month">${thaiMonths[date.getMonth()]}</span>
                    </div>
                    <div class="upcoming-info">
                        <div class="upcoming-name">${m.name}</div>
                        <div class="upcoming-house">${house ? house.name : 'ไม่ระบุ'} • ฿${(m.monthly_fee || 0).toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Houses
    renderHouses(searchTerm = '') {
        const container = document.getElementById('housesGrid');
        let houses = HouseService.getAll();

        if (searchTerm) {
            houses = houses.filter(h =>
                h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (h.description && h.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        if (houses.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon">🏠</div>
                    <div class="empty-state-title">ยังไม่มีบ้าน</div>
                    <div class="empty-state-text">คลิก "เพิ่มบ้านใหม่" เพื่อเริ่มต้น</div>
                </div>
            `;
            return;
        }

        container.innerHTML = houses.map(h => {
            const stats = HouseService.getMemberStats(h.id);
            return `
                <div class="house-card">
                    <div class="house-header">
                        <h3 class="house-name">🏠 ${h.name}</h3>
                        <div class="house-actions">
                            <button class="btn-icon btn-edit" onclick="UI.editHouse('${h.id}')" title="แก้ไข">✏️</button>
                            <button class="btn-icon btn-delete" onclick="UI.confirmDelete('house', '${h.id}')" title="ลบ">🗑️</button>
                        </div>
                    </div>
                    <p class="house-description">${h.description || 'ไม่มีรายละเอียด'}</p>
                    <div class="house-fee">💰 ยอดรวม: <strong>฿${stats.totalFee.toLocaleString()}</strong>/เดือน</div>
                    <div class="house-stats">
                        <div class="house-stat clickable" onclick="UI.showMembersByStatus('${h.id}', 'all')" title="คลิกเพื่อดูรายละเอียด">
                            <span class="house-stat-value">${stats.total}</span>
                            <span class="house-stat-label">สมาชิก</span>
                        </div>
                        <div class="house-stat clickable" onclick="UI.showMembersByStatus('${h.id}', 'active')" title="คลิกเพื่อดูรายละเอียด">
                            <span class="house-stat-value text-success">${stats.active}</span>
                            <span class="house-stat-label">Active</span>
                        </div>
                        <div class="house-stat clickable" onclick="UI.showMembersByStatus('${h.id}', 'expiring')" title="คลิกเพื่อดูรายละเอียด">
                            <span class="house-stat-value text-warning">${stats.expiring}</span>
                            <span class="house-stat-label">ใกล้หมด</span>
                        </div>
                        <div class="house-stat clickable" onclick="UI.showMembersByStatus('${h.id}', 'expired')" title="คลิกเพื่อดูรายละเอียด">
                            <span class="house-stat-value text-danger">${stats.expired}</span>
                            <span class="house-stat-label">หมดอายุ</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Members
    renderMembers(filters = {}) {
        const tbody = document.getElementById('membersTableBody');
        let members = MemberService.getAll();

        if (filters.search) {
            members = members.filter(m =>
                m.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                (m.email && m.email.toLowerCase().includes(filters.search.toLowerCase())) ||
                (m.phone && m.phone.includes(filters.search))
            );
        }
        if (filters.house) {
            members = members.filter(m => m.house_id === filters.house);
        }
        if (filters.status) {
            members = members.filter(m => MemberService.getStatus(m) === filters.status);
        }

        if (members.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">👥</div>
                            <div class="empty-state-title">ไม่มีสมาชิก</div>
                            <div class="empty-state-text">คลิก "เพิ่มสมาชิกใหม่" เพื่อเริ่มต้น</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = members.map(m => {
            const house = HouseService.getById(m.house_id);
            const status = MemberService.getStatus(m);
            const statusText = status === 'active' ? '✓ Active' : status === 'expiring' ? '⚠ ใกล้หมดอายุ' : '✗ หมดอายุ';
            const initials = m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="member-info">
                            <div class="member-avatar">${initials}</div>
                            <div class="member-details">
                                <span class="member-name">${m.name}</span>
                                <span class="member-contact">${m.email || m.phone || '-'}</span>
                            </div>
                        </div>
                    </td>
                    <td>${house ? house.name : '-'}</td>
                    <td><strong>฿${(m.monthly_fee || 0).toLocaleString()}</strong></td>
                    <td>${this.formatDate(m.payment_date)}</td>
                    <td>${this.formatDate(m.expiration_date)}</td>
                    <td><span class="status-badge status-${status}">${statusText}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon btn-pay" onclick="UI.openPaymentModal('${m.id}')" title="บันทึกการชำระ">💳</button>
                            <button class="btn-icon btn-edit" onclick="UI.editMember('${m.id}')" title="แก้ไข">✏️</button>
                            <button class="btn-icon btn-delete" onclick="UI.confirmDelete('member', '${m.id}')" title="ลบ">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Payments
    renderPayments() {
        this.renderPendingPayments();
        this.renderPaymentHistory();
    },

    renderPendingPayments() {
        const container = document.getElementById('pendingPayments');
        const members = MemberService.getAll().filter(m => {
            const status = MemberService.getStatus(m);
            return status === 'expiring' || status === 'expired';
        });

        if (members.length === 0) {
            container.innerHTML = `<div class="no-alerts">✅ ทุกคนชำระเงินแล้ว!</div>`;
            return;
        }

        container.innerHTML = members.map(m => {
            const house = HouseService.getById(m.house_id);
            const status = MemberService.getStatus(m);
            return `
                <div class="payment-item">
                    <div class="payment-info">
                        <span class="payment-member">${m.name}</span>
                        <div class="payment-details">
                            <span>${house ? house.name : '-'}</span>
                            <span>หมดอายุ: ${this.formatDate(m.expiration_date)}</span>
                        </div>
                    </div>
                    <span class="payment-amount">฿${(m.monthly_fee || 0).toLocaleString()}</span>
                    <span class="status-badge status-${status}">${status === 'expired' ? 'หมดอายุ' : 'ใกล้หมด'}</span>
                    <button class="btn btn-success" onclick="UI.openPaymentModal('${m.id}')">💳 ชำระเงิน</button>
                </div>
            `;
        }).join('');
    },

    async renderPaymentHistory() {
        const container = document.getElementById('paymentHistory');

        try {
            const payments = await Api.get('/payments');

            if (payments.length === 0) {
                container.innerHTML = `<div class="no-alerts">📝 ยังไม่มีประวัติการชำระเงิน</div>`;
                return;
            }

            container.innerHTML = payments.slice(0, 50).map(p => `
                <div class="payment-item">
                    <div class="payment-info">
                        <span class="payment-member">${p.member_name}</span>
                        <div class="payment-details">
                            <span>${p.house_name || '-'}</span>
                            <span>วันที่: ${this.formatDate(p.paid_at)}</span>
                        </div>
                    </div>
                    <span class="payment-amount">฿${(p.amount || 0).toLocaleString()}</span>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = `<div class="no-alerts">❌ ไม่สามารถโหลดประวัติได้</div>`;
        }
    },

    // Modals
    bindModals() {
        // House modal
        document.getElementById('addHouseBtn').addEventListener('click', () => this.openHouseModal());
        document.getElementById('closeHouseModal').addEventListener('click', () => this.closeModal('houseModal'));
        document.getElementById('cancelHouseBtn').addEventListener('click', () => this.closeModal('houseModal'));
        document.querySelector('#houseModal .modal-backdrop').addEventListener('click', () => this.closeModal('houseModal'));

        // Member modal
        document.getElementById('addMemberBtn').addEventListener('click', () => this.openMemberModal());
        document.getElementById('closeMemberModal').addEventListener('click', () => this.closeModal('memberModal'));
        document.getElementById('cancelMemberBtn').addEventListener('click', () => this.closeModal('memberModal'));
        document.querySelector('#memberModal .modal-backdrop').addEventListener('click', () => this.closeModal('memberModal'));

        // Confirm modal
        document.getElementById('closeConfirmModal').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.executeDelete());
        document.querySelector('#confirmModal .modal-backdrop').addEventListener('click', () => this.closeModal('confirmModal'));

        // Payment modal
        document.getElementById('closePaymentModal').addEventListener('click', () => this.closeModal('paymentModal'));
        document.getElementById('cancelPaymentBtn').addEventListener('click', () => this.closeModal('paymentModal'));
        document.querySelector('#paymentModal .modal-backdrop').addEventListener('click', () => this.closeModal('paymentModal'));

        // Sample data
        document.getElementById('addSampleData').addEventListener('click', () => this.addSampleData());

        // Payment tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Member details modal
        document.getElementById('closeMemberDetailsModal').addEventListener('click', () => this.closeModal('memberDetailsModal'));
        document.getElementById('closeMemberDetailsBtn').addEventListener('click', () => this.closeModal('memberDetailsModal'));
        document.querySelector('#memberDetailsModal .modal-backdrop').addEventListener('click', () => this.closeModal('memberDetailsModal'));
    },

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    openHouseModal(house = null) {
        document.getElementById('houseModalTitle').textContent = house ? 'แก้ไขบ้าน' : 'เพิ่มบ้านใหม่';
        document.getElementById('houseId').value = house ? house.id : '';
        document.getElementById('houseName').value = house ? house.name : '';
        document.getElementById('houseDescription').value = house ? (house.description || '') : '';
        this.openModal('houseModal');
    },

    editHouse(id) {
        const house = HouseService.getById(id);
        if (house) this.openHouseModal(house);
    },

    openMemberModal(member = null) {
        this.updateHouseSelect();
        document.getElementById('memberModalTitle').textContent = member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิกใหม่';
        document.getElementById('memberId').value = member ? member.id : '';
        document.getElementById('memberHouse').value = member ? member.house_id : '';
        document.getElementById('memberName').value = member ? member.name : '';
        document.getElementById('memberEmail').value = member ? (member.email || '') : '';
        document.getElementById('memberPhone').value = member ? (member.phone || '') : '';
        document.getElementById('monthlyFee').value = member ? (member.monthly_fee || '') : '';
        document.getElementById('paymentDate').value = member ? member.payment_date : '';
        document.getElementById('expirationDate').value = member ? member.expiration_date : '';
        this.openModal('memberModal');
    },

    editMember(id) {
        const member = MemberService.getById(id);
        if (member) this.openMemberModal(member);
    },

    openPaymentModal(memberId) {
        const member = MemberService.getById(memberId);
        if (!member) return;

        document.getElementById('paymentMemberId').value = memberId;
        document.getElementById('paymentAmount').value = member.monthly_fee || '';

        const newExp = new Date();
        newExp.setDate(newExp.getDate() + 30);
        document.getElementById('newExpirationDate').value = newExp.toISOString().split('T')[0];

        this.openModal('paymentModal');
    },

    // Show members by status (for house card clicks)
    showMembersByStatus(houseId, status) {
        const house = HouseService.getById(houseId);
        if (!house) return;

        let members = Store.members.filter(m => m.house_id === houseId);

        // Filter by status if not 'all'
        if (status !== 'all') {
            members = members.filter(m => MemberService.getStatus(m) === status);
        }

        // Set title based on status
        const statusTitles = {
            'all': 'สมาชิกทั้งหมด',
            'active': 'สมาชิก Active',
            'expiring': 'สมาชิกใกล้หมดอายุ',
            'expired': 'สมาชิกหมดอายุ'
        };
        document.getElementById('memberDetailsTitle').textContent = `${house.name} - ${statusTitles[status]} (${members.length} คน)`;

        // Render member list
        const container = document.getElementById('memberDetailsList');

        if (members.length === 0) {
            container.innerHTML = `<div class="no-members-message">ไม่มีสมาชิกในหมวดนี้</div>`;
        } else {
            container.innerHTML = members.map(m => {
                const memberStatus = MemberService.getStatus(m);
                const statusText = memberStatus === 'active' ? '✓ Active' : memberStatus === 'expiring' ? '⚠ ใกล้หมด' : '✗ หมดอายุ';
                const initials = m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                return `
                    <div class="member-detail-item">
                        <div class="member-detail-avatar">${initials}</div>
                        <div class="member-detail-info">
                            <div class="member-detail-name">${m.name}</div>
                            <div class="member-detail-meta">
                                <span>📧 ${m.email || '-'}</span>
                                <span>📱 ${m.phone || '-'}</span>
                                <span>📅 หมดอายุ: ${this.formatDate(m.expiration_date)}</span>
                            </div>
                        </div>
                        <span class="member-detail-fee">฿${(m.monthly_fee || 0).toLocaleString()}</span>
                        <span class="status-badge status-${memberStatus}">${statusText}</span>
                        <div class="member-detail-actions">
                            <button class="btn-icon btn-pay" onclick="UI.closeModal('memberDetailsModal'); UI.openPaymentModal('${m.id}')" title="ชำระเงิน">💳</button>
                            <button class="btn-icon btn-edit" onclick="UI.closeModal('memberDetailsModal'); UI.editMember('${m.id}')" title="แก้ไข">✏️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        this.openModal('memberDetailsModal');
    },

    confirmDelete(type, id) {
        const item = type === 'house' ? HouseService.getById(id) : MemberService.getById(id);
        const name = item ? item.name : '';
        document.getElementById('confirmMessage').textContent = `คุณแน่ใจหรือไม่ที่จะลบ "${name}"?`;
        this.deleteCallback = async () => {
            try {
                if (type === 'house') {
                    await HouseService.delete(id);
                    this.renderHouses();
                } else {
                    await MemberService.delete(id);
                    this.renderMembers();
                }
                this.renderDashboard();
                this.showToast('ลบเรียบร้อยแล้ว', 'success');
            } catch (err) {
                this.showToast('เกิดข้อผิดพลาด', 'error');
            }
        };
        this.openModal('confirmModal');
    },

    async executeDelete() {
        if (this.deleteCallback) {
            await this.deleteCallback();
            this.deleteCallback = null;
        }
        this.closeModal('confirmModal');
    },

    // Forms
    bindForms() {
        document.getElementById('houseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('houseId').value;
            const data = {
                name: document.getElementById('houseName').value,
                description: document.getElementById('houseDescription').value
            };

            try {
                if (id) {
                    await HouseService.update(id, data);
                    this.showToast('อัปเดตบ้านเรียบร้อยแล้ว', 'success');
                } else {
                    await HouseService.create(data);
                    this.showToast('เพิ่มบ้านเรียบร้อยแล้ว', 'success');
                }

                this.closeModal('houseModal');
                this.renderHouses();
                this.renderDashboard();
                this.updateHouseFilter();
            } catch (err) {
                this.showToast('เกิดข้อผิดพลาด', 'error');
            }
        });

        document.getElementById('memberForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('memberId').value;
            const data = {
                houseId: document.getElementById('memberHouse').value,
                name: document.getElementById('memberName').value,
                email: document.getElementById('memberEmail').value,
                phone: document.getElementById('memberPhone').value,
                monthlyFee: parseFloat(document.getElementById('monthlyFee').value) || 0,
                paymentDate: document.getElementById('paymentDate').value,
                expirationDate: document.getElementById('expirationDate').value
            };

            try {
                if (id) {
                    await MemberService.update(id, data);
                    this.showToast('อัปเดตสมาชิกเรียบร้อยแล้ว', 'success');
                } else {
                    await MemberService.create(data);
                    this.showToast('เพิ่มสมาชิกเรียบร้อยแล้ว', 'success');
                }

                this.closeModal('memberModal');
                this.renderMembers();
                this.renderDashboard();
            } catch (err) {
                this.showToast('เกิดข้อผิดพลาด', 'error');
            }
        });

        document.getElementById('paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const memberId = document.getElementById('paymentMemberId').value;
            const amount = document.getElementById('paymentAmount').value;
            const newExp = document.getElementById('newExpirationDate').value;

            try {
                await MemberService.recordPayment(memberId, parseFloat(amount), newExp);
                this.showToast('บันทึกการชำระเงินเรียบร้อยแล้ว', 'success');

                this.closeModal('paymentModal');
                this.renderAll();
                if (this.currentPage === 'members') this.renderMembers();
                if (this.currentPage === 'payments') this.renderPayments();
            } catch (err) {
                this.showToast('เกิดข้อผิดพลาด', 'error');
            }
        });
    },

    // Filters
    bindFilters() {
        document.getElementById('houseSearch').addEventListener('input', (e) => {
            this.renderHouses(e.target.value);
        });

        const applyMemberFilters = () => {
            this.renderMembers({
                search: document.getElementById('memberSearch').value,
                house: document.getElementById('houseFilter').value,
                status: document.getElementById('statusFilter').value
            });
        };

        document.getElementById('memberSearch').addEventListener('input', applyMemberFilters);
        document.getElementById('houseFilter').addEventListener('change', applyMemberFilters);
        document.getElementById('statusFilter').addEventListener('change', applyMemberFilters);
    },

    updateHouseFilter() {
        const select = document.getElementById('houseFilter');
        const houses = HouseService.getAll();
        select.innerHTML = '<option value="">ทุกบ้าน</option>' +
            houses.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    },

    updateHouseSelect() {
        const select = document.getElementById('memberHouse');
        const houses = HouseService.getAll();
        select.innerHTML = '<option value="">เลือกบ้าน</option>' +
            houses.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    },

    // Mobile menu
    bindMobileMenu() {
        document.getElementById('mobileMenuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    },

    // Helpers
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.25s ease reverse';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    },

    async addSampleData() {
        try {
            await Api.post('/sample-data', {});
            await Store.loadAll();
            this.showToast('เพิ่มข้อมูลตัวอย่างเรียบร้อยแล้ว', 'success');
            this.renderAll();
            this.updateHouseFilter();
            if (this.currentPage === 'houses') this.renderHouses();
            if (this.currentPage === 'members') this.renderMembers();
        } catch (err) {
            this.showToast('เกิดข้อผิดพลาด - ตรวจสอบว่า server ทำงานอยู่', 'error');
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
