// Chaos Attack Injector 3.0 Client Controller
(function () {
  'use strict';

  // Elements
  const targetUrlInput = document.getElementById('targetUrlInput');
  const btnPingTarget = document.getElementById('btnPingTarget');
  const headerAttackStatus = document.getElementById('headerAttackStatus');
  const footerTarget = document.getElementById('footerTarget');

  const attackBanner = document.getElementById('attackBanner');
  const bannerIcon = document.getElementById('bannerIcon');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerDesc = document.getElementById('bannerDesc');

  const progressBox = document.getElementById('progressBox');
  const activeAttackTitle = document.getElementById('activeAttackTitle');
  const activeRampText = document.getElementById('activeRampText');
  const countdownVal = document.getElementById('countdownVal');
  const progressFill = document.getElementById('progressFill');

  // Stats Counters
  const valTotalRequests = document.getElementById('valTotalRequests');
  const valLiveRps = document.getElementById('valLiveRps');
  const valErrors5xx = document.getElementById('valErrors5xx');
  const valRate5xx = document.getElementById('valRate5xx');
  const valTargetLatency = document.getElementById('valTargetLatency');
  const valSuccess2xx = document.getElementById('valSuccess2xx');
  const valNetworkFails = document.getElementById('valNetworkFails');

  // Buttons
  const btnSingleProbe = document.getElementById('btnSingleProbe');
  const btnResetTargetMem = document.getElementById('btnResetTargetMem');
  const btnExportReport = document.getElementById('btnExportReport');
  const btnStopAttack = document.getElementById('btnStopAttack');
  const btnLaunchAttack = document.getElementById('btnLaunchAttack');
  const btnHaltAttack = document.getElementById('btnHaltAttack');
  const btnClearLogs = document.getElementById('btnClearLogs');

  // Sliders & Controls
  const rangeRps = document.getElementById('rangeRps');
  const valRpsLabel = document.getElementById('valRpsLabel');
  const inputDurationCustom = document.getElementById('inputDurationCustom');
  const durationBtns = document.querySelectorAll('.btn-dur');
  const quickRpsBtns = document.querySelectorAll('.btn-quick-rps');
  const vectorCards = document.querySelectorAll('.vector-card');
  const rampOptions = document.querySelectorAll('.ramp-opt');

  const terminalLogs = document.getElementById('terminalLogs');

  let selectedAttackType = 'legit_order_surge';
  let selectedDuration = 30;
  let selectedRampMode = 'gradual';
  let selectedRps = 75;
  let selectedIntensityLevel = 'medium';

  const INTENSITY_CONFIG = {
    low: { name: 'Mức Nhẹ (Low)', rps: 20, hint: 'Mức Nhẹ: 20 RPS, RAM +10MB, Latency +500ms' },
    medium: { name: 'Mức Vừa (Medium)', rps: 65, hint: 'Mức Vừa: 65 RPS, RAM +25MB, Latency +1500ms' },
    high: { name: 'Mức Nặng (High)', rps: 140, hint: 'Mức Nặng: 140 RPS, RAM +50MB, Latency +3000ms' },
    extreme: { name: 'Mức Cực Đại (Extreme)', rps: 250, hint: 'Mức Cực Đại: 250 RPS, RAM +100MB, Latency +5000ms' },
  };

  function updateLaunchButtonForVector() {
    if (!btnLaunchAttack) return;
    if (selectedAttackType === 'legit_order_surge') {
      btnLaunchAttack.innerHTML = '<span>🚀 PHÁT ĐỘNG TEST BÃO ĐẶT HÀNG (SCALE POD - 0% LỖI 5XX)</span>';
      btnLaunchAttack.classList.add('btn-launch-scale-pod-mode');
    } else {
      btnLaunchAttack.innerHTML = '<span>🚀 PHÁT ĐỘNG TẤN CÔNG VÀO WEB THƯƠNG MẠI</span>';
      btnLaunchAttack.classList.remove('btn-launch-scale-pod-mode');
    }
  }
  updateLaunchButtonForVector();

  footerTarget.textContent = targetUrlInput.value;
  targetUrlInput.addEventListener('input', () => {
    footerTarget.textContent = targetUrlInput.value;
  });

  // -----------------------------------------------------------
  // Tab Switching
  // -----------------------------------------------------------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = 'tab' + btn.getAttribute('data-tab').charAt(0).toUpperCase() + btn.getAttribute('data-tab').slice(1);
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
    });
  });

  // -----------------------------------------------------------
  // Attack Vector Selection
  // -----------------------------------------------------------
  vectorCards.forEach((card) => {
    card.addEventListener('click', () => {
      vectorCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        selectedAttackType = radio.value;
        updateLaunchButtonForVector();
      }
    });
  });

  // -----------------------------------------------------------
  // Duration & RPS Controls
  // -----------------------------------------------------------
  durationBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      durationBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDuration = parseInt(btn.getAttribute('data-dur'), 10);
      inputDurationCustom.value = selectedDuration;
    });
  });

  inputDurationCustom.addEventListener('input', () => {
    selectedDuration = parseInt(inputDurationCustom.value, 10) || 30;
    durationBtns.forEach((b) => {
      if (parseInt(b.getAttribute('data-dur'), 10) === selectedDuration) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  });

  rangeRps.addEventListener('input', () => {
    selectedRps = parseInt(rangeRps.value, 10);
    valRpsLabel.textContent = selectedRps + ' RPS';
  });

  quickRpsBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedRps = parseInt(btn.getAttribute('data-rps'), 10);
      rangeRps.value = selectedRps;
      valRpsLabel.textContent = selectedRps + ' RPS';
    });
  });

  rampOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      rampOptions.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        selectedRampMode = radio.value;
      }
    });
  });

  // Builder Intensity Pills Listener
  const builderIntensityBtns = document.querySelectorAll('#builderIntensityPills .btn-intensity');
  const builderIntensityHint = document.getElementById('builderIntensityHint');
  builderIntensityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      builderIntensityBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedIntensityLevel = btn.getAttribute('data-level') || 'medium';
      const cfg = INTENSITY_CONFIG[selectedIntensityLevel];
      if (cfg) {
        selectedRps = cfg.rps;
        rangeRps.value = cfg.rps;
        valRpsLabel.textContent = cfg.rps + ' RPS';
        if (builderIntensityHint) builderIntensityHint.textContent = cfg.hint;
      }
    });
  });

  // -----------------------------------------------------------
  // Polling Status (Every 800ms)
  // -----------------------------------------------------------
  async function pollStatus() {
    try {
      const res = await fetch('/api/attack/status');
      if (!res.ok) return;
      const data = await res.json();
      renderStatus(data.stats, data.recentLogs || []);
    } catch (e) {
      console.warn('Status poll error:', e.message);
    }
  }

  function renderStatus(stats, logs) {
    if (!stats) return;

    // Counters
    valTotalRequests.textContent = stats.requestsSent.toLocaleString();
    valLiveRps.textContent = stats.currentRps.toFixed(1) + ' RPS';
    valErrors5xx.textContent = stats.errors5xx.toLocaleString();
    
    const rate5xx = stats.requestsSent > 0 ? ((stats.errors5xx / stats.requestsSent) * 100).toFixed(1) : '0.0';
    valRate5xx.textContent = rate5xx + '%';

    valTargetLatency.textContent = stats.avgLatencyMs + ' ms';
    valSuccess2xx.textContent = stats.success2xx.toLocaleString();
    valNetworkFails.textContent = stats.networkErrors.toLocaleString();

    // Banner & Progress
    if (stats.isAttacking) {
      headerAttackStatus.textContent = '🔥 ĐANG TẤN CÔNG!';
      headerAttackStatus.style.backgroundColor = '#991B1B';
      headerAttackStatus.style.color = '#FCA5A5';

      attackBanner.className = 'attack-banner active-mode';
      bannerIcon.textContent = '⚡';
      bannerTitle.textContent = `ĐANG PHÁT ĐỘNG: ${stats.attackName}`;
      bannerDesc.textContent = `Mục tiêu: ${stats.targetUrl} | Thời gian: ${stats.elapsedSeconds}s / ${stats.durationSeconds}s | Tốc độ: ${stats.currentRps} RPS`;

      progressBox.style.display = 'block';
      activeAttackTitle.textContent = stats.attackName;
      activeRampText.textContent = getRampText(stats.rampMode);

      const mins = Math.floor(stats.remainingSeconds / 60);
      const secs = stats.remainingSeconds % 60;
      countdownVal.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const pct = Math.min(Math.round((stats.elapsedSeconds / Math.max(stats.durationSeconds, 1)) * 100), 100);
      progressFill.style.width = pct + '%';
    } else {
      headerAttackStatus.textContent = 'TRẠNG THÁI: SẴN SÀNG';
      headerAttackStatus.style.backgroundColor = '#1F2937';
      headerAttackStatus.style.color = '#9CA3AF';

      attackBanner.className = 'attack-banner';
      bannerIcon.textContent = '🛡️';
      bannerTitle.textContent = 'Hệ thống tấn công đang ở chế độ chờ (Idle)';
      bannerDesc.textContent = 'Chọn kịch bản bên dưới và nhấn "Phát Động Tấn Công" để bơm tải lỗi vào web thương mại.';

      progressBox.style.display = 'none';
    }

    // Render Terminal logs
    renderLogs(logs);
  }

  function getRampText(mode) {
    switch (mode) {
      case 'instant': return '⚡ Tăng đột biến';
      case 'fast': return '🚀 Tăng nhanh (10s)';
      case 'slow': return '🐢 Tăng nhẹ chậm (60s)';
      case 'wave': return '🌊 Sóng dồn dập';
      case 'gradual': default: return '📈 Tăng dần dần';
    }
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) return;
    const html = logs
      .map((l) => {
        let cls = 'log-2xx';
        let badge = `[${l.statusCode || 'DROP'}]`;
        if (l.statusCode >= 500) {
          cls = 'log-5xx';
        } else if (l.statusCode >= 400) {
          cls = 'log-4xx';
        } else if (l.statusCode === 0) {
          cls = 'log-err';
        }
        return `<div class="log-line ${cls}">${l.time} &bull; ${l.method} ${l.endpoint} &bull; ${badge} ${l.latencyMs}ms</div>`;
      })
      .join('');

    terminalLogs.innerHTML = html;
  }

  btnClearLogs.addEventListener('click', () => {
    terminalLogs.innerHTML = '<div class="log-line text-muted">Nhật ký đã được xóa sạch.</div>';
  });

  // -----------------------------------------------------------
  // Action Handlers
  // -----------------------------------------------------------

  // Launch Custom Attack
  btnLaunchAttack.addEventListener('click', async () => {
    const targetUrl = targetUrlInput.value.trim();
    if (!targetUrl) {
      alert('Vui lòng nhập Target URL hợp lệ!');
      return;
    }

    let name = 'Tấn công HTTP Flood';
    if (selectedAttackType === 'legit_order_surge') name = 'Bão Đặt Hàng Hợp Lệ (Scale Pod - 0% Lỗi 5xx)';
    if (selectedAttackType === 'resource_exhaustion') name = 'Thiêu Đốt CPU (Heavy Query)';
    if (selectedAttackType === 'flash_sale_surge') name = 'Cơn Bão Đặt Hàng (Checkout Flood)';
    if (selectedAttackType === 'malformed_injection') name = 'Tiêm Payload Lỗi 500';
    if (selectedAttackType === 'memory_exhaustion') name = 'Bẫy Rò Rỉ Bộ Nhớ (RAM Leak Bomb)';
    if (selectedAttackType === 'slow_loris_latency') name = 'Sóng Trễ Tê Liệt (Latency Avalanche)';
    if (selectedAttackType === 'pod_crash_panic') name = 'Đột Tử Container (Pod Crash Panic)';
    if (selectedAttackType === 'mixed_chaos') name = 'Hỗn Hợp Đa Tấn Công (Mixed Chaos)';

    const payload = {
      targetUrl,
      attackType: selectedAttackType,
      attackName: name,
      durationSeconds: selectedDuration,
      targetRps: selectedRps,
      intensityLevel: selectedIntensityLevel,
      rampMode: selectedRampMode,
    };

    try {
      const res = await fetch('/api/attack/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        pollStatus();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi gửi lệnh tấn công: ' + err.message);
    }
  });

  // Emergency Halt
  btnStopAttack.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/attack/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        pollStatus();
      }
    } catch (e) {
      alert('Lỗi dừng tấn công: ' + e.message);
    }
  });

  btnHaltAttack.addEventListener('click', () => btnStopAttack.click());

  // -----------------------------------------------------------
  // Dedicated Scale Pod Panel Controls (Inside Tab Builder)
  // -----------------------------------------------------------
  const scalePanelRpsSlider = document.getElementById('scalePanelRpsSlider');
  const scalePanelRpsLabel = document.getElementById('scalePanelRpsLabel');
  const scalePanelRpsBtns = document.querySelectorAll('#scalePanelRpsPills .btn-scale-rps');
  const scalePanelDurBtns = document.querySelectorAll('#scalePanelDurPills .btn-scale-dur');
  const scalePanelCustomDur = document.getElementById('scalePanelCustomDur');
  const scalePanelRampBtns = document.querySelectorAll('#scalePanelRampPills .btn-scale-ramp');
  const btnLaunchScalePodDirect = document.getElementById('btnLaunchScalePodDirect');
  const btnStopScalePodDirect = document.getElementById('btnStopScalePodDirect');

  let scalePanelRps = 75;
  let scalePanelDur = 30;
  let scalePanelRamp = 'instant';

  if (scalePanelRpsSlider) {
    scalePanelRpsSlider.addEventListener('input', () => {
      scalePanelRps = parseInt(scalePanelRpsSlider.value, 10);
      if (scalePanelRpsLabel) scalePanelRpsLabel.textContent = scalePanelRps + ' RPS';
      scalePanelRpsBtns.forEach((b) => {
        if (parseInt(b.getAttribute('data-rps'), 10) === scalePanelRps) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  }

  scalePanelRpsBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      scalePanelRpsBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scalePanelRps = parseInt(btn.getAttribute('data-rps'), 10);
      if (scalePanelRpsSlider) scalePanelRpsSlider.value = scalePanelRps;
      if (scalePanelRpsLabel) scalePanelRpsLabel.textContent = scalePanelRps + ' RPS';
    });
  });

  scalePanelDurBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      scalePanelDurBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scalePanelDur = parseInt(btn.getAttribute('data-dur'), 10);
      if (scalePanelCustomDur) scalePanelCustomDur.value = scalePanelDur;
    });
  });

  if (scalePanelCustomDur) {
    scalePanelCustomDur.addEventListener('input', () => {
      scalePanelDur = parseInt(scalePanelCustomDur.value, 10) || 30;
      scalePanelDurBtns.forEach((b) => {
        if (parseInt(b.getAttribute('data-dur'), 10) === scalePanelDur) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  }

  scalePanelRampBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      scalePanelRampBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scalePanelRamp = btn.getAttribute('data-ramp') || 'instant';
    });
  });

  if (btnLaunchScalePodDirect) {
    btnLaunchScalePodDirect.addEventListener('click', async () => {
      const targetUrl = targetUrlInput ? targetUrlInput.value.trim() : 'http://ecommerce-store-service:8080';
      const intensity = scalePanelRps >= 200 ? 'extreme' : scalePanelRps >= 120 ? 'high' : scalePanelRps >= 50 ? 'medium' : 'low';
      
      const payload = {
        targetUrl: targetUrl || 'http://ecommerce-store-service:8080',
        attackType: 'legit_order_surge',
        attackName: 'Bão Đặt Hàng Hợp Lệ (Scale Pod - 0% Lỗi 5xx)',
        durationSeconds: scalePanelDur,
        targetRps: scalePanelRps,
        intensityLevel: intensity,
        rampMode: scalePanelRamp,
      };

      try {
        const res = await fetch('/api/attack/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          pollStatus();
          if (progressBox) progressBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          alert('Lỗi: ' + data.message);
        }
      } catch (err) {
        alert('Lỗi khởi động test: ' + err.message);
      }
    });
  }

  if (btnStopScalePodDirect) {
    btnStopScalePodDirect.addEventListener('click', () => {
      if (btnStopAttack) btnStopAttack.click();
    });
  }

  // Ping Target
  btnPingTarget.addEventListener('click', async () => {
    const target = targetUrlInput.value.trim();
    btnPingTarget.disabled = true;
    btnPingTarget.textContent = '...';

    const start = Date.now();
    try {
      const res = await fetch('/api/attack/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: target }),
      });
      const dur = Date.now() - start;
      const data = await res.json();
      const st = data.probeResult?.status || 0;
      if (st > 0) {
        alert(`✅ Ping thành công tới: ${target}\nMã phản hồi: HTTP ${st}\nThời gian: ${dur}ms`);
      } else {
        alert(`❌ Không thể kết nối tới: ${target}\nLỗi: ${data.probeResult?.error || 'Target down'}`);
      }
    } catch (e) {
      alert(`❌ Lỗi ping: ${e.message}`);
    } finally {
      btnPingTarget.disabled = false;
      btnPingTarget.textContent = 'Ping';
    }
  });

  btnSingleProbe.addEventListener('click', () => btnPingTarget.click());

  // Reset Target Memory
  if (btnResetTargetMem) {
    btnResetTargetMem.addEventListener('click', async () => {
      const targetUrl = targetUrlInput.value.trim();
      try {
        btnResetTargetMem.disabled = true;
        btnResetTargetMem.textContent = 'Đang xả...';
        const res = await fetch('/api/attack/reset-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl })
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ Đã giải phóng RAM trên Target!\nĐã xả: ${data.targetResponse?.releasedMb || 0} MB RAM rò rỉ.`);
        } else {
          alert('❌ Thất bại: ' + (data.message || 'Không thể xả RAM'));
        }
      } catch (err) {
        alert('❌ Lỗi kết nối xả RAM: ' + err.message);
      } finally {
        btnResetTargetMem.disabled = false;
        btnResetTargetMem.innerHTML = '<span>🧹 Xả RAM Target</span>';
      }
    });
  }

  // Dọn Dẹp Sạch Toàn Bộ Dữ Liệu Cũ & Reset Số Đo
  const btnCleanAllData = document.getElementById('btnCleanAllData');
  if (btnCleanAllData) {
    btnCleanAllData.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn DỌN DẸP SẠCH TOÀN BỘ dữ liệu test cũ, xóa đơn hàng rác MongoDB và reset toàn bộ số đo về 0 không?')) {
        return;
      }
      const targetUrl = targetUrlInput ? targetUrlInput.value.trim() : '';
      try {
        btnCleanAllData.disabled = true;
        btnCleanAllData.innerHTML = '<span>⏳ Đang dọn dẹp...</span>';
        const res = await fetch('/api/attack/clean-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl })
        });
        const data = await res.json();
        if (data.success) {
          if (typeof renderStatus === 'function' && data.stats) {
            renderStatus(data.stats, []);
          }
          if (typeof pollStatus === 'function') {
            await pollStatus();
          }
          alert('✅ ' + (data.message || 'Đã dọn dẹp sạch sẽ toàn bộ dữ liệu test!'));
        } else {
          alert('❌ Thất bại: ' + (data.error || data.message || 'Không thể dọn dẹp'));
        }
      } catch (err) {
        alert('❌ Lỗi kết nối dọn dẹp: ' + err.message);
      } finally {
        btnCleanAllData.disabled = false;
        btnCleanAllData.innerHTML = '<span>♻️ Dọn Dẹp Dữ Liệu Cũ</span>';
      }
    });
  }

  // Export Audit Report
  if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
      window.open('/api/attack/export?format=json', '_blank');
    });
  }

  // Presets with inline Duration & Intensity Controls
  // Handle mini duration pills in preset cards
  document.querySelectorAll('.preset-controls-box .dur-pills button').forEach((b) => {
    b.addEventListener('click', () => {
      b.parentElement.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
      b.classList.add('active');
    });
  });

  // Handle mini intensity pills in preset cards
  document.querySelectorAll('.preset-controls-box .int-pills button').forEach((b) => {
    b.addEventListener('click', () => {
      b.parentElement.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
      b.classList.add('active');
    });
  });

  const presetBtns = document.querySelectorAll('.btn-preset');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-preset');
      const target = targetUrlInput.value.trim();

      // Read custom duration & intensity from inline controls if available
      const ctrlBox = btn.parentElement.querySelector(`.preset-controls-box[data-preset-target="${key}"]`);
      let chosenDur = null;
      let chosenInt = 'medium';
      if (ctrlBox) {
        const activeDurBtn = ctrlBox.querySelector('.dur-pills button.active');
        if (activeDurBtn) chosenDur = parseInt(activeDurBtn.getAttribute('data-dur'), 10);
        const activeIntBtn = ctrlBox.querySelector('.int-pills button.active');
        if (activeIntBtn) chosenInt = activeIntBtn.getAttribute('data-level');
      }

      let payload = null;

      const baseDur = chosenDur || 30;
      switch (key) {
        case 'ddos_flood':
          payload = {
            targetUrl: target,
            attackType: 'http_flood',
            attackName: `DDoS HTTP Flood (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 45,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 280 : chosenInt === 'high' ? 160 : chosenInt === 'low' ? 30 : 80,
            rampMode: 'fast',
          };
          break;
        case 'cpu_burner':
          payload = {
            targetUrl: target,
            attackType: 'resource_exhaustion',
            attackName: `Quá Tải CPU Heavy Search (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 60,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 200 : chosenInt === 'high' ? 120 : chosenInt === 'low' ? 25 : 60,
            rampMode: 'gradual',
          };
          break;
        case 'scale_order_rush':
          payload = {
            targetUrl: target,
            attackType: 'legit_order_surge',
            attackName: `Bão Đặt Hàng Hợp Lệ Scale Pod (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 60,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 250 : chosenInt === 'high' ? 150 : chosenInt === 'low' ? 30 : 75,
            rampMode: 'fast',
          };
          break;
        case 'checkout_rush':
          payload = {
            targetUrl: target,
            attackType: 'flash_sale_surge',
            attackName: `Cơn Bão Flash Sale Checkout (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 45,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 200 : chosenInt === 'high' ? 120 : chosenInt === 'low' ? 25 : 70,
            rampMode: 'fast',
          };
          break;
        case 'error_storm':
          payload = {
            targetUrl: target,
            attackType: 'malformed_injection',
            attackName: `Bão Lỗi 500 Injection (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 30,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 150 : chosenInt === 'high' ? 90 : chosenInt === 'low' ? 20 : 50,
            rampMode: 'instant',
          };
          break;
        case 'memory_leak_bomb':
          payload = {
            targetUrl: target,
            attackType: 'memory_exhaustion',
            attackName: `Bẫy Rò Rỉ Bộ Nhớ RAM Leak (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 45,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 80 : chosenInt === 'high' ? 50 : chosenInt === 'low' ? 15 : 35,
            rampMode: 'gradual',
          };
          break;
        case 'latency_paralysis':
          payload = {
            targetUrl: target,
            attackType: 'slow_loris_latency',
            attackName: `Sóng Trễ Tê Liệt Latency (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 30,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 60 : chosenInt === 'high' ? 40 : chosenInt === 'low' ? 15 : 25,
            rampMode: 'instant',
          };
          break;
        case 'full_chaos_storm':
          payload = {
            targetUrl: target,
            attackType: 'mixed_chaos',
            attackName: `Thảm Họa Đa Lỗi Full Chaos (${chosenInt.toUpperCase()})`,
            durationSeconds: chosenDur || 60,
            intensityLevel: chosenInt,
            targetRps: chosenInt === 'extreme' ? 250 : chosenInt === 'high' ? 140 : chosenInt === 'low' ? 25 : 75,
            rampMode: 'gradual',
          };
          break;
      }

      if (payload) {
        try {
          const res = await fetch('/api/attack/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            document.querySelector('.tab-btn[data-tab="console"]').click();
            pollStatus();
          }
        } catch (e) {
          alert('Lỗi kích hoạt kịch bản: ' + e.message);
        }
      }
    });
  });

  // -----------------------------------------------------------
  // Deployment & Rollout Lab Controller
  // -----------------------------------------------------------
  const depVersionBadge = document.getElementById('depVersionBadge');
  const depImageTag = document.getElementById('depImageTag');
  const depReplicasVal = document.getElementById('depReplicasVal');
  const depReplicasSub = document.getElementById('depReplicasSub');
  const depHealthBadge = document.getElementById('depHealthBadge');
  const depHealthSub = document.getElementById('depHealthSub');
  const depProbeResultVal = document.getElementById('depProbeResultVal');
  const depProbeResultSub = document.getElementById('depProbeResultSub');

  const btnRefreshDepStatus = document.getElementById('btnRefreshDepStatus');
  const btnVerifyDepTraffic = document.getElementById('btnVerifyDepTraffic');

  const btnRunCleanRollout = document.getElementById('btnRunCleanRollout');
  const btnRun5xxRegression = document.getElementById('btnRun5xxRegression');
  const btnRunCrashLoop = document.getElementById('btnRunCrashLoop');
  const btnRunBadImage = document.getElementById('btnRunBadImage');
  const btnRunRollback = document.getElementById('btnRunRollback');

  const depPodsCountBadge = document.getElementById('depPodsCountBadge');
  const depPodsTableBody = document.getElementById('depPodsTableBody');
  const depEventsCountBadge = document.getElementById('depEventsCountBadge');
  const depEventsTableBody = document.getElementById('depEventsTableBody');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchDeploymentStatus() {
    try {
      const res = await fetch('/api/deployment/status');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const dep = data.deployment || {};
      const pods = data.pods || [];
      const events = data.events || [];
      const appProbe = data.appProbe || {};

      // 1. Meta & Replicas
      const desiredCount = dep.replicas?.desired || 0;
      const readyCount = dep.replicas?.ready || 0;

      if (depVersionBadge) depVersionBadge.textContent = dep.version || 'v1.0.0-stable';
      if (depImageTag) depImageTag.textContent = dep.image || 'selfheal-ecommerce-store:1.0.0';
      if (depReplicasVal) {
        depReplicasVal.textContent = `${readyCount} / ${desiredCount} Sẵn Sàng`;
      }
      if (depReplicasSub) {
        depReplicasSub.textContent = `${dep.replicas?.updated || 0} Đã cập nhật • ${dep.replicas?.available || 0} Khả dụng`;
      }

      // Update Top Pod Scaler Toolbar
      const topLivePodsBadge = document.getElementById('topLivePodsBadge');
      if (topLivePodsBadge) {
        topLivePodsBadge.textContent = `${desiredCount} Pods`;
        topLivePodsBadge.title = `${readyCount}/${desiredCount} Pods đang Sẵn Sàng`;
      }

      // Update Scale Pod Panel KPI Card
      const scalePanelLiveReplicas = document.getElementById('scalePanelLiveReplicas');
      if (scalePanelLiveReplicas) scalePanelLiveReplicas.textContent = `${desiredCount} Pods`;
      const scalePanelReadyReplicas = document.getElementById('scalePanelReadyReplicas');
      if (scalePanelReadyReplicas) scalePanelReadyReplicas.textContent = `${readyCount}/${desiredCount} Ready`;

      // Update Scale Pod Panel Controller Box Pill
      const scalePanelLiveReplicasPill = document.getElementById('scalePanelLiveReplicasPill');
      if (scalePanelLiveReplicasPill) scalePanelLiveReplicasPill.textContent = `${desiredCount} Pods`;
      const scalePanelLiveReadyTag = document.getElementById('scalePanelLiveReadyTag');
      if (scalePanelLiveReadyTag) scalePanelLiveReadyTag.textContent = `(${readyCount}/${desiredCount} Sẵn sàng)`;

      // Update Quick Pills active state
      document.querySelectorAll('.btn-scale-quick').forEach((btn) => {
        const val = parseInt(btn.getAttribute('data-replicas'), 10);
        if (val === desiredCount) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // 2. Health Probe
      if (depHealthBadge) {
        if (appProbe.status === 'UP') {
          depHealthBadge.className = 'badge-health-ok';
          depHealthBadge.textContent = '🟢 SẴN SÀNG (HTTP 200)';
          if (depHealthSub) depHealthSub.textContent = `Phiên bản: ${appProbe.version || dep.version} • Probes phản hồi tức thời`;
        } else if (appProbe.status === 'DOWN') {
          depHealthBadge.className = 'badge-health-err';
          depHealthBadge.textContent = '🔴 LỖI PROBE (HTTP 500)';
          if (depHealthSub) depHealthSub.textContent = 'Dịch vụ gặp lỗi nội bộ hoặc probe liveness thất bại';
        } else {
          depHealthBadge.className = 'badge-health-err';
          depHealthBadge.textContent = `⚠️ ${appProbe.status}`;
          if (depHealthSub) depHealthSub.textContent = appProbe.error || 'Không kết nối được tới Service Pods';
        }
      }

      // 3. Pods Table
      if (depPodsCountBadge) depPodsCountBadge.textContent = `${pods.length} Pods`;
      if (depPodsTableBody) {
        if (pods.length === 0) {
          depPodsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không tìm thấy Pods nào trong Deployment</td></tr>';
        } else {
          depPodsTableBody.innerHTML = pods.map((p) => {
            let pillClass = 'pill-running';
            if (p.phase !== 'Running' || !p.ready) {
              pillClass = p.restartCount > 2 ? 'pill-waiting' : 'pill-warn';
            }
            return `
              <tr>
                <td><strong style="color: #60A5FA; font-family: var(--font-mono);">${escapeHtml(p.name)}</strong></td>
                <td><span class="pod-status-pill ${pillClass}">${escapeHtml(p.stateReason || p.phase)}</span></td>
                <td><span style="font-weight: 700; color: ${p.ready ? '#34D399' : '#F87171'};">${p.ready ? 'Có' : 'Chưa'}</span></td>
                <td><span style="font-family: var(--font-mono); color: ${p.restartCount > 0 ? '#F87171' : '#9CA3AF'};">${p.restartCount}</span></td>
                <td><span style="font-family: var(--font-mono); color: var(--text-dim);">${escapeHtml(p.podIP || '--')}</span></td>
              </tr>
            `;
          }).join('');
        }
      }

      // 4. K8s Events Table
      if (depEventsCountBadge) depEventsCountBadge.textContent = `${events.length} Sự Kiện`;
      if (depEventsTableBody) {
        if (events.length === 0) {
          depEventsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Chưa có sự kiện Kubernetes nào được ghi nhận</td></tr>';
        } else {
          depEventsTableBody.innerHTML = events.map((ev) => {
            const isWarning = ev.type === 'Warning';
            return `
              <tr>
                <td><span class="${isWarning ? 'ev-warning' : 'ev-normal'}">${escapeHtml(ev.type)}</span></td>
                <td><strong>${escapeHtml(ev.reason)}</strong></td>
                <td><span style="font-family: var(--font-mono); font-size: 0.6875rem; color: #9CA3AF;">${escapeHtml(ev.object)}</span></td>
                <td style="color: #D1D5DB; font-size: 0.6875rem;">${escapeHtml(ev.message)}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.warn('[DeploymentStatus Error]', err);
    }
  }

  async function runDeploymentAction(action, btnEl) {
    if (!confirm(`Bạn có chắc chắn muốn thực hiện kịch bản: ${action}?`)) return;

    const originalText = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<span>⏳ Đang gửi lệnh tới Kubernetes API...</span>';
    }

    try {
      const res = await fetch('/api/deployment/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.actionTitle}\n\n${data.description}`);
        fetchDeploymentStatus();
        setTimeout(fetchDeploymentStatus, 2000);
        setTimeout(fetchDeploymentStatus, 5000);
        setTimeout(verifyDeploymentTraffic, 3000);
      } else {
        alert(`❌ Lỗi thực thi kịch bản: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`❌ Kết nối thất bại: ${e.message}`);
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalText;
      }
    }
  }

  async function verifyDeploymentTraffic() {
    if (depProbeResultVal) depProbeResultVal.textContent = '⏳ Đang test...';
    if (depProbeResultSub) depProbeResultSub.textContent = 'Bắn 10 requests tới /api/products...';

    try {
      const res = await fetch('/api/deployment/verify-traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (data.success) {
        if (depProbeResultVal) {
          depProbeResultVal.textContent = `${data.status200}/${data.totalProbes} OK (${data.error5xxRate}% 5xx)`;
          depProbeResultVal.style.color = data.error5xxRate > 0 ? '#F87171' : '#34D399';
        }
        if (depProbeResultSub) {
          depProbeResultSub.textContent = data.isHealthy
            ? '🟢 Dịch vụ hoàn toàn khỏe mạnh, 0% lỗi'
            : '⚠️ Phát hiện lỗi hồi quy logic 500 trên API!';
        }
      }
    } catch (e) {
      if (depProbeResultVal) depProbeResultVal.textContent = 'Lỗi test';
      if (depProbeResultSub) depProbeResultSub.textContent = e.message;
    }
  }

  if (btnRefreshDepStatus) btnRefreshDepStatus.addEventListener('click', () => {
    fetchDeploymentStatus();
    verifyDeploymentTraffic();
  });
  if (btnVerifyDepTraffic) btnVerifyDepTraffic.addEventListener('click', verifyDeploymentTraffic);

  if (btnRunCleanRollout) btnRunCleanRollout.addEventListener('click', () => runDeploymentAction('CLEAN_ROLLOUT', btnRunCleanRollout));
  if (btnRun5xxRegression) btnRun5xxRegression.addEventListener('click', () => runDeploymentAction('DEPLOY_5XX_REGRESSION', btnRun5xxRegression));
  if (btnRunCrashLoop) btnRunCrashLoop.addEventListener('click', () => runDeploymentAction('DEPLOY_CRASHLOOP', btnRunCrashLoop));
  if (btnRunBadImage) btnRunBadImage.addEventListener('click', () => runDeploymentAction('DEPLOY_BAD_IMAGE', btnRunBadImage));
  if (btnRunRollback) btnRunRollback.addEventListener('click', () => runDeploymentAction('ROLLBACK_DEPLOYMENT', btnRunRollback));

  // Tab change trigger
  tabBtns.forEach((b) => {
    if (b.getAttribute('data-tab') === 'deployment') {
      b.addEventListener('click', () => {
        fetchDeploymentStatus();
        verifyDeploymentTraffic();
      });
    }
  });

  setInterval(fetchDeploymentStatus, 4000);

  // -------------------------------------------------------------
  // Manual Pod Scaler Controls (Interactive K8s Scale Up / Down)
  // -------------------------------------------------------------
  let isScalingPods = false;
  async function scaleDeploymentPods(options) {
    if (isScalingPods) return;
    isScalingPods = true;

    const feedbackEl = document.getElementById('scalePodFeedback');
    const showFeedback = (msg, type = 'loading') => {
      if (!feedbackEl) return;
      feedbackEl.style.display = 'flex';
      feedbackEl.className = `scale-pod-feedback ${type}`;
      feedbackEl.textContent = msg;
    };

    showFeedback('⏳ Đang gửi lệnh K8s cập nhật số lượng Pod...', 'loading');

    const allScaleBtns = document.querySelectorAll(
      '#btnScaleDownTop, #btnScaleUpTop, #btnScalePodMinus1, #btnScalePodPlus1, .btn-scale-quick'
    );
    allScaleBtns.forEach((b) => (b.disabled = true));

    try {
      const res = await fetch('/api/deployment/scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi cập nhật K8s');
      }

      showFeedback(`✅ ${data.message}`, 'success');
      setTimeout(() => {
        if (feedbackEl) feedbackEl.style.display = 'none';
      }, 5000);

      fetchDeploymentStatus();
      setTimeout(fetchDeploymentStatus, 1500);
      setTimeout(fetchDeploymentStatus, 4000);
    } catch (err) {
      showFeedback(`❌ Lỗi khi scale Pod: ${err.message}`, 'error');
    } finally {
      isScalingPods = false;
      allScaleBtns.forEach((b) => (b.disabled = false));
    }
  }

  // Top header quick scaler
  const btnScaleDownTop = document.getElementById('btnScaleDownTop');
  if (btnScaleDownTop) {
    btnScaleDownTop.addEventListener('click', () => scaleDeploymentPods({ delta: -1 }));
  }
  const btnScaleUpTop = document.getElementById('btnScaleUpTop');
  if (btnScaleUpTop) {
    btnScaleUpTop.addEventListener('click', () => scaleDeploymentPods({ delta: 1 }));
  }

  // Panel controller buttons
  const btnScalePodMinus1 = document.getElementById('btnScalePodMinus1');
  if (btnScalePodMinus1) {
    btnScalePodMinus1.addEventListener('click', () => scaleDeploymentPods({ delta: -1 }));
  }
  const btnScalePodPlus1 = document.getElementById('btnScalePodPlus1');
  if (btnScalePodPlus1) {
    btnScalePodPlus1.addEventListener('click', () => scaleDeploymentPods({ delta: 1 }));
  }

  // Quick pills buttons (1, 2, 4, 6, 8 Pods)
  document.querySelectorAll('.btn-scale-quick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const replicas = parseInt(btn.getAttribute('data-replicas'), 10);
      if (!isNaN(replicas)) {
        scaleDeploymentPods({ replicas });
      }
    });
  });

  // Initial poll
  pollStatus();
  setInterval(pollStatus, 800);

  // -----------------------------------------------------------
  // ALL ACTIONS TEST SUITE CONTROLLER (17 ACTIONS)
  // -----------------------------------------------------------
  const actionsCatalogContainer = document.getElementById('actionsCatalogContainer');
  const btnRunAllSuite = document.getElementById('btnRunAllSuite');
  const btnResetSuiteStatus = document.getElementById('btnResetSuiteStatus');
  const suiteGlobalDurPills = document.querySelectorAll('#suiteGlobalDurPills button');
  const suiteGlobalIntPills = document.querySelectorAll('#suiteGlobalIntPills button');

  const suiteTotalActionsEl = document.getElementById('suiteTotalActions');
  const suitePassedCountEl = document.getElementById('suitePassedCount');
  const suiteWarnedCountEl = document.getElementById('suiteWarnedCount');
  const suiteFailedCountEl = document.getElementById('suiteFailedCount');
  const suiteTotalRequestsSentEl = document.getElementById('suiteTotalRequestsSent');

  let globalSuiteDuration = 10;
  let globalSuiteIntensity = 'medium';
  let cachedActions = [];
  let isRunningFullSuite = false;

  let suiteStats = {
    total: 17,
    passed: 0,
    warned: 0,
    failed: 0,
    totalRequests: 0,
  };

  // Global Duration & Intensity Pills Listeners
  suiteGlobalDurPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      suiteGlobalDurPills.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      globalSuiteDuration = parseInt(btn.getAttribute('data-dur'), 10) || 10;
      // Propagate to all card duration pills
      document.querySelectorAll('.action-test-card .card-dur-pills button').forEach((b) => {
        if (parseInt(b.getAttribute('data-dur'), 10) === globalSuiteDuration) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  });

  suiteGlobalIntPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      suiteGlobalIntPills.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      globalSuiteIntensity = btn.getAttribute('data-level') || 'medium';
      // Propagate to all card intensity pills
      document.querySelectorAll('.action-test-card .card-int-pills button').forEach((b) => {
        if (b.getAttribute('data-level') === globalSuiteIntensity) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  });

  function updateSuiteStatsDisplay() {
    if (suiteTotalActionsEl) suiteTotalActionsEl.textContent = suiteStats.total;
    if (suitePassedCountEl) suitePassedCountEl.textContent = suiteStats.passed;
    if (suiteWarnedCountEl) suiteWarnedCountEl.textContent = suiteStats.warned;
    if (suiteFailedCountEl) suiteFailedCountEl.textContent = suiteStats.failed;
    if (suiteTotalRequestsSentEl) suiteTotalRequestsSentEl.textContent = suiteStats.totalRequests.toLocaleString();
  }

  if (btnResetSuiteStatus) {
    btnResetSuiteStatus.addEventListener('click', () => {
      suiteStats = { total: cachedActions.length || 17, passed: 0, warned: 0, failed: 0, totalRequests: 0 };
      updateSuiteStatsDisplay();
      document.querySelectorAll('.action-test-card').forEach((card) => {
        card.className = 'action-test-card';
        const pill = card.querySelector('.action-status-pill');
        if (pill) {
          pill.className = 'action-status-pill status-idle';
          pill.textContent = 'SẴN SÀNG';
        }
        const resBox = card.querySelector('.action-result-box');
        if (resBox) resBox.style.display = 'none';
      });
    });
  }

  async function loadActionsCatalog() {
    try {
      const res = await fetch('/api/actions/catalog');
      const data = await res.json();
      if (!data.success || !data.catalog) return;

      cachedActions = data.catalog;
      renderActionsCatalog(data.catalog);
    } catch (e) {
      console.warn('Failed to load actions catalog:', e.message);
    }
  }

  function renderActionsCatalog(catalog) {
    if (!actionsCatalogContainer) return;

    // Group by category
    const groups = {};
    catalog.forEach((act) => {
      if (!groups[act.category]) {
        groups[act.category] = { name: act.categoryName, items: [] };
      }
      groups[act.category].items.push(act);
    });

    let html = '';
    Object.keys(groups).forEach((catKey) => {
      const grp = groups[catKey];
      html += `
        <div class="action-cat-section">
          <div class="action-cat-heading">
            <span>${escapeHtml(grp.name)}</span>
            <span class="cat-count-badge">${grp.items.length} Actions</span>
          </div>
          <div class="actions-card-grid">
            ${grp.items.map((act) => renderActionCard(act)).join('')}
          </div>
        </div>
      `;
    });

    actionsCatalogContainer.innerHTML = html;
    bindActionCardEvents();
    suiteStats.total = catalog.length;
    updateSuiteStatsDisplay();
  }

  function renderActionCard(act) {
    return `
      <div class="action-test-card" id="card-act-${escapeHtml(act.id)}" data-action-id="${escapeHtml(act.id)}">
        <div>
          <div class="action-card-top">
            <div class="action-card-icon">${act.icon || '⚡'}</div>
            <div class="action-card-title-box">
              <h4>${escapeHtml(act.name)}</h4>
              <span class="action-card-target-tag">${escapeHtml(act.targetKind)}: ${escapeHtml(act.endpoint)}</span>
            </div>
          </div>
          <p class="action-card-desc">${escapeHtml(act.description)}</p>

          <!-- Inline Duration & Intensity Controls -->
          <div class="action-card-config">
            <div class="action-param-row">
              <label>⏱️ Thời gian:</label>
              <div class="mini-pills card-dur-pills">
                <button type="button" data-dur="5"${act.defaultDuration === 5 ? ' class="active"' : ''}>5s</button>
                <button type="button" data-dur="10"${act.defaultDuration === 10 || act.defaultDuration === 15 ? ' class="active"' : ''}>10s</button>
                <button type="button" data-dur="30"${act.defaultDuration === 30 ? ' class="active"' : ''}>30s</button>
                <button type="button" data-dur="60"${act.defaultDuration === 60 ? ' class="active"' : ''}>60s</button>
              </div>
            </div>
            <div class="action-param-row">
              <label>🔥 Mức độ:</label>
              <div class="mini-pills card-int-pills">
                <button type="button" data-level="low" class="int-low${act.defaultIntensity === 'low' ? ' active' : ''}">🟢 Nhẹ</button>
                <button type="button" data-level="medium" class="int-med${act.defaultIntensity === 'medium' ? ' active' : ''}">🟡 Vừa</button>
                <button type="button" data-level="high" class="int-high${act.defaultIntensity === 'high' ? ' active' : ''}">🟠 Nặng</button>
                <button type="button" data-level="extreme" class="int-ext${act.defaultIntensity === 'extreme' ? ' active' : ''}">🔴 Cực Đại</button>
              </div>
            </div>
          </div>
        </div>

        <div class="action-result-box" style="display: none;"></div>

        <div class="action-card-footer">
          <span class="action-status-pill status-idle">SẴN SÀNG</span>
          <button type="button" class="btn-run-action-test" data-action="${escapeHtml(act.id)}">
            <span>▶️ Test Action</span>
          </button>
        </div>
      </div>
    `;
  }

  function bindActionCardEvents() {
    // Card duration pill click
    document.querySelectorAll('.action-test-card .card-dur-pills button').forEach((b) => {
      b.addEventListener('click', () => {
        b.parentElement.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
        b.classList.add('active');
      });
    });

    // Card intensity pill click
    document.querySelectorAll('.action-test-card .card-int-pills button').forEach((b) => {
      b.addEventListener('click', () => {
        b.parentElement.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
        b.classList.add('active');
      });
    });

    // Run test button click
    document.querySelectorAll('.btn-run-action-test').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const actionId = btn.getAttribute('data-action');
        const card = document.getElementById(`card-act-${actionId}`);
        if (!card) return;

        const durBtn = card.querySelector('.card-dur-pills button.active');
        const intBtn = card.querySelector('.card-int-pills button.active');
        const dur = durBtn ? parseInt(durBtn.getAttribute('data-dur'), 10) : 10;
        const intLevel = intBtn ? intBtn.getAttribute('data-level') : 'medium';

        await runSingleActionTest(actionId, dur, intLevel, card);
      });
    });
  }

  async function runSingleActionTest(actionId, durationSeconds, intensityLevel, cardEl) {
    const statusPill = cardEl.querySelector('.action-status-pill');
    const runBtn = cardEl.querySelector('.btn-run-action-test');
    const resBox = cardEl.querySelector('.action-result-box');

    cardEl.className = 'action-test-card is-running';
    if (statusPill) {
      statusPill.className = 'action-status-pill status-running';
      statusPill.textContent = `ĐANG CHẠY (${durationSeconds}s)...`;
    }
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Testing...';
    }

    const targetUrl = targetUrlInput ? targetUrlInput.value.trim() : DEFAULT_TARGET_URL;

    try {
      const res = await fetch('/api/actions/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionId,
          durationSeconds,
          intensityLevel,
          targetUrl,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Test action failed');
      }

      const outcome = data.result || {};
      const st = outcome.status || 'PASS';

      if (st === 'PASS') {
        cardEl.className = 'action-test-card is-passed';
        if (statusPill) {
          statusPill.className = 'action-status-pill status-pass';
          statusPill.textContent = '✅ ĐẠT (PASS)';
        }
        suiteStats.passed++;
      } else if (st === 'WARN') {
        cardEl.className = 'action-test-card is-warned';
        if (statusPill) {
          statusPill.className = 'action-status-pill status-warn';
          statusPill.textContent = '⚠️ CẢNH BÁO';
        }
        suiteStats.warned++;
      } else {
        cardEl.className = 'action-test-card is-failed';
        if (statusPill) {
          statusPill.className = 'action-status-pill status-fail';
          statusPill.textContent = '❌ THẤT BẠI';
        }
        suiteStats.failed++;
      }

      if (outcome.metrics?.requestsSent) {
        suiteStats.totalRequests += outcome.metrics.requestsSent;
      }
      updateSuiteStatsDisplay();

      if (resBox) {
        resBox.style.display = 'block';
        resBox.textContent = outcome.summary || 'Hoàn tất kiểm thử.';
      }
    } catch (err) {
      cardEl.className = 'action-test-card is-failed';
      if (statusPill) {
        statusPill.className = 'action-status-pill status-fail';
        statusPill.textContent = '❌ LỖI GỌI';
      }
      if (resBox) {
        resBox.style.display = 'block';
        resBox.textContent = 'Lỗi thực thi: ' + err.message;
      }
      suiteStats.failed++;
      updateSuiteStatsDisplay();
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = '▶️ Test Lại';
      }
    }
  }

  // Global Suite Runner (Runs all 17 actions sequentially)
  if (btnRunAllSuite) {
    btnRunAllSuite.addEventListener('click', async () => {
      if (isRunningFullSuite) return;
      if (!confirm(`Bắt đầu chạy tự động toàn bộ ${cachedActions.length || 17} Actions với thời gian mặc định ${globalSuiteDuration}s và mức độ ${globalSuiteIntensity.toUpperCase()}?`)) {
        return;
      }

      isRunningFullSuite = true;
      btnRunAllSuite.disabled = true;
      btnRunAllSuite.innerHTML = '<span>⏳ ĐANG CHẠY SUITE TOÀN DIỆN...</span>';

      suiteStats = { total: cachedActions.length || 17, passed: 0, warned: 0, failed: 0, totalRequests: 0 };
      updateSuiteStatsDisplay();

      for (let i = 0; i < cachedActions.length; i++) {
        const act = cachedActions[i];
        btnRunAllSuite.innerHTML = `<span>⏳ [${i + 1}/${cachedActions.length}] Đang test: ${escapeHtml(act.name)}...</span>`;

        const card = document.getElementById(`card-act-${act.id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const durBtn = card.querySelector('.card-dur-pills button.active');
          const intBtn = card.querySelector('.card-int-pills button.active');
          const dur = durBtn ? parseInt(durBtn.getAttribute('data-dur'), 10) : globalSuiteDuration;
          const intLevel = intBtn ? intBtn.getAttribute('data-level') : globalSuiteIntensity;

          await runSingleActionTest(act.id, dur, intLevel, card);
        }

        // Brief cooldown between tests
        await new Promise((r) => setTimeout(r, 1200));
      }

      isRunningFullSuite = false;
      btnRunAllSuite.disabled = false;
      btnRunAllSuite.innerHTML = '<span>⚡ CHẠY TỰ ĐỘNG TOÀN BỘ 17 ACTIONS</span>';

      alert(`🎉 HOÀN TẤT CHUỖI KIỂM THỬ TOÀN BỘ 17 ACTIONS!\n\n✅ Đạt (PASS): ${suiteStats.passed}\n⚠️ Cảnh báo (WARN): ${suiteStats.warned}\n❌ Thất bại (FAIL): ${suiteStats.failed}\n📊 Tổng Requests: ${suiteStats.totalRequests.toLocaleString()}`);
    });
  }

  // Load Actions on Startup & on Tab Click
  tabBtns.forEach((b) => {
    if (b.getAttribute('data-tab') === 'actions') {
      b.addEventListener('click', () => {
        if (cachedActions.length === 0) loadActionsCatalog();
      });
    }
  });

  loadActionsCatalog();

})();
