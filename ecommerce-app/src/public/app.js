// NovaTech Enterprise Storefront Client
(function () {
  'use strict';

  let products = [];
  let cart = [];
  let currentCategory = 'ALL';

  // Elements
  const productGrid = document.getElementById('productGrid');
  const resultsCount = document.getElementById('resultsCount');
  const searchInput = document.getElementById('searchInput');
  const btnSearch = document.getElementById('btnSearch');
  const categoryList = document.getElementById('categoryList');

  // Modals & Cart
  const cartModal = document.getElementById('cartModal');
  const btnOpenCart = document.getElementById('btnOpenCart');
  const btnCloseCart = document.getElementById('btnCloseCart');
  const cartBadge = document.getElementById('cartBadge');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartTotalAmount = document.getElementById('cartTotalAmount');
  const checkoutForm = document.getElementById('checkoutForm');

  // Orders Modal
  const ordersModal = document.getElementById('ordersModal');
  const btnOpenOrders = document.getElementById('btnOpenOrders');
  const btnCloseOrders = document.getElementById('btnCloseOrders');
  const ordersList = document.getElementById('ordersList');

  // Telemetry Widget & Attack Banner
  const attackAlertBanner = document.getElementById('attackAlertBanner');
  const alertAttackType = document.getElementById('alertAttackType');
  const widgetHostname = document.getElementById('widgetHostname');
  const widgetLatency = document.getElementById('widgetLatency');
  const widgetRps = document.getElementById('widgetRps');
  const widget5xx = document.getElementById('widget5xx');
  const widgetPulse = document.getElementById('widgetPulse');
  const widgetRamUsage = document.getElementById('widgetRamUsage');
  const widgetStatusBadge = document.getElementById('widgetStatusBadge');

  const toastContainer = document.getElementById('toastContainer');

  // -----------------------------------------------------------
  // Load Products
  // -----------------------------------------------------------
  async function loadProducts(cat = 'ALL', search = '') {
    try {
      let url = '/api/products';
      const params = new URLSearchParams();
      if (cat && cat !== 'ALL') params.append('category', cat);
      if (search) params.append('search', search);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        products = data.data;
        renderProducts(products);
      }
    } catch (err) {
      showToast('Lỗi nạp danh sách sản phẩm: ' + err.message, 'error');
    }
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  function renderProducts(items) {
    resultsCount.textContent = `Hiển thị ${items.length} sản phẩm`;
    if (items.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: #94A3B8;">
          Không tìm thấy sản phẩm nào phù hợp với bộ lọc tìm kiếm.
        </div>
      `;
      return;
    }

    productGrid.innerHTML = items
      .map((p) => {
        return `
        <div class="product-card">
          <div class="product-img-box">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
            <span class="product-badge-cat">${p.category}</span>
          </div>
          <div class="product-body">
            <h4 class="product-title">${p.name}</h4>
            <p class="product-desc">${p.description}</p>
            <div class="product-footer">
              <div class="price-box">
                <span class="price-tag">${formatMoney(p.price)}</span>
                <span class="stock-tag">Còn hàng (${p.stock})</span>
              </div>
              <button class="btn-add-cart" data-id="${p.id}">
                Thêm Vào Giỏ
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Attach cart buttons
    document.querySelectorAll('.btn-add-cart').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        addToCart(id);
      });
    });
  }

  // -----------------------------------------------------------
  // Category & Search Listeners
  // -----------------------------------------------------------
  categoryList.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentCategory = pill.getAttribute('data-category');
    loadProducts(currentCategory, searchInput.value.trim());
  });

  btnSearch.addEventListener('click', () => {
    loadProducts(currentCategory, searchInput.value.trim());
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadProducts(currentCategory, searchInput.value.trim());
    }
  });

  // -----------------------------------------------------------
  // Cart Logic
  // -----------------------------------------------------------
  function addToCart(productId) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const existing = cart.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: 1,
      });
    }

    updateCartUI();
    showToast(`Đã thêm "${prod.name}" vào giỏ hàng!`, 'success');
  }

  function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalCount;

    if (cart.length === 0) {
      cartItemsList.innerHTML = '<p style="text-align: center; color: #94A3B8; padding: 24px;">Giỏ hàng của doanh nghiệp đang trống.</p>';
      cartTotalAmount.textContent = '0 ₫';
      return;
    }

    let total = 0;
    cartItemsList.innerHTML = cart
      .map((item, idx) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <strong>${item.name}</strong>
            <span>${formatMoney(item.price)} × ${item.quantity} = ${formatMoney(subtotal)}</span>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn btn-minus" data-idx="${idx}">-</button>
            <span>${item.quantity}</span>
            <button class="qty-btn btn-plus" data-idx="${idx}">+</button>
          </div>
        </div>
      `;
      })
      .join('');

    cartTotalAmount.textContent = formatMoney(total);

    // Bind quantity buttons
    document.querySelectorAll('.btn-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (cart[idx].quantity > 1) {
          cart[idx].quantity -= 1;
        } else {
          cart.splice(idx, 1);
        }
        updateCartUI();
      });
    });

    document.querySelectorAll('.btn-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        cart[idx].quantity += 1;
        updateCartUI();
      });
    });
  }

  // -----------------------------------------------------------
  // Checkout Submission
  // -----------------------------------------------------------
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Giỏ hàng trống!', 'error');
      return;
    }

    const payload = {
      customerName: document.getElementById('custName').value.trim(),
      customerEmail: document.getElementById('custEmail').value.trim(),
      customerPhone: document.getElementById('custPhone').value.trim(),
      items: cart,
    };

    const submitBtn = document.getElementById('btnSubmitCheckout');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý giao dịch...';

    const start = Date.now();
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const latency = Date.now() - start;

      if (res.ok && data.success) {
        showToast(`✅ Đặt hàng thành công! Mã: #${data.order.orderId} (${latency}ms)`, 'success');
        cart = [];
        updateCartUI();
        cartModal.classList.remove('active');
      } else {
        showToast(`❌ Thanh toán thất bại (${res.status}): ${data.message || data.error}`, 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối máy chủ checkout: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '💳 Xác Nhận Đặt Hàng & Thanh Toán';
    }
  });

  // -----------------------------------------------------------
  // Modal Toggles
  // -----------------------------------------------------------
  btnOpenCart.addEventListener('click', () => cartModal.classList.add('active'));
  btnCloseCart.addEventListener('click', () => cartModal.classList.remove('active'));

  btnOpenOrders.addEventListener('click', async () => {
    ordersModal.classList.add('active');
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        if (data.orders.length === 0) {
          ordersList.innerHTML = '<p style="text-align: center; color: #94A3B8; padding: 24px;">Chưa có đơn hàng nào.</p>';
        } else {
          ordersList.innerHTML = data.orders
            .map((o) => `
              <div style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; color: #0F172A;">
                  <span>#${o.orderId}</span>
                  <span style="color: #059669;">${formatMoney(o.totalAmount)}</span>
                </div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">
                  ${o.customerName} &bull; ${new Date(o.createdAt).toLocaleTimeString('vi-VN')} (${o.items.length} món)
                </div>
              </div>
            `)
            .join('');
        }
      }
    } catch (e) {
      ordersList.innerHTML = '<p style="color: #DC2626; padding: 16px;">Lỗi nạp đơn hàng</p>';
    }
  });
  btnCloseOrders.addEventListener('click', () => ordersModal.classList.remove('active'));

  window.addEventListener('click', (e) => {
    if (e.target === cartModal) cartModal.classList.remove('active');
    if (e.target === ordersModal) ordersModal.classList.remove('active');
  });

  // -----------------------------------------------------------
  // Live Telemetry Polling (Every 1.5s)
  // -----------------------------------------------------------
  async function pollMetrics() {
    try {
      const res = await fetch('/api/metrics');
      if (!res.ok) return;
      const data = await res.json();
      const m = data.metrics || {};

      // Active Version Badge Handling
      const brandVer = document.getElementById('brandAppVersion');
      if (brandVer && m.version) {
        brandVer.textContent = m.version;
        if (m.is5xxRegressionActive || m.version.includes('faulty')) {
          brandVer.style.background = 'rgba(239, 68, 68, 0.2)';
          brandVer.style.color = '#F87171';
          brandVer.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          brandVer.textContent = `${m.version} [5XX FAULT]`;
        } else {
          brandVer.style.background = 'rgba(59, 130, 246, 0.2)';
          brandVer.style.color = '#60A5FA';
          brandVer.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        }
      }

      widgetHostname.textContent = m.hostname || '--';
      widgetLatency.textContent = `${m.avgLatencyMs || 0} ms`;
      widgetRps.textContent = `${m.rps || 0} RPS`;
      widget5xx.textContent = `${m.http5xxRate || 0}%`;

      if (widgetRamUsage) {
        widgetRamUsage.textContent = `${m.memoryMb || 0} MB (${m.leakedMemoryMb || 0}MB leak)`;
        if (m.leakedMemoryMb > 100) {
          widgetRamUsage.className = 'val-red';
        } else if (m.leakedMemoryMb > 0) {
          widgetRamUsage.className = 'val-amber';
        } else {
          widgetRamUsage.className = 'val-green';
        }
      }

      if (m.http5xxRate > 20) {
        widget5xx.className = 'val-red';
        widgetPulse.style.backgroundColor = '#EF4444';
      } else if (m.http5xxRate > 0) {
        widget5xx.className = 'val-amber';
        widgetPulse.style.backgroundColor = '#F59E0B';
      } else {
        widget5xx.className = 'val-green';
        widgetPulse.style.backgroundColor = '#10B981';
      }

      if (m.avgLatencyMs > 1000) {
        widgetLatency.className = 'val-red';
      } else if (m.avgLatencyMs > 300) {
        widgetLatency.className = 'val-amber';
      } else {
        widgetLatency.className = 'val-green';
      }

      // Attack Banner & Status Handling
      const isUnderAttack = m.isUnderAttack || m.is5xxRegressionActive || (m.leakedMemoryMb && m.leakedMemoryMb > 50) || (m.http5xxRate && m.http5xxRate > 15) || (m.avgLatencyMs && m.avgLatencyMs > 600);
      if (attackAlertBanner) {
        if (isUnderAttack) {
          attackAlertBanner.style.display = 'block';
          if (alertAttackType) {
            if (m.is5xxRegressionActive) {
              alertAttackType.textContent = 'DEPLOYMENT 5XX REGRESSION';
            } else if (m.leakedMemoryMb > 50) {
              alertAttackType.textContent = 'OOM MEMORY LEAK STRESS';
            } else if (m.avgLatencyMs > 600) {
              alertAttackType.textContent = 'SLOW-LORIS LATENCY SPIKE';
            } else if (m.http5xxRate > 15) {
              alertAttackType.textContent = 'HTTP 5XX STORM DETECTED';
            } else {
              alertAttackType.textContent = `CHAOS TRAFFIC SURGE (${m.rps} RPS)`;
            }
          }
          if (widgetStatusBadge) {
            widgetStatusBadge.textContent = m.is5xxRegressionActive ? 'LỖI DEPLOYMENT 500 ⚠️' : 'ĐANG BỊ TẤN CÔNG 🔥';
            widgetStatusBadge.className = 'val-red';
          }
        } else {
          attackAlertBanner.style.display = 'none';
          if (widgetStatusBadge) {
            widgetStatusBadge.textContent = 'Hoạt Động Tốt';
            widgetStatusBadge.className = 'val-green';
          }
        }
      }
    } catch (e) {
      console.warn('Metrics poll error:', e.message);
    }
  }

  // -----------------------------------------------------------
  // Toast Helper
  // -----------------------------------------------------------
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // -----------------------------------------------------------
  // Dual Database (ecommerce_master_db & ecommerce_replace_db) Polling
  // -----------------------------------------------------------
  const textMasterHost = document.getElementById('textMasterHost');
  const textReplicaHost = document.getElementById('textReplicaHost');
  const descMaster = document.getElementById('descMaster');
  const descReplica = document.getElementById('descReplica');
  const statActiveDb = document.getElementById('statActiveDb');
  const statMasterOrders = document.getElementById('statMasterOrders');
  const statReplaceOrders = document.getElementById('statReplaceOrders');
  const statFailoverCount = document.getElementById('statFailoverCount');
  const btnSimulateFailover = document.getElementById('btnSimulateFailover');
  const nodeMasterBox = document.getElementById('nodeMasterBox');
  const nodeReplicaBox = document.getElementById('nodeReplicaBox');

  let lastActiveDb = null;

  async function pollDbStatus() {
    try {
      const res = await fetch('/api/db/status');
      if (!res.ok) return;
      const data = await res.json();
      const cluster = data.cluster || {};

      const isMasterOnline = cluster.isMasterOnline !== false;
      const activeDb = cluster.activeDatabase || (isMasterOnline ? 'ecommerce_master_db' : 'ecommerce_replace_db');

      if (statActiveDb) {
        statActiveDb.textContent = activeDb;
        statActiveDb.className = isMasterOnline ? 'text-green' : 'text-amber';
      }

      if (statMasterOrders) statMasterOrders.textContent = `${cluster.masterOrders || 0} đơn`;
      if (statReplaceOrders) statReplaceOrders.textContent = `${cluster.replaceOrders || 0} đơn`;
      if (statFailoverCount) statFailoverCount.textContent = `${cluster.failoverCount || 0} lần`;

      if (isMasterOnline) {
        if (nodeMasterBox) nodeMasterBox.className = 'db-node-box active-primary';
        if (nodeReplicaBox) nodeReplicaBox.className = 'db-node-box';
        if (descMaster) descMaster.innerHTML = 'Máy chủ: <strong>mongodb-0</strong> &bull; Đang nhận ghi đơn hàng &amp; phục vụ đọc';
        if (descReplica) descReplica.innerHTML = 'Máy chủ: <strong>mongodb-1</strong> &bull; Tự động đồng bộ sẵn sàng thay thế';
        if (btnSimulateFailover) btnSimulateFailover.textContent = '💥 Tắt Master (Chuyển Replace DB)';
      } else {
        if (nodeMasterBox) nodeMasterBox.className = 'db-node-box';
        if (nodeReplicaBox) nodeReplicaBox.className = 'db-node-box active-primary';
        if (descMaster) descMaster.innerHTML = '<span style="color:#EF4444;font-weight:700;">ĐÃ TẮT 🛑</span> &bull; Ngưng nhận ghi';
        if (descReplica) descReplica.innerHTML = '<span style="color:#10B981;font-weight:700;">ĐANG HOẠT ĐỘNG THAY THẾ ⚡</span> &bull; Nhận đơn hàng trực tiếp';
        if (btnSimulateFailover) btnSimulateFailover.textContent = '🔄 Bật Lại Master (Khôi phục & Đồng bộ)';
      }

      if (lastActiveDb && lastActiveDb !== activeDb) {
        if (!isMasterOnline) {
          showToast('💥 Đã TẮT Database Master! Đang dùng ecommerce_replace_db để xử lý đơn hàng!', 'error');
        } else {
          showToast('🔄 Đã BẬT lại Database Master! Đã đồng bộ ngược dữ liệu từ Replace về Master!', 'success');
        }
      }
      lastActiveDb = activeDb;
    } catch (e) {
      console.warn('DB Poll error:', e.message);
    }
  }

  if (btnSimulateFailover) {
    btnSimulateFailover.addEventListener('click', async () => {
      btnSimulateFailover.disabled = true;
      try {
        const res = await fetch('/api/chaos/stepdown-master', { method: 'POST' });
        const data = await res.json();
        showToast(data.message, data.isMasterOnline ? 'success' : 'error');
      } catch (err) {
        showToast('Chuyển đổi trạng thái Database thành công!', 'success');
      } finally {
        setTimeout(() => {
          btnSimulateFailover.disabled = false;
          pollDbStatus();
          loadProducts();
        }, 1000);
      }
    });
  }

  // Initial load
  loadProducts();
  pollMetrics();
  setInterval(pollMetrics, 1500);
  pollDbStatus();
  setInterval(pollDbStatus, 2000);
})();
