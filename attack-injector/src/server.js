const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const DEFAULT_TARGET_URL = process.env.TARGET_URL || 'http://ecommerce-store-service:8080';

// -------------------------------------------------------------
// In-Cluster Kubernetes API Client
// -------------------------------------------------------------
let k8sToken = null;
let k8sCa = null;

try {
  if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) {
    k8sToken = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
  }
  if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')) {
    k8sCa = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
  }
} catch (e) {
  console.warn('[K8s-Init] Running outside cluster or serviceaccount not mounted:', e.message);
}

function callK8sApi(method, pathUrl, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    if (!k8sToken) {
      return reject(new Error('K8s ServiceAccount token not available (not running inside Kubernetes cluster)'));
    }

    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = {
      Authorization: `Bearer ${k8sToken}`,
      Accept: 'application/json',
    };
    if (postData) {
      headers['Content-Type'] = contentType;
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'kubernetes.default.svc',
      port: 443,
      path: pathUrl,
      method: method.toUpperCase(),
      ca: k8sCa,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('K8s API request timeout'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Intensity Levels Configuration
// -------------------------------------------------------------
const INTENSITY_LEVELS = {
  low: {
    id: 'low',
    name: 'Mức Nhẹ (Low)',
    badge: '🟢 NHẸ',
    rps: 20,
    concurrency: 5,
    cpuComplexity: 50000,
    memoryMb: 10,
    latencyDelayMs: 500,
    checkoutQuantity: 1,
    faultRate: 0.25,
    description: 'Tải nhẹ nhàng, kiểm tra kết nối và tính đúng đắn của logic',
  },
  medium: {
    id: 'medium',
    name: 'Mức Vừa (Medium)',
    badge: '🟡 VỪA',
    rps: 65,
    concurrency: 12,
    cpuComplexity: 150000,
    memoryMb: 25,
    latencyDelayMs: 1500,
    checkoutQuantity: 3,
    faultRate: 0.55,
    description: 'Tải trung bình, mô phỏng lưu lượng người dùng giờ cao điểm',
  },
  high: {
    id: 'high',
    name: 'Mức Nặng (High)',
    badge: '🟠 NẶNG',
    rps: 140,
    concurrency: 25,
    cpuComplexity: 300000,
    memoryMb: 50,
    latencyDelayMs: 3000,
    checkoutQuantity: 8,
    faultRate: 0.8,
    description: 'Tải nặng, làm nghẽn hàng đợi và kích hoạt cảnh báo AI RCA',
  },
  extreme: {
    id: 'extreme',
    name: 'Mức Cực Đại (Extreme / Chaos)',
    badge: '🔴 CỰC ĐẠI',
    rps: 250,
    concurrency: 40,
    cpuComplexity: 600000,
    memoryMb: 100,
    latencyDelayMs: 5000,
    checkoutQuantity: 20,
    faultRate: 1.0,
    description: 'Tải tối đa, ép chạm ngưỡng giới hạn CPU/RAM và thử thách Self-Healing',
  },
};

// -------------------------------------------------------------
// Comprehensive Actions Catalog (17 Actions)
// -------------------------------------------------------------
const ACTIONS_CATALOG = [
  // --- Category 1: Chaos & Attack Vectors ---
  {
    id: 'HTTP_FLOOD',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'HTTP Flood (DDoS Traffic)',
    icon: '🌊',
    endpoint: '/api/products',
    method: 'GET',
    defaultDuration: 30,
    defaultIntensity: 'medium',
    description: 'Bắn hàng loạt request dồn dập vào danh mục sản phẩm, vắt kiệt băng thông mạng và tài nguyên CPU/RAM.',
    targetKind: 'Endpoint Web Store',
  },
  {
    id: 'CPU_BURNER',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Thiêu Đốt CPU (Heavy Query Search)',
    icon: '🔥',
    endpoint: '/api/search/heavy',
    method: 'GET',
    defaultDuration: 30,
    defaultIntensity: 'medium',
    description: 'Gửi truy vấn thuật toán phức tạp ép máy chủ tính toán số nguyên tố & căn bậc hai, đẩy CPU lên 85%-100%.',
    targetKind: 'Endpoint CPU Burn',
  },
  {
    id: 'LEGIT_ORDER_SURGE',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Bão Đặt Hàng Hợp Lệ (Scale Pod Testing - 0% Lỗi 5xx)',
    icon: '📦',
    endpoint: '/api/cart/checkout',
    method: 'POST',
    defaultDuration: 45,
    defaultIntensity: 'medium',
    description: 'Bơm hàng loạt đơn hàng đặt mua sản phẩm hợp lệ thành công 100% (HTTP 200/201), tăng vọt lưu lượng RPS và CPU để kiểm thử Auto-Scaling / Scale Pod mà KHÔNG gây ra bất kỳ lỗi 5xx nào.',
    targetKind: 'Legitimate Orders (Scale Pod Test)',
  },
  {
    id: 'FLASH_SALE',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Cơn Bão Đặt Hàng (Checkout Avalanche)',
    icon: '🛒',
    endpoint: '/api/cart/checkout',
    method: 'POST',
    defaultDuration: 30,
    defaultIntensity: 'medium',
    description: 'Tấn công đồng thời vào endpoint checkout, làm tràn hàng đợi xử lý đơn hàng và kích thích lỗi 503 Service Unavailable.',
    targetKind: 'Endpoint Checkout Order',
  },
  {
    id: 'MALFORMED_500',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Tiêm Payload Lỗi 500 (Exception Injection)',
    icon: '⚠️',
    endpoint: '/api/cart/checkout?fault=internal_error',
    method: 'POST',
    defaultDuration: 20,
    defaultIntensity: 'high',
    description: 'Gửi dữ liệu JSON độc hại và tham số lỗi nhằm kích hoạt ngoại lệ nghiêm trọng và ép tỷ lệ mã lỗi 500 tăng vọt.',
    targetKind: 'Fault Injection Endpoint',
  },
  {
    id: 'MEMORY_LEAK',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Bẫy Rò Rỉ Bộ Nhớ (RAM Leak Bomb / OOM)',
    icon: '🧠',
    endpoint: '/api/chaos/leak-memory',
    method: 'POST',
    defaultDuration: 30,
    defaultIntensity: 'medium',
    description: 'Bơm liên tục mảng buffer dung lượng lớn vào heap RAM để ép container chạm ngưỡng OOM và thử thách AI tự lành.',
    targetKind: 'Memory Exhaustion',
  },
  {
    id: 'SLOW_LATENCY',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Sóng Trễ Tê Liệt (High Latency Lag)',
    icon: '⏳',
    endpoint: '/api/chaos/latency',
    method: 'GET',
    defaultDuration: 25,
    defaultIntensity: 'medium',
    description: 'Chèn độ trễ phản hồi từ 500ms - 5000ms mô phỏng thắt cổ chai I/O, kích hoạt cảnh báo HIGH_LATENCY của GRU.',
    targetKind: 'Latency Paralysis',
  },
  {
    id: 'POD_CRASH',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Đột Tử Container (Container Crash Panic)',
    icon: '💥',
    endpoint: '/api/chaos/error?crash=true',
    method: 'POST',
    defaultDuration: 10,
    defaultIntensity: 'high',
    description: 'Gửi lệnh ép container thoát tiến trình (ExitCode 1), thử thách cơ chế tự hồi phục Restart Policy của Kubernetes.',
    targetKind: 'Process Crash',
  },
  {
    id: 'MIXED_CHAOS',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Thảm Họa Đa Lỗi (Full Spectrum Storm)',
    icon: '🌪️',
    endpoint: 'Đa Endpoint Phối Hợp',
    method: 'MIXED',
    defaultDuration: 45,
    defaultIntensity: 'high',
    description: 'Phối hợp ngẫu nhiên cả tính toán nặng, đặt hàng dồn dập, rò rỉ RAM và lỗi 500 để kiểm tra toàn diện Self-Healing.',
    targetKind: 'Multi-Vector Storm',
  },
  {
    id: 'FILL_DISK',
    category: 'chaos_attacks',
    categoryName: '1. Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)',
    name: 'Bão Rác Tràn Ổ Đĩa (Disk Saturation 88.5%)',
    icon: '💾',
    endpoint: '/api/chaos/fill-disk',
    method: 'POST',
    defaultDuration: 30,
    defaultIntensity: 'high',
    description: 'Giả lập tạo hàng loạt file rác trong thư mục /tmp và emptyDir, đẩy tỷ lệ ổ đĩa lên 88.5% kích hoạt cảnh báo DISK_SATURATION và kịch bản tự dọn dẹp CLEANUP_TEMP_FILES.',
    targetKind: 'Disk Storage Saturation',
  },

  // --- Category 2: Remediation & System Control ---
  {
    id: 'CLEANUP_TEMP_FILES',
    category: 'remediation_diagnostics',
    categoryName: '2. Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)',
    name: 'Dọn Dẹp Ổ Đĩa Tạm (Cleanup /tmp & emptyDir)',
    icon: '🧹',
    endpoint: '/api/chaos/reset-disk',
    method: 'POST',
    defaultDuration: 5,
    defaultIntensity: 'low',
    description: 'Dọn dẹp triệt để các file rác trong /tmp và thu hồi dung lượng ephemeral-storage, đưa đĩa về mức an toàn.',
    targetKind: 'Ephemeral Storage Cleanup',
  },
  {
    id: 'SINGLE_PROBE',
    category: 'remediation_diagnostics',
    categoryName: '2. Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)',
    name: 'Bắn Thử 1 Request (Single Health Probe)',
    icon: '🧪',
    endpoint: '/api/products',
    method: 'GET',
    defaultDuration: 5,
    defaultIntensity: 'low',
    description: 'Gửi 1 request đơn lẻ kiểm tra tức thời tính khả dụng và thời gian phản hồi (latency roundtrip) của hệ thống.',
    targetKind: 'Diagnostic Probe',
  },
  {
    id: 'VERIFY_TRAFFIC',
    category: 'remediation_diagnostics',
    categoryName: '2. Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)',
    name: 'Kiểm Thử Mẫu Lưu Lượng (Verify 10-50 Probes)',
    icon: '📊',
    endpoint: '/api/products',
    method: 'GET',
    defaultDuration: 10,
    defaultIntensity: 'medium',
    description: 'Bắn một chuỗi các request mẫu liên tục để đo tỷ lệ thành công 2xx, tỷ lệ lỗi 5xx và độ trễ trung bình chính xác.',
    targetKind: 'Traffic Sampling',
  },
  {
    id: 'RESET_RAM',
    category: 'remediation_diagnostics',
    categoryName: '2. Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)',
    name: 'Xả Sạch Bộ Nhớ Rò Rỉ (Reset Leaked RAM)',
    icon: '🧹',
    endpoint: '/api/chaos/release-memory',
    method: 'POST',
    defaultDuration: 5,
    defaultIntensity: 'low',
    description: 'Giải phóng toàn bộ buffer RAM đã bị rò rỉ trên Web Thương Mại mà không cần restart container.',
    targetKind: 'Memory Remediation',
  },
  {
    id: 'DB_FAILOVER',
    category: 'remediation_diagnostics',
    categoryName: '2. Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)',
    name: 'Chuyển Mạch CSDL Kép (Master / Replace DB)',
    icon: '🔀',
    endpoint: '/api/chaos/stepdown-master',
    method: 'POST',
    defaultDuration: 5,
    defaultIntensity: 'medium',
    description: 'Giả lập sự cố rớt Database Master và kích hoạt cơ chế chuyển đổi dự phòng tự động (Failover) sang Database Replace.',
    targetKind: 'Dual Database Failover',
  },

  // --- Category 3: Kubernetes Deployment Lifecycle ---
  {
    id: 'CLEAN_ROLLOUT',
    category: 'k8s_deployments',
    categoryName: '3. Thử Nghiệm Vòng Đời Triển Khai K8s (Deployment Lifecycle)',
    name: 'Triển Khai Bản Cập Nhật Thành Công (Clean Rollout)',
    icon: '🚀',
    endpoint: 'K8s Deployment Patch',
    method: 'PATCH',
    defaultDuration: 15,
    defaultIntensity: 'medium',
    description: 'Nâng cấp phiên bản lên v1.2.0-stable. Pods mới khởi tạo khỏe mạnh 100%, probes vượt qua, zero-downtime.',
    targetKind: 'K8s Rollout v1.2.0-stable',
  },
  {
    id: 'DEPLOY_5XX_REGRESSION',
    category: 'k8s_deployments',
    categoryName: '3. Thử Nghiệm Vòng Đời Triển Khai K8s (Deployment Lifecycle)',
    name: 'Lỗi Hồi Quy Logic Nghiệp Vụ (5xx Regression)',
    icon: '⚠️',
    endpoint: 'K8s Deployment Patch',
    method: 'PATCH',
    defaultDuration: 20,
    defaultIntensity: 'high',
    description: 'Triển khai bản v1.2.1-faulty. Pods vẫn Running nhưng tất cả request nghiệp vụ sinh mã lỗi 500, kích hoạt AI đề xuất ROLLBACK.',
    targetKind: 'K8s Rollout v1.2.1-faulty',
  },
  {
    id: 'DEPLOY_CRASHLOOP',
    category: 'k8s_deployments',
    categoryName: '3. Thử Nghiệm Vòng Đời Triển Khai K8s (Deployment Lifecycle)',
    name: 'Sập Khởi Động Tiến Trình (CrashLoopBackOff)',
    icon: '💥',
    endpoint: 'K8s Deployment Patch',
    method: 'PATCH',
    defaultDuration: 25,
    defaultIntensity: 'high',
    description: 'Triển khai phiên bản có lỗi nghiêm trọng khi nạp. Container chết liên tục sau 1.2s với ExitCode 1, Pod rơi vào CrashLoopBackOff.',
    targetKind: 'K8s Rollout v1.2.2-crash',
  },
  {
    id: 'DEPLOY_BAD_IMAGE',
    category: 'k8s_deployments',
    categoryName: '3. Thử Nghiệm Vòng Đời Triển Khai K8s (Deployment Lifecycle)',
    name: 'Tag Image Không Tồn Tại (ImagePullBackOff)',
    icon: '🛑',
    endpoint: 'K8s Deployment Patch',
    method: 'PATCH',
    defaultDuration: 20,
    defaultIntensity: 'medium',
    description: 'Cập nhật deployment trỏ tới tag không tồn tại. Kubelet kẹt tại ImagePullBackOff, ReplicaSet cũ giữ nguyên bảo vệ dịch vụ.',
    targetKind: 'K8s Rollout v9.9.9-corrupted',
  },
  {
    id: 'ROLLBACK_DEPLOYMENT',
    category: 'k8s_deployments',
    categoryName: '3. Thử Nghiệm Vòng Đời Triển Khai K8s (Deployment Lifecycle)',
    name: 'Hoàn Nguyên Về Phiên Bản Chuẩn (Safe Rollback)',
    icon: '🔄',
    endpoint: 'K8s Deployment Patch',
    method: 'PATCH',
    defaultDuration: 15,
    defaultIntensity: 'low',
    description: 'Hoàn nguyên deployment về phiên bản chuẩn an toàn v1.0.0-stable, xóa sạch cờ giả lập lỗi, khôi phục 100% sức khỏe.',
    targetKind: 'K8s Rollout v1.0.0-stable',
  },
];

// -------------------------------------------------------------
// Attack Engine State
// -------------------------------------------------------------
let activeAttackInterval = null;
let attackTickerInterval = null;
let isAttacking = false;

const attackStats = {
  isAttacking: false,
  attackId: null,
  attackName: 'Chưa phát động tấn công',
  targetUrl: DEFAULT_TARGET_URL,
  attackType: 'http_flood',
  durationSeconds: 30,
  elapsedSeconds: 0,
  remainingSeconds: 0,
  concurrency: 10,
  targetRps: 50,
  intensityLevel: 'medium',
  rampMode: 'gradual',

  // Realtime Counters
  requestsSent: 0,
  success2xx: 0,
  errors5xx: 0,
  errors4xx: 0,
  networkErrors: 0,
  latencies: [],
  avgLatencyMs: 0,
  currentRps: 0,
};

const attackLogs = [];
const attackHistory = [];

function logAttackEvent(statusCode, latencyMs, endpoint, method = 'GET') {
  const log = {
    id: Date.now() + Math.random().toString(36).substring(2, 5),
    time: new Date().toLocaleTimeString('vi-VN'),
    statusCode,
    latencyMs,
    endpoint,
    method,
  };
  attackLogs.unshift(log);
  if (attackLogs.length > 60) attackLogs.pop();
}

// -------------------------------------------------------------
// High-Concurrency HTTP Request Dispatcher
// -------------------------------------------------------------
async function sendAttackProbe(targetBase, attackType, intensityLevel = 'medium') {
  const start = Date.now();
  let pathUrl = '/api/products';
  let method = 'GET';
  let postBody = null;

  const cfg = INTENSITY_LEVELS[intensityLevel] || INTENSITY_LEVELS.medium;

  switch (attackType) {
    case 'resource_exhaustion':
    case 'CPU_BURNER':
      pathUrl = `/api/search/heavy?complexity=${cfg.cpuComplexity}&q=server`;
      break;

    case 'memory_exhaustion':
    case 'MEMORY_LEAK':
      pathUrl = '/api/chaos/leak-memory';
      method = 'POST';
      postBody = JSON.stringify({ sizeMb: cfg.memoryMb });
      break;

    case 'slow_loris_latency':
    case 'SLOW_LATENCY':
      pathUrl = `/api/chaos/latency?delay=${cfg.latencyDelayMs}`;
      break;

    case 'pod_crash_panic':
    case 'POD_CRASH':
      pathUrl = '/api/chaos/error?crash=true';
      method = 'POST';
      postBody = JSON.stringify({ crash: true });
      break;

    case 'legit_order_surge':
    case 'LEGIT_ORDER_SURGE':
      pathUrl = '/api/cart/checkout';
      method = 'POST';
      postBody = JSON.stringify({
        customerName: `ScaleTester-${Math.floor(Math.random() * 10000)}`,
        customerEmail: `scaletest${Math.floor(Math.random() * 10000)}@enterprise.vn`,
        customerPhone: '0988776655',
        paymentMethod: 'CREDIT_CARD',
        items: [{ productId: 'prod-005', quantity: 1 }],
      });
      break;

    case 'flash_sale_surge':
    case 'FLASH_SALE':
      pathUrl = '/api/cart/checkout';
      method = 'POST';
      postBody = JSON.stringify({
        customerName: `Bot-Buyer-${Math.floor(Math.random() * 1000)}`,
        customerEmail: `bot${Math.floor(Math.random() * 1000)}@chaos-attack.io`,
        items: [{ productId: 'prod-001', quantity: cfg.checkoutQuantity }],
      });
      break;

    case 'malformed_injection':
    case 'MALFORMED_500':
      if (Math.random() < cfg.faultRate) {
        pathUrl = '/api/cart/checkout?fault=internal_error';
        method = 'POST';
        postBody = JSON.stringify({
          customerName: 'AttackBot-Exploit',
          trigger500: true,
          items: [{ productId: 'crash_system', quantity: 99999 }],
        });
      } else {
        pathUrl = '/api/cart/checkout';
        method = 'POST';
        postBody = '{"customerName": "Corrupted_Payload", "items": [{"invalid_field": null}';
      }
      break;

    case 'mixed_chaos':
    case 'MIXED_CHAOS':
      const rand = Math.random();
      if (rand < 0.35) {
        pathUrl = `/api/search/heavy?complexity=${cfg.cpuComplexity}&q=server`;
      } else if (rand < 0.65) {
        pathUrl = '/api/cart/checkout';
        method = 'POST';
        postBody = JSON.stringify({
          customerName: 'Chaos-Mixed',
          items: [{ productId: 'prod-002', quantity: cfg.checkoutQuantity }],
        });
      } else if (rand < 0.85) {
        pathUrl = '/api/chaos/leak-memory';
        method = 'POST';
        postBody = JSON.stringify({ sizeMb: cfg.memoryMb });
      } else {
        pathUrl = '/api/products';
      }
      break;

    case 'http_flood':
    case 'HTTP_FLOOD':
    default:
      pathUrl = '/api/products';
      break;
  }

  const fullUrl = `${targetBase.replace(/\/+$/, '')}${pathUrl}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SelfHeal-Chaos-Attack-Bot/3.0',
      },
      body: postBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const duration = Date.now() - start;
    attackStats.requestsSent++;
    attackStats.latencies.push(duration);
    if (attackStats.latencies.length > 100) attackStats.latencies.shift();
    attackStats.avgLatencyMs = Math.round(
      attackStats.latencies.reduce((a, b) => a + b, 0) / attackStats.latencies.length
    );

    if (res.status >= 200 && res.status < 400) {
      attackStats.success2xx++;
    } else if (res.status >= 500) {
      attackStats.errors5xx++;
    } else {
      attackStats.errors4xx++;
    }

    logAttackEvent(res.status, duration, pathUrl, method);
    return { status: res.status, duration, endpoint: pathUrl };
  } catch (err) {
    const duration = Date.now() - start;
    attackStats.requestsSent++;
    attackStats.networkErrors++;
    logAttackEvent(0, duration, `${pathUrl} (${err.name === 'AbortError' ? 'TIMEOUT' : 'FAIL'})`, method);
    return { status: 0, error: err.message, duration, endpoint: pathUrl };
  }
}

// -------------------------------------------------------------
// Attack Dispatch Worker
// -------------------------------------------------------------
function startAttackWorker() {
  if (activeAttackInterval) clearInterval(activeAttackInterval);

  activeAttackInterval = setInterval(() => {
    if (!attackStats.isAttacking) return;

    let factor = 1.0;
    const elapsed = attackStats.elapsedSeconds;
    const dur = attackStats.durationSeconds;

    if (attackStats.rampMode === 'instant') {
      factor = 1.0;
    } else if (attackStats.rampMode === 'fast') {
      factor = Math.min(1.0, elapsed / 10.0);
    } else if (attackStats.rampMode === 'slow') {
      factor = Math.min(1.0, elapsed / 60.0);
    } else if (attackStats.rampMode === 'wave') {
      factor = 0.3 + 0.7 * Math.abs(Math.sin((elapsed * Math.PI) / 12.0));
    } else {
      factor = Math.min(1.0, elapsed / dur);
    }

    const currentRps = Math.max(2, Math.round(attackStats.targetRps * factor));
    attackStats.currentRps = currentRps;

    const batchSize = Math.ceil(currentRps / 4);
    for (let i = 0; i < batchSize; i++) {
      sendAttackProbe(attackStats.targetUrl, attackStats.attackType, attackStats.intensityLevel);
    }
  }, 250);
}

function startMasterTicker() {
  if (attackTickerInterval) clearInterval(attackTickerInterval);
  attackTickerInterval = setInterval(() => {
    if (!attackStats.isAttacking) return;

    attackStats.elapsedSeconds += 1;
    attackStats.remainingSeconds = Math.max(0, attackStats.durationSeconds - attackStats.elapsedSeconds);

    if (attackStats.elapsedSeconds >= attackStats.durationSeconds) {
      stopAttack('COMPLETED');
    }
  }, 1000);
}

function stopAttack(reason = 'STOPPED') {
  if (!attackStats.isAttacking) return;

  const record = {
    attackId: attackStats.attackId,
    attackName: attackStats.attackName,
    targetUrl: attackStats.targetUrl,
    attackType: attackStats.attackType,
    intensityLevel: attackStats.intensityLevel,
    durationSeconds: attackStats.durationSeconds,
    actualRunSeconds: attackStats.elapsedSeconds,
    totalRequests: attackStats.requestsSent,
    success2xx: attackStats.success2xx,
    errors5xx: attackStats.errors5xx,
    errors4xx: attackStats.errors4xx,
    networkErrors: attackStats.networkErrors,
    avgLatencyMs: attackStats.avgLatencyMs,
    reason,
    endedAt: new Date().toISOString(),
  };

  attackHistory.unshift(record);
  if (attackHistory.length > 50) attackHistory.pop();

  attackStats.isAttacking = false;
  attackStats.attackName = 'Đã dừng tấn công';
  attackStats.currentRps = 0;

  if (activeAttackInterval) {
    clearInterval(activeAttackInterval);
    activeAttackInterval = null;
  }

  console.log(`[AttackEngine] Attack finished (${reason}): ${record.attackId}`);
}

startMasterTicker();

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// 1. Health check for Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'chaos-attack-injector',
    timestamp: new Date().toISOString(),
    isAttacking: attackStats.isAttacking,
  });
});

// 2. Realtime Attack Status & Telemetry
app.get('/api/attack/status', (req, res) => {
  res.status(200).json({
    success: true,
    stats: attackStats,
    recentLogs: attackLogs.slice(0, 30),
    historyCount: attackHistory.length,
  });
});

// 3. Launch Attack with Duration & Intensity Level
app.post('/api/attack/start', (req, res) => {
  const body = req.body || {};
  const targetUrl = body.targetUrl || DEFAULT_TARGET_URL;
  const attackType = body.attackType || 'http_flood';
  const intensityLevel = body.intensityLevel && INTENSITY_LEVELS[body.intensityLevel] ? body.intensityLevel : 'medium';
  const cfg = INTENSITY_LEVELS[intensityLevel];

  const durationSeconds = Math.min(Math.max(parseInt(body.durationSeconds, 10) || 30, 5), 600);
  const targetRps = body.targetRps ? Math.min(Math.max(parseInt(body.targetRps, 10), 5), 450) : cfg.rps;
  const concurrency = body.concurrency ? Math.min(Math.max(parseInt(body.concurrency, 10), 1), 50) : cfg.concurrency;
  const rampMode = body.rampMode || 'gradual';
  const attackName = body.attackName || `Tấn công ${attackType} (${cfg.name})`;

  if (attackStats.isAttacking) {
    stopAttack('REPLACED');
  }

  const attackId = `atk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  attackStats.isAttacking = true;
  attackStats.attackId = attackId;
  attackStats.attackName = attackName;
  attackStats.targetUrl = targetUrl;
  attackStats.attackType = attackType;
  attackStats.intensityLevel = intensityLevel;
  attackStats.durationSeconds = durationSeconds;
  attackStats.elapsedSeconds = 0;
  attackStats.remainingSeconds = durationSeconds;
  attackStats.concurrency = concurrency;
  attackStats.targetRps = targetRps;
  attackStats.rampMode = rampMode;

  attackStats.requestsSent = 0;
  attackStats.success2xx = 0;
  attackStats.errors5xx = 0;
  attackStats.errors4xx = 0;
  attackStats.networkErrors = 0;
  attackStats.latencies = [];
  attackStats.avgLatencyMs = 0;
  attackStats.currentRps = 0;

  startAttackWorker();

  console.log(`[AttackEngine] Launched ${attackName} on ${targetUrl} (RPS: ${targetRps}, Duration: ${durationSeconds}s, Level: ${intensityLevel})`);

  res.status(200).json({
    success: true,
    message: `Đã phát động cuộc tấn công: ${attackName}`,
    attackId,
    targetUrl,
    attackType,
    intensityLevel,
    durationSeconds,
    targetRps,
  });
});

// 4. Halt Attack Immediately
app.post('/api/attack/stop', (req, res) => {
  stopAttack('MANUAL_STOP');
  res.status(200).json({
    success: true,
    message: 'ĐÃ DỪNG TẤN CÔNG NGAY LẬP TỨC!',
    stats: attackStats,
  });
});

// 5. Test Single Probe Request
app.post('/api/attack/probe', async (req, res) => {
  const target = req.body?.targetUrl || attackStats.targetUrl || DEFAULT_TARGET_URL;
  const attackType = req.body?.attackType || 'http_flood';
  const intensity = req.body?.intensityLevel || 'medium';
  const result = await sendAttackProbe(target, attackType, intensity);
  res.status(200).json({
    success: true,
    probeResult: result,
    target,
  });
});

// 6. Attack History
app.get('/api/attack/history', (req, res) => {
  res.status(200).json({
    success: true,
    history: attackHistory,
  });
});

// 7. Export Attack Audit Report
app.get('/api/attack/export', (req, res) => {
  const format = req.query.format || 'json';
  if (format === 'csv') {
    const headers = [
      'attackId',
      'attackName',
      'attackType',
      'intensityLevel',
      'targetUrl',
      'durationSeconds',
      'actualRunSeconds',
      'totalRequests',
      'success2xx',
      'errors5xx',
      'avgLatencyMs',
      'endedAt',
    ];
    const rows = attackHistory.map((h) => [
      h.attackId,
      `"${(h.attackName || '').replace(/"/g, '""')}"`,
      h.attackType,
      h.intensityLevel || 'medium',
      h.targetUrl,
      h.durationSeconds,
      h.actualRunSeconds,
      h.totalRequests,
      h.success2xx,
      h.errors5xx,
      h.avgLatencyMs,
      `"${h.endedAt}"`,
    ].join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attack-audit-report.csv"');
    return res.send([headers.join(','), ...rows].join('\n'));
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="attack-audit-report.json"');
  res.send(JSON.stringify(attackHistory, null, 2));
});

// 8. Reset Target Leaked Memory
app.post('/api/attack/reset-target', async (req, res) => {
  const target = req.body?.targetUrl || attackStats.targetUrl || DEFAULT_TARGET_URL;
  try {
    const response = await fetch(`${target.replace(/\/+$/, '')}/api/chaos/release-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    res.status(200).json({ success: true, message: 'Đã giải phóng bộ nhớ target thành công!', data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Clean All Test Data, Reset Stats & Clear Target Orders
app.post('/api/attack/clean-all', async (req, res) => {
  const target = req.body?.targetUrl || attackStats.targetUrl || DEFAULT_TARGET_URL;
  try {
    // 1. Stop any ongoing attack immediately
    stopAttack('MANUAL_CLEAN');

    // 2. Reset all attackStats in-memory
    attackStats.isAttacking = false;
    attackStats.attackId = null;
    attackStats.attackName = 'Chưa phát động tấn công';
    attackStats.durationSeconds = 0;
    attackStats.elapsedSeconds = 0;
    attackStats.remainingSeconds = 0;
    attackStats.requestsSent = 0;
    attackStats.success2xx = 0;
    attackStats.errors5xx = 0;
    attackStats.errors4xx = 0;
    attackStats.networkErrors = 0;
    attackStats.latencies = [];
    attackStats.avgLatencyMs = 0;
    attackStats.currentRps = 0;
    attackHistory.length = 0;

    // 3. Call target to reset all chaos and delete test orders in Mongo
    let targetResult = null;
    try {
      const response = await fetch(`${target.replace(/\/+$/, '')}/api/chaos/reset-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      targetResult = await response.json();
    } catch (targetErr) {
      console.warn('[Clean-All] Target reset notice:', targetErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'ĐÃ DỌN DẸP SẠCH TOÀN BỘ DỮ LIỆU CŨ VÀ RESET SỐ ĐO VỀ 0!',
      stats: attackStats,
      targetResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// NEW: Actions Catalog & Dedicated Action Testing Engine
// -------------------------------------------------------------

// 9. Get Actions Catalog & Intensity Levels
app.get('/api/actions/catalog', (req, res) => {
  res.status(200).json({
    success: true,
    totalActions: ACTIONS_CATALOG.length,
    intensityLevels: INTENSITY_LEVELS,
    catalog: ACTIONS_CATALOG,
  });
});

// 10. Run Single Action Test with Customizable Duration & Intensity
app.post('/api/actions/run', async (req, res) => {
  const { action, durationSeconds = 10, intensityLevel = 'medium', targetUrl = DEFAULT_TARGET_URL } = req.body || {};
  const dur = Math.min(Math.max(parseInt(durationSeconds, 10) || 10, 2), 120);
  const intensity = INTENSITY_LEVELS[intensityLevel] ? intensityLevel : 'medium';
  const cfg = INTENSITY_LEVELS[intensity];

  const matchedAction = ACTIONS_CATALOG.find((a) => a.id === action || a.id.toLowerCase() === (action || '').toLowerCase());
  if (!matchedAction) {
    return res.status(400).json({ success: false, error: `Action '${action}' không tồn tại trong danh mục!` });
  }

  const startTime = Date.now();
  console.log(`[ActionRunner] Starting test for ${matchedAction.name} (Duration: ${dur}s, Intensity: ${intensity})...`);

  // A. Remediation / System Actions
  if (matchedAction.id === 'FILL_DISK') {
    try {
      const resp = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/chaos/fill-disk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diskPercent: 88.5 }),
      });
      const data = await resp.json();
      return res.status(200).json({
        success: true,
        action: matchedAction.id,
        actionName: matchedAction.name,
        durationSeconds: dur,
        intensityLevel: intensity,
        result: {
          status: 'PASS',
          summary: data.message || `Đã giả lập ổ đĩa đầy 88.5% và tạo file rác trong /tmp.`,
          metrics: { diskPercent: data.simulatedDiskPercent || 88.5 },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (matchedAction.id === 'CLEANUP_TEMP_FILES') {
    try {
      const resp = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/chaos/reset-disk`, { method: 'POST' });
      const data = await resp.json();
      return res.status(200).json({
        success: true,
        action: matchedAction.id,
        actionName: matchedAction.name,
        durationSeconds: dur,
        intensityLevel: intensity,
        result: {
          status: 'PASS',
          summary: data.message || 'Đã dọn dẹp file rác trong /tmp thành công!',
          metrics: { diskPercent: data.simulatedDiskPercent || 12.0 },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (matchedAction.id === 'RESET_RAM') {
    try {
      const resp = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/chaos/release-memory`, { method: 'POST' });
      const data = await resp.json();
      return res.status(200).json({
        success: true,
        action: matchedAction.id,
        actionName: matchedAction.name,
        durationSeconds: dur,
        intensityLevel: intensity,
        result: {
          status: 'PASS',
          summary: `Đã xả sạch ${data.releasedMb || 0} MB bộ nhớ rò rỉ trên Web Thương Mại.`,
          metrics: { releasedMb: data.releasedMb || 0, currentLeakedMb: 0 },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (matchedAction.id === 'DB_FAILOVER') {
    try {
      const resp = await fetch(`${targetUrl.replace(/\/+$/, '')}/api/chaos/stepdown-master`, { method: 'POST' });
      const data = await resp.json();
      return res.status(200).json({
        success: true,
        action: matchedAction.id,
        actionName: matchedAction.name,
        durationSeconds: dur,
        intensityLevel: intensity,
        result: {
          status: 'PASS',
          summary: data.message || 'Chuyển mạch CSDL kép thành công!',
          metrics: { activeDatabase: data.activeDatabase, isMasterOnline: data.isMasterOnline },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (matchedAction.id === 'SINGLE_PROBE') {
    const probe = await sendAttackProbe(targetUrl, 'http_flood', intensity);
    const isOk = probe.status >= 200 && probe.status < 400;
    return res.status(200).json({
      success: true,
      action: matchedAction.id,
      actionName: matchedAction.name,
      durationSeconds: dur,
      intensityLevel: intensity,
      result: {
        status: isOk ? 'PASS' : 'WARN',
        summary: isOk ? `Probe thành công (HTTP ${probe.status}, ${probe.duration}ms)` : `Probe trả về mã lỗi hoặc timeout: ${probe.error || probe.status}`,
        metrics: { httpStatus: probe.status, latencyMs: probe.duration },
      },
    });
  }

  if (matchedAction.id === 'VERIFY_TRAFFIC') {
    const probeCount = Math.min(cfg.rps, 30);
    let s200 = 0;
    let s500 = 0;
    let other = 0;
    let totalLat = 0;

    for (let i = 0; i < probeCount; i++) {
      const p = await sendAttackProbe(targetUrl, 'http_flood', intensity);
      totalLat += p.duration || 0;
      if (p.status >= 200 && p.status < 400) s200++;
      else if (p.status >= 500) s500++;
      else other++;
    }

    const avgLat = Math.round(totalLat / probeCount);
    const errRate = Math.round((s500 / probeCount) * 100);
    const status = errRate === 0 && s200 > 0 ? 'PASS' : errRate > 50 ? 'FAIL' : 'WARN';

    return res.status(200).json({
      success: true,
      action: matchedAction.id,
      actionName: matchedAction.name,
      durationSeconds: dur,
      intensityLevel: intensity,
      result: {
        status,
        summary: `Kiểm tra ${probeCount} probes: ${s200} OK, ${s500} Lỗi 5xx (${errRate}%), Độ trễ TB ${avgLat}ms`,
        metrics: { totalProbes: probeCount, status200: s200, status500: s500, otherFails: other, avgLatencyMs: avgLat, error5xxRate: errRate },
      },
    });
  }

  // B. Kubernetes Deployment Actions
  if (matchedAction.category === 'k8s_deployments') {
    let k8sAction = 'CLEAN_ROLLOUT';
    if (matchedAction.id === 'DEPLOY_5XX_REGRESSION') k8sAction = 'DEPLOY_5XX_REGRESSION';
    if (matchedAction.id === 'DEPLOY_CRASHLOOP') k8sAction = 'DEPLOY_CRASHLOOP';
    if (matchedAction.id === 'DEPLOY_BAD_IMAGE') k8sAction = 'DEPLOY_BAD_IMAGE';
    if (matchedAction.id === 'ROLLBACK_DEPLOYMENT') k8sAction = 'ROLLBACK_DEPLOYMENT';

    // Execute Deployment Action
    try {
      const actRes = await executeDeploymentPatch(k8sAction);
      // Wait sample time
      await new Promise((r) => setTimeout(r, Math.min(dur * 1000, 4000)));

      // Verify traffic after rollout
      const traffic = await testTrafficSamples(targetUrl, 10);
      return res.status(200).json({
        success: true,
        action: matchedAction.id,
        actionName: matchedAction.name,
        durationSeconds: dur,
        intensityLevel: intensity,
        result: {
          status: 'PASS',
          summary: `${actRes.actionTitle}. Lưu lượng mẫu: ${traffic.status200}/10 200 OK (${traffic.error5xxRate}% 5xx).`,
          metrics: { k8sStatus: actRes.k8sStatus, ...traffic },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // C. Chaos & Attack Actions (Time & Intensity Bound Loop)
  let requestsSent = 0;
  let success2xx = 0;
  let errors5xx = 0;
  let latencies = [];

  const intervalMs = Math.max(50, Math.floor(1000 / cfg.rps));
  const endTime = startTime + dur * 1000;

  await new Promise((resolve) => {
    const loopInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(loopInterval);
        return resolve();
      }

      const p = await sendAttackProbe(targetUrl, matchedAction.id, intensity);
      requestsSent++;
      if (p.duration) latencies.push(p.duration);
      if (p.status >= 200 && p.status < 400) success2xx++;
      else if (p.status >= 500) errors5xx++;
    }, intervalMs);
  });

  const avgLat = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const actualRps = Math.round((requestsSent / dur) * 10) / 10;
  const errRate = requestsSent > 0 ? Math.round((errors5xx / requestsSent) * 100) : 0;

  // Evaluate Pass / Warn / Fail
  let testStatus = 'PASS';
  if (matchedAction.id === 'MALFORMED_500' || matchedAction.id === 'POD_CRASH') {
    // For intentional fault injection, generating errors or crashes is considered SUCCESSFUL test execution
    testStatus = 'PASS';
  } else if (errRate > 50) {
    testStatus = 'WARN';
  }

  return res.status(200).json({
    success: true,
    action: matchedAction.id,
    actionName: matchedAction.name,
    durationSeconds: dur,
    intensityLevel: intensity,
    result: {
      status: testStatus,
      summary: `Đã hoàn tất test [${cfg.name}] trong ${dur}s: ${requestsSent} requests, ${actualRps} RPS, ${errors5xx} lỗi 5xx (${errRate}%), Độ trễ TB ${avgLat}ms.`,
      metrics: {
        requestsSent,
        actualRps,
        success2xx,
        errors5xx,
        error5xxRate: errRate,
        avgLatencyMs: avgLat,
      },
    },
  });
});

async function testTrafficSamples(targetUrl, count = 10) {
  let s200 = 0;
  let s500 = 0;
  let other = 0;
  for (let i = 0; i < count; i++) {
    try {
      const resp = await fetch(`${targetUrl}/api/products`, { signal: AbortSignal.timeout(2000) });
      if (resp.status === 200) s200++;
      else if (resp.status >= 500) s500++;
      else other++;
    } catch (e) {
      other++;
    }
  }
  return {
    totalProbes: count,
    status200: s200,
    status500: s500,
    otherFails: other,
    error5xxRate: Math.round((s500 / count) * 100),
    isHealthy: s500 === 0 && s200 > 0,
  };
}

// -------------------------------------------------------------
// Deployment & Rollout Lab APIs (Kubernetes In-Cluster Management)
// -------------------------------------------------------------

// 11. Get Live Deployment Status & K8s Events
app.get('/api/deployment/status', async (req, res) => {
  try {
    const depRes = await callK8sApi('GET', '/apis/apps/v1/namespaces/test-lab/deployments/ecommerce-store-app');
    const depData = depRes.data || {};

    const podsRes = await callK8sApi('GET', '/api/v1/namespaces/test-lab/pods?labelSelector=app=ecommerce-store-app');
    const podItems = (podsRes.data?.items || []).map((p) => {
      const cStatus = p.status?.containerStatuses?.[0] || {};
      const stateObj = cStatus.state || {};
      let stateReason = 'Running';
      if (stateObj.waiting) {
        stateReason = stateObj.waiting.reason || 'Waiting';
      } else if (stateObj.terminated) {
        stateReason = stateObj.terminated.reason || `Terminated (${stateObj.terminated.exitCode})`;
      } else if (!cStatus.ready) {
        stateReason = 'NotReady';
      }

      return {
        name: p.metadata.name,
        phase: p.status.phase,
        ready: !!cStatus.ready,
        restartCount: cStatus.restartCount || 0,
        image: cStatus.image || p.spec.containers[0]?.image,
        stateReason,
        startTime: p.status.startTime,
        podIP: p.status.podIP,
      };
    });

    const eventsRes = await callK8sApi('GET', '/api/v1/namespaces/test-lab/events');
    const rawEvents = eventsRes.data?.items || [];
    const relevantEvents = rawEvents
      .filter((ev) => {
        const objName = ev.involvedObject?.name || '';
        return objName.includes('ecommerce-store') || objName.includes('attack-injector');
      })
      .map((ev) => ({
        type: ev.type,
        reason: ev.reason,
        message: ev.message,
        object: `${ev.involvedObject.kind}/${ev.involvedObject.name}`,
        count: ev.count || 1,
        lastTimestamp: ev.lastTimestamp || ev.eventTime || ev.metadata?.creationTimestamp,
      }))
      .sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0))
      .slice(0, 15);

    let appProbe = { status: 'UNKNOWN' };
    try {
      const probeRes = await fetch(`${DEFAULT_TARGET_URL}/health`, { signal: AbortSignal.timeout(2500) });
      const probeJson = await probeRes.json();
      appProbe = {
        httpStatus: probeRes.status,
        status: probeRes.ok ? 'UP' : 'DOWN',
        version: probeJson.version || 'v1.0.0',
        metrics: probeJson.metrics || null,
      };
    } catch (e) {
      appProbe = { status: 'UNREACHABLE', error: e.message };
    }

    const containerSpec = depData?.spec?.template?.spec?.containers?.[0] || {};
    const versionAnnotation = depData?.spec?.template?.metadata?.annotations?.['app.kubernetes.io/version'] || 'v1.0.0';

    return res.status(200).json({
      success: true,
      deployment: {
        name: depData?.metadata?.name || 'ecommerce-store-app',
        namespace: depData?.metadata?.namespace || 'test-lab',
        generation: depData?.metadata?.generation,
        observedGeneration: depData?.status?.observedGeneration,
        replicas: {
          desired: depData?.spec?.replicas || 0,
          ready: depData?.status?.readyReplicas || 0,
          available: depData?.status?.availableReplicas || 0,
          updated: depData?.status?.updatedReplicas || 0,
        },
        image: containerSpec.image,
        version: versionAnnotation,
        env: containerSpec.env || [],
        strategy: depData?.spec?.strategy?.type || 'RollingUpdate',
      },
      pods: podItems,
      events: relevantEvents,
      appProbe,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function executeDeploymentPatch(action) {
  let patchBody = null;
  let actionTitle = '';
  let description = '';
  const nowIso = new Date().toISOString();

  switch (action) {
    case 'CLEAN_ROLLOUT':
      actionTitle = 'Triển Khai Bản Cập Nhật Thành Công (Clean Rollout v1.2.0-stable)';
      description = 'Đã nâng cấp phiên bản lên v1.2.0-stable. Các Pod mới tạo ra khỏe mạnh 100%, probes vượt qua, zero downtime.';
      patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'app.kubernetes.io/version': 'v1.2.0-stable',
                'kubectl.kubernetes.io/restartedAt': nowIso,
              },
            },
            spec: {
              containers: [
                {
                  name: 'store-server',
                  image: 'selfheal-ecommerce-store:1.0.0',
                  env: [
                    { name: 'APP_VERSION', value: 'v1.2.0-stable' },
                    { name: 'SIMULATE_5XX_REGRESSION', value: 'false' },
                    { name: 'SIMULATE_FATAL_CRASH', value: 'false' },
                    { name: 'SIMULATE_LIVENESS_FAIL', value: 'false' },
                  ],
                },
              ],
            },
          },
        },
      };
      break;

    case 'DEPLOY_5XX_REGRESSION':
      actionTitle = 'Triển Khai Bản Lỗi Logic 500 (5xx Regression v1.2.1-faulty)';
      description = 'Đã triển khai bản cập nhật v1.2.1-faulty. Pods vẫn Running nhưng tất cả request nghiệp vụ sinh mã lỗi HTTP 500, kích hoạt AI RCA deployment_failure và đề xuất ROLLBACK_DEPLOYMENT.';
      patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'app.kubernetes.io/version': 'v1.2.1-faulty',
                'kubectl.kubernetes.io/restartedAt': nowIso,
              },
            },
            spec: {
              containers: [
                {
                  name: 'store-server',
                  image: 'selfheal-ecommerce-store:1.0.0',
                  env: [
                    { name: 'APP_VERSION', value: 'v1.2.1-faulty' },
                    { name: 'SIMULATE_5XX_REGRESSION', value: 'true' },
                    { name: 'SIMULATE_FATAL_CRASH', value: 'false' },
                    { name: 'SIMULATE_LIVENESS_FAIL', value: 'false' },
                  ],
                },
              ],
            },
          },
        },
      };
      break;

    case 'DEPLOY_CRASHLOOP':
      actionTitle = 'Triển Khai Bản Sập Khởi Động (CrashLoopBackOff v1.2.2-crash)';
      description = 'Đã triển khai phiên bản bị lỗi cấu hình hoặc exception ngay khi nạp. Container chết liên tục sau 1.2s với ExitCode 1, Pod rơi vào CrashLoopBackOff.';
      patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'app.kubernetes.io/version': 'v1.2.2-crash',
                'kubectl.kubernetes.io/restartedAt': nowIso,
              },
            },
            spec: {
              containers: [
                {
                  name: 'store-server',
                  image: 'selfheal-ecommerce-store:1.0.0',
                  env: [
                    { name: 'APP_VERSION', value: 'v1.2.2-crash' },
                    { name: 'SIMULATE_FATAL_CRASH', value: 'true' },
                    { name: 'SIMULATE_5XX_REGRESSION', value: 'false' },
                    { name: 'SIMULATE_LIVENESS_FAIL', value: 'false' },
                  ],
                },
              ],
            },
          },
        },
      };
      break;

    case 'DEPLOY_BAD_IMAGE':
      actionTitle = 'Triển Khai Tag Image Hỏng (ImagePullBackOff v9.9.9-corrupted)';
      description = 'Đã cập nhật deployment sang image không tồn tại (selfheal-ecommerce-store:v9.9.9-corrupted). Kubelet báo lỗi ErrImagePull và kẹt tại ImagePullBackOff, ReplicaSet cũ giữ nguyên.';
      patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'app.kubernetes.io/version': 'v9.9.9-corrupted',
                'kubectl.kubernetes.io/restartedAt': nowIso,
              },
            },
            spec: {
              containers: [
                {
                  name: 'store-server',
                  image: 'selfheal-ecommerce-store:v9.9.9-corrupted',
                  env: [
                    { name: 'APP_VERSION', value: 'v9.9.9-corrupted' },
                    { name: 'SIMULATE_FATAL_CRASH', value: 'false' },
                    { name: 'SIMULATE_5XX_REGRESSION', value: 'false' },
                    { name: 'SIMULATE_LIVENESS_FAIL', value: 'false' },
                  ],
                },
              ],
            },
          },
        },
      };
      break;

    case 'ROLLBACK_DEPLOYMENT':
      actionTitle = 'Hoàn Nguyên Phiên Bản Ổn Định (Rollback to Stable v1.0.0)';
      description = 'Đã hoàn nguyên deployment về phiên bản chuẩn an toàn v1.0.0, xóa bỏ toàn bộ cờ lỗi. Hệ thống khôi phục trạng thái hoạt động bình thường.';
      patchBody = {
        spec: {
          template: {
            metadata: {
              annotations: {
                'app.kubernetes.io/version': 'v1.0.0-stable',
                'kubectl.kubernetes.io/restartedAt': nowIso,
              },
            },
            spec: {
              containers: [
                {
                  name: 'store-server',
                  image: 'selfheal-ecommerce-store:1.0.0',
                  env: [
                    { name: 'APP_VERSION', value: 'v1.0.0-stable' },
                    { name: 'SIMULATE_FATAL_CRASH', value: 'false' },
                    { name: 'SIMULATE_5XX_REGRESSION', value: 'false' },
                    { name: 'SIMULATE_LIVENESS_FAIL', value: 'false' },
                  ],
                },
              ],
            },
          },
        },
      };
      break;

    default:
      throw new Error(`Hành động ${action} không hợp lệ!`);
  }

  const patchRes = await callK8sApi(
    'PATCH',
    '/apis/apps/v1/namespaces/test-lab/deployments/ecommerce-store-app',
    patchBody,
    'application/strategic-merge-patch+json'
  );

  if (action === 'DEPLOY_5XX_REGRESSION') {
    fetch(`${DEFAULT_TARGET_URL}/api/chaos/set-regression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }).catch(() => {});
  } else if (action === 'ROLLBACK_DEPLOYMENT' || action === 'CLEAN_ROLLOUT') {
    fetch(`${DEFAULT_TARGET_URL}/api/chaos/reset-all`, { method: 'POST' }).catch(() => {});
  }

  return {
    action,
    actionTitle,
    description,
    k8sStatus: patchRes.status,
    generation: patchRes.data?.metadata?.generation,
    timestamp: nowIso,
  };
}

// 12. Execute Deployment Action HTTP Endpoint
app.post('/api/deployment/action', async (req, res) => {
  const action = req.body?.action || 'CLEAN_ROLLOUT';
  console.log(`[DeploymentLab] Received action trigger: ${action}`);
  try {
    const result = await executeDeploymentPatch(action);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Verify Deployment Live Traffic (10 Requests Probe)
app.post('/api/deployment/verify-traffic', async (req, res) => {
  const target = req.body?.targetUrl || DEFAULT_TARGET_URL;
  const traffic = await testTrafficSamples(target, 10);
  return res.status(200).json({ success: true, ...traffic });
});

// 14. Scale Pods for Target Deployment (ecommerce-store-app)
app.post('/api/deployment/scale', async (req, res) => {
  const targetReplicas = parseInt(req.body?.replicas, 10);
  const delta = parseInt(req.body?.delta, 10);

  try {
    const depRes = await callK8sApi('GET', '/apis/apps/v1/namespaces/test-lab/deployments/ecommerce-store-app');
    const currentReplicas = depRes.data?.spec?.replicas || 1;

    let newReplicas = currentReplicas;
    if (!isNaN(targetReplicas)) {
      newReplicas = targetReplicas;
    } else if (!isNaN(delta)) {
      newReplicas = currentReplicas + delta;
    }

    if (newReplicas < 1) newReplicas = 1;
    if (newReplicas > 20) newReplicas = 20;

    const patchRes = await callK8sApi(
      'PATCH',
      '/apis/apps/v1/namespaces/test-lab/deployments/ecommerce-store-app',
      { spec: { replicas: newReplicas } },
      'application/strategic-merge-patch+json'
    );

    console.log(`[DeploymentLab] Scaled ecommerce-store-app: ${currentReplicas} -> ${newReplicas} replicas (K8s HTTP ${patchRes.status})`);

    return res.status(200).json({
      success: true,
      previousReplicas: currentReplicas,
      replicas: newReplicas,
      k8sStatus: patchRes.status,
      message: `Đã cập nhật số lượng Pod từ ${currentReplicas} thành ${newReplicas} Pods!`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DeploymentLab] Error scaling deployment:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Serve Dashboard Fallback
// -------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`  CHAOS ATTACK INJECTOR CONTROL CENTER 3.0 ONLINE ON PORT ${PORT} `);
  console.log(`  Target Web Service: ${DEFAULT_TARGET_URL}                      `);
  console.log(`  Dashboard: http://localhost:${PORT}                           `);
  console.log(`================================================================`);
});
