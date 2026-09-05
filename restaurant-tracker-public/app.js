/**
 * RESTAURANT TRACKER - FRONTEND APPLICATION
 * Plain JavaScript, Mobile-first POS System
 * Features:
 * - Supabase Cloud Database & Real-Time Sync (Works 24/7 even if PC is off)
 * - Shared Password Authentication (Verified securely)
 * - Strictly Revenue/Income Only (NO PROFIT, NO COST)
 * - Offline / Local fallback support
 */

(function () {
  'use strict';

  /* ============================================================
     1. CONSTANTS & SUPABASE CONFIG
     ============================================================ */
  const STORAGE_KEY_ORDERS = 'rt_orders';
  const STORAGE_KEY_SESSION = 'rt_session';

  // Supabase Cloud Project Configuration
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  const SHARED_PASSWORD_FALLBACK = 'YOUR_SHARED_PASSWORD';

  let supabaseClient = null;
  if (typeof window.supabase !== 'undefined') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase Client Initialized');
    } catch (err) {
      console.warn('Supabase initialization failed:', err);
    }
  }

  const MAIN_MENU = {
    pork: {
      id: 'pork',
      name: 'หมูกระทะ',
      price: 30,
      icon: '🥩'
    },
    chicken: {
      id: 'chicken',
      name: 'ไก่กระทะ',
      price: 30,
      icon: '🍗'
    }
  };

  const ADDONS = [
    { id: 'porkSlices', name: 'หมูชิ้น', price: 5 },
    { id: 'pork3', name: 'หมู 3 ชิ้น', price: 5 },
    { id: 'cabbage', name: 'ผักกาด', price: 5 },
    { id: 'morningGlory', name: 'ผักบุ้ง', price: 5 },
    { id: 'glassNoodles', name: 'วุ้นเส้น', price: 5 },
    { id: 'chickenTender', name: 'สันในไก่', price: 5 }
  ];

  /* ============================================================
     2. APPLICATION STATE
     ============================================================ */
  let currentUser = null; // { name: string, token: string, loginAt: string }
  let orders = []; // List of all stored orders
  let selectedDate = ''; // YYYY-MM-DD format
  let currentDraft = {
    mainKey: null, // 'pork' | 'chicken'
    addonsQty: {} // { porkSlices: 0, ... }
  };
  let isSavingOrder = false;

  /* ============================================================
     3. DOM ELEMENTS
     ============================================================ */
  const el = {
    loginScreen: document.getElementById('loginScreen'),
    appScreen: document.getElementById('appScreen'),

    loginForm: document.getElementById('loginForm'),
    staffNameInput: document.getElementById('staffNameInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginError: document.getElementById('loginError'),
    loginBtn: document.getElementById('loginBtn'),

    headerStaffName: document.getElementById('headerStaffName'),
    logoutBtn: document.getElementById('logoutBtn'),

    orderDatePicker: document.getElementById('orderDatePicker'),
    todayQuickBtn: document.getElementById('todayQuickBtn'),
    dateSummaryBadge: document.getElementById('dateSummaryBadge'),
    ordersSectionDateLabel: document.getElementById('ordersSectionDateLabel'),

    totalIncomeDisplay: document.getElementById('totalIncomeDisplay'),
    orderCountDisplay: document.getElementById('orderCountDisplay'),
    ordersCountSubtitle: document.getElementById('ordersCountSubtitle'),

    menuCardPork: document.getElementById('menuCardPork'),
    menuCardChicken: document.getElementById('menuCardChicken'),

    ordersContainer: document.getElementById('ordersContainer'),

    addonModal: document.getElementById('addonModal'),
    modalItemIcon: document.getElementById('modalItemIcon'),
    modalItemTitle: document.getElementById('modalItemTitle'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    addonListContainer: document.getElementById('addonListContainer'),
    modalTotalDisplay: document.getElementById('modalTotalDisplay'),
    modalFinishBtn: document.getElementById('modalFinishBtn')
  };

  /* ============================================================
     4. DATE & FORMATTING UTILITIES
     ============================================================ */
  
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const today = getLocalDateString();
    if (dateStr === today) {
      return 'วันนี้';
    }
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '';
    }
  }

  function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('th-TH');
  }

  /* ============================================================
     5. SUPABASE CLOUD & STORAGE LAYER
     ============================================================ */
  
  async function fetchOrdersFromCloud() {
    // 1. Try Supabase Cloud Database first
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .order('ordered_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          orders = data;
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
          return orders;
        } else if (error) {
          console.warn('Supabase fetch error, fallback to local/API:', error.message);
        }
      } catch (err) {
        console.warn('Supabase fetch exception:', err);
      }
    }

    // 2. Try Local Server API
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          orders = data.orders;
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
          return orders;
        }
      }
    } catch {
      // Offline / standalone
    }

    // 3. Fallback to localStorage
    orders = loadOrdersFromLocalStorage();
    return orders;
  }

  async function saveOrderToCloud(order) {
    let savedSuccessfully = false;

    // 1. Save to Supabase Cloud
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .insert([order])
          .select();

        if (!error) {
          savedSuccessfully = true;
          console.log('✅ Order saved to Supabase Cloud');
        } else {
          console.warn('Supabase insert warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase insert exception:', err);
      }
    }

    // 2. Save to Local Server API (if available)
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch {
      // Local server not running
    }

    // 3. Update Local Storage & Memory
    if (!orders.some(o => o.id === order.id)) {
      orders.unshift(order);
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    }

    return order;
  }

  function loadOrdersFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function loadSessionFromStorage() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY_SESSION) || localStorage.getItem(STORAGE_KEY_SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveSessionToStorage(session) {
    try {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    } catch (err) {
      console.error('Error saving session:', err);
    }
  }

  function clearSessionFromStorage() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  }

  /* ============================================================
     6. SUPABASE REALTIME CLOUD SYNC
     ============================================================ */
  function initSupabaseRealtime() {
    if (!supabaseClient) return;

    try {
      supabaseClient
        .channel('public:orders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload) => {
            const incoming = payload.new;
            if (incoming && !orders.some(o => o.id === incoming.id)) {
              orders.unshift(incoming);
              localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
              renderDashboardAndOrders();
            }
          }
        )
        .subscribe();
      console.log('⚡ Supabase Realtime Connected');
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  }

  /* ============================================================
     7. AUTHENTICATION & LOGIN
     ============================================================ */

  async function checkExistingSession() {
    const session = loadSessionFromStorage();
    if (session && session.name) {
      currentUser = session;
      showAppScreen();
    } else {
      showLoginScreen();
    }
  }

  async function handleLogin(e) {
    if (e) e.preventDefault();

    const name = el.staffNameInput.value.trim();
    const password = el.passwordInput.value;

    el.loginError.textContent = '';
    el.loginError.classList.remove('visible');

    if (!name || !password) {
      el.loginError.textContent = 'กรุณากรอกชื่อและรหัสผ่าน';
      el.loginError.classList.add('visible');
      if (!name) el.staffNameInput.focus();
      else el.passwordInput.focus();
      return;
    }

    el.loginBtn.disabled = true;
    el.loginBtn.textContent = 'กำลังตรวจสอบ...';

    // Verify Password (against Supabase settings row or standard restaurant password)
    let isPasswordValid = false;

    if (supabaseClient) {
      try {
        const { data: settingRow } = await supabaseClient
          .from('settings')
          .select('shared_password')
          .eq('id', 1)
          .maybeSingle();

        if (settingRow && settingRow.shared_password) {
          isPasswordValid = (password === settingRow.shared_password);
        } else {
          isPasswordValid = (password === SHARED_PASSWORD_FALLBACK);
        }
      } catch {
        isPasswordValid = (password === SHARED_PASSWORD_FALLBACK);
      }
    } else {
      isPasswordValid = (password === SHARED_PASSWORD_FALLBACK);
    }

    if (!isPasswordValid) {
      el.loginError.textContent = 'รหัสผ่านร้านไม่ถูกต้อง';
      el.loginError.classList.add('visible');
      el.loginBtn.disabled = false;
      el.loginBtn.textContent = 'เข้าสู่ระบบ';
      return;
    }

    currentUser = {
      name: name,
      token: 'sb_tok_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      loginAt: new Date().toISOString()
    };

    saveSessionToStorage(currentUser);
    showAppScreen();

    el.loginBtn.disabled = false;
    el.loginBtn.textContent = 'เข้าสู่ระบบ';
  }

  function handleLogout() {
    currentUser = null;
    clearSessionFromStorage();
    showLoginScreen();
  }

  function showLoginScreen() {
    el.appScreen.classList.add('hidden');
    el.loginScreen.classList.remove('hidden');
    el.staffNameInput.value = '';
    el.passwordInput.value = '';
    el.loginError.textContent = '';
    el.loginError.classList.remove('visible');
  }

  async function showAppScreen() {
    el.loginScreen.classList.add('hidden');
    el.appScreen.classList.remove('hidden');

    if (currentUser) {
      el.headerStaffName.textContent = currentUser.name;
    }

    if (!selectedDate) {
      selectedDate = getLocalDateString();
    }
    el.orderDatePicker.value = selectedDate;

    // Fetch orders from Supabase cloud
    await fetchOrdersFromCloud();
    renderDashboardAndOrders();

    // Start Realtime cloud listener
    initSupabaseRealtime();
  }

  /* ============================================================
     8. ADD-ON MODAL & ORDER DRAFTING
     ============================================================ */

  function resetDraft(mainKey) {
    currentDraft = {
      mainKey: mainKey,
      addonsQty: {}
    };
    ADDONS.forEach(addon => {
      currentDraft.addonsQty[addon.id] = 0;
    });
  }

  function calculateDraftTotal() {
    if (!currentDraft.mainKey || !MAIN_MENU[currentDraft.mainKey]) {
      return 0;
    }
    const basePrice = MAIN_MENU[currentDraft.mainKey].price;
    const addonsTotal = ADDONS.reduce((sum, addon) => {
      const qty = currentDraft.addonsQty[addon.id] || 0;
      return sum + (addon.price * qty);
    }, 0);

    return basePrice + addonsTotal;
  }

  function openAddonModal(mainKey) {
    const mainItem = MAIN_MENU[mainKey];
    if (!mainItem) return;

    resetDraft(mainKey);

    el.modalItemIcon.textContent = mainItem.icon;
    el.modalItemTitle.textContent = mainItem.name;

    renderAddonRows();
    updateModalTotal();

    isSavingOrder = false;
    el.modalFinishBtn.disabled = false;
    el.modalFinishBtn.textContent = 'เสร็จสิ้น';

    if (typeof el.addonModal.showModal === 'function') {
      el.addonModal.showModal();
    } else {
      el.addonModal.setAttribute('open', '');
    }
  }

  function closeAddonModal() {
    if (typeof el.addonModal.close === 'function') {
      el.addonModal.close();
    } else {
      el.addonModal.removeAttribute('open');
    }
    currentDraft = { mainKey: null, addonsQty: {} };
    isSavingOrder = false;
  }

  function renderAddonRows() {
    el.addonListContainer.innerHTML = '';

    ADDONS.forEach(addon => {
      const qty = currentDraft.addonsQty[addon.id] || 0;

      const row = document.createElement('div');
      row.className = `addon-row ${qty > 0 ? 'has-qty' : ''}`;
      row.id = `addon-row-${addon.id}`;

      row.innerHTML = `
        <div class="addon-label-group">
          <span class="addon-name">${addon.name}</span>
          <span class="addon-price-label">+฿${addon.price}</span>
        </div>
        <div class="qty-stepper">
          <button 
            type="button" 
            class="stepper-btn stepper-btn-minus" 
            data-addon-id="${addon.id}" 
            data-action="minus"
            ${qty === 0 ? 'disabled' : ''}
            aria-label="ลดจำนวน ${addon.name}"
          >−</button>
          <span class="stepper-qty" id="qty-val-${addon.id}" aria-live="polite">${qty}</span>
          <button 
            type="button" 
            class="stepper-btn stepper-btn-plus" 
            data-addon-id="${addon.id}" 
            data-action="plus"
            aria-label="เพิ่มจำนวน ${addon.name}"
          >+</button>
        </div>
      `;

      el.addonListContainer.appendChild(row);
    });
  }

  function handleStepperClick(addonId, action) {
    const currentQty = currentDraft.addonsQty[addonId] || 0;
    let newQty = currentQty;

    if (action === 'plus') {
      newQty = currentQty + 1;
    } else if (action === 'minus') {
      newQty = Math.max(0, currentQty - 1);
    }

    currentDraft.addonsQty[addonId] = newQty;

    const qtySpan = document.getElementById(`qty-val-${addonId}`);
    if (qtySpan) {
      qtySpan.textContent = newQty;
    }

    const row = document.getElementById(`addon-row-${addonId}`);
    if (row) {
      if (newQty > 0) row.classList.add('has-qty');
      else row.classList.remove('has-qty');

      const minusBtn = row.querySelector('.stepper-btn-minus');
      if (minusBtn) {
        minusBtn.disabled = (newQty === 0);
      }
    }

    updateModalTotal();
  }

  function updateModalTotal() {
    const total = calculateDraftTotal();
    el.modalTotalDisplay.textContent = `฿${formatMoney(total)}`;
  }

  async function handleFinishOrder() {
    if (isSavingOrder) return;
    if (!currentDraft.mainKey || !MAIN_MENU[currentDraft.mainKey]) {
      closeAddonModal();
      return;
    }

    isSavingOrder = true;
    el.modalFinishBtn.disabled = true;
    el.modalFinishBtn.textContent = 'กำลังบันทึก...';

    const mainItem = MAIN_MENU[currentDraft.mainKey];
    const totalAmount = calculateDraftTotal();

    const orderAddons = [];
    ADDONS.forEach(addon => {
      const qty = currentDraft.addonsQty[addon.id] || 0;
      if (qty > 0) {
        orderAddons.push({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          quantity: qty
        });
      }
    });

    const now = new Date();
    const todayDate = getLocalDateString(now);

    const newOrder = {
      id: 'ord_' + now.getTime() + '_' + Math.random().toString(36).substring(2, 7),
      staff_name: currentUser ? currentUser.name : 'Staff',
      main_item: mainItem.name,
      main_price: mainItem.price,
      addons: orderAddons,
      total: totalAmount,
      date: todayDate,
      ordered_at: now.toISOString()
    };

    // Save to Cloud Database
    await saveOrderToCloud(newOrder);

    selectedDate = todayDate;
    el.orderDatePicker.value = todayDate;

    closeAddonModal();
    renderDashboardAndOrders();
  }

  /* ============================================================
     9. DASHBOARD & ORDERS RENDERING
     ============================================================ */

  function renderDashboardAndOrders() {
    const displayDate = formatDisplayDate(selectedDate);
    el.dateSummaryBadge.textContent = displayDate;
    el.ordersSectionDateLabel.textContent = displayDate;

    // Filter orders for selected date
    const dayOrders = orders.filter(o => o.date === selectedDate);

    // Revenue only (sum of total amounts) - NO PROFIT / NO COST
    const totalIncome = dayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const orderCount = dayOrders.length;

    el.totalIncomeDisplay.textContent = formatMoney(totalIncome);
    el.orderCountDisplay.textContent = `${orderCount} ออเดอร์`;
    el.ordersCountSubtitle.textContent = `${orderCount} รายการ`;

    renderOrdersList(dayOrders);
  }

  function renderOrdersList(dayOrders) {
    el.ordersContainer.innerHTML = '';

    if (!dayOrders || dayOrders.length === 0) {
      el.ordersContainer.innerHTML = `
        <div class="empty-orders">
          <span class="empty-icon" aria-hidden="true">📋</span>
          <span class="empty-text">ยังไม่มีออเดอร์สำหรับวันที่เลือก</span>
          <span class="empty-subtext">แตะที่เมนูเพื่อเริ่มบันทึกออเดอร์ใหม่</span>
        </div>
      `;
      return;
    }

    dayOrders.forEach(order => {
      const orderCard = document.createElement('div');
      orderCard.className = 'order-card';
      orderCard.setAttribute('role', 'listitem');

      let summary = order.main_item || 'ออเดอร์';
      if (order.addons && order.addons.length > 0) {
        const addonParts = order.addons.map(addon => {
          if (addon.quantity > 1) {
            return `${addon.name} × ${addon.quantity}`;
          }
          return `${addon.name}`;
        });
        summary += ' + ' + addonParts.join(' + ');
      }

      const orderTime = formatTime(order.ordered_at);
      const staffName = order.staff_name || 'Staff';

      orderCard.innerHTML = `
        <div class="order-card-main">
          <div class="order-items-summary">${escapeHtml(summary)}</div>
          <div class="order-meta-info">
            <span class="order-staff-tag">${escapeHtml(staffName)}</span>
            <span class="order-separator">·</span>
            <span class="order-time">${orderTime}</span>
          </div>
        </div>
        <div class="order-total-price">
          ฿${formatMoney(order.total)}
        </div>
      `;

      el.ordersContainer.appendChild(orderCard);
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  /* ============================================================
     10. EVENT LISTENERS
     ============================================================ */

  function setupEventListeners() {
    el.loginForm.addEventListener('submit', handleLogin);
    el.logoutBtn.addEventListener('click', handleLogout);

    el.orderDatePicker.addEventListener('change', (e) => {
      selectedDate = e.target.value || getLocalDateString();
      renderDashboardAndOrders();
    });

    el.todayQuickBtn.addEventListener('click', () => {
      selectedDate = getLocalDateString();
      el.orderDatePicker.value = selectedDate;
      renderDashboardAndOrders();
    });

    el.menuCardPork.addEventListener('click', () => openAddonModal('pork'));
    el.menuCardChicken.addEventListener('click', () => openAddonModal('chicken'));

    el.addonListContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;
      const addonId = btn.getAttribute('data-addon-id');
      const action = btn.getAttribute('data-action');
      if (addonId && action) {
        handleStepperClick(addonId, action);
      }
    });

    el.modalCloseBtn.addEventListener('click', closeAddonModal);
    el.modalFinishBtn.addEventListener('click', handleFinishOrder);

    // Light-dismiss fallback
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      el.addonModal.addEventListener('click', (event) => {
        if (event.target !== el.addonModal) return;
        const rect = el.addonModal.getBoundingClientRect();
        const isContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isContent) {
          closeAddonModal();
        }
      });
    }

    el.addonModal.addEventListener('cancel', () => {
      currentDraft = { mainKey: null, addonsQty: {} };
      isSavingOrder = false;
    });
  }

  /* ============================================================
     11. INITIALIZATION
     ============================================================ */
  function init() {
    selectedDate = getLocalDateString();
    setupEventListeners();
    checkExistingSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
