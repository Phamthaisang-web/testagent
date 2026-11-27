# TestAgent3: Enterprise E-Commerce Store & Red-Team Chaos Attack Injector 3.0

Hệ thống mô phỏng môi trường doanh nghiệp thực tế, kiểm thử tải đa kịch bản (Chaos & Attack Injector) và đánh giá khả năng tự phục hồi (Self-Healing) chạy trực tiếp trong Kubernetes (`test-lab`).

---

## 1. Cấu Trúc Thư Mục

```
D:\NCKH\testagent3\
├── ecommerce-app/           # Cửa hàng thương mại điện tử Doanh Nghiệp (NovaTech Enterprise Store)
│   ├── src/
│   │   ├── public/         # Giao diện web doanh nghiệp (Sleek Modern UI, Catalog, Cart, Order)
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   └── app.js
│   │   └── server.js       # Node.js Express API: Product Catalog, Heavy Search, Checkout, Rolling Metrics
│   ├── Dockerfile
│   ├── package.json
│   └── .dockerignore
│
├── attack-injector/         # Trung tâm tấn công & kiểm thử Chaos Red-Team 3.0
│   ├── src/
│   │   ├── public/         # Giao diện Red-Team Dark UI, All Actions Test Suite, Presets, Sliders, Live Log Terminal
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   └── app.js
│   │   └── server.js       # Chaos Attack Engine & K8s In-Cluster Deployment Management API
│   ├── Dockerfile
│   ├── package.json
│   └── .dockerignore
│
├── test_all_actions.py      # Kịch bản kiểm thử tự động toàn diện CLI (hỗ trợ Duration & Intensity)
├── test_deployment_scenarios.py # Kịch bản kiểm thử các kịch bản Deployment Rollout
│
└── k8s/                     # Kubernetes Manifests & Automation Scripts
    ├── mongodb-replica-set.yaml  # StatefulSet 3 Replicas (rs0: Master & Replicas), Headless Service
    ├── mongodb-init-job.yaml     # Job tự động khởi tạo Replica Set & bầu Master
    ├── ecommerce-deployment.yaml # 2 Replicas, Limits, Probes, NodePort 30895
    ├── attack-deployment.yaml    # 1 Replica, Limits, Probes, NodePort 30896
    ├── deploy.ps1                # Script tự động build Docker, load Minikube & apply K8s
    └── cleanup.ps1               # Script gỡ bỏ tài nguyên
```

---

## 2. Thông Tin Cổng Dịch Vụ & Mạng

| Dịch vụ | Loại K8s | Port nội bộ K8s | NodePort | URL Host (Port-Forward) |
| :--- | :--- | :--- | :--- | :--- |
| **NovaTech Store** | Service (`ecommerce-store-service`) | `8080` | `30895` | `http://localhost:30895` |
| **Attack Injector**| Service (`attack-injector-service`) | `8080` | `30896` | `http://localhost:30896` |
| **MongoDB Master & Replicas** | StatefulSet (`mongodb-service`) | `27017` | ClusterIP | `mongodb-0..2.mongodb-service:27017` |

---

## 3. Các Cấp Độ Tải (Intensity Levels)

Hệ thống hỗ trợ 4 cấp độ tải chuẩn hóa cho tất cả các hành động:

| Cấp độ | Nhãn hiển thị | Target RPS | RAM Injection | Latency Delay | CPU Complexity | Mục đích sử dụng |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Low** | 🟢 **Mức Nhẹ** | `20 RPS` | `+10 MB` | `500 ms` | `50,000` | Kiểm tra kết nối & tính đúng đắn của logic |
| **Medium** | 🟡 **Mức Vừa** | `65 RPS` | `+25 MB` | `1,500 ms` | `150,000` | Mô phỏng lưu lượng giờ cao điểm thông thường |
| **High** | 🟠 **Mức Nặng** | `140 RPS` | `+50 MB` | `3,000 ms` | `300,000` | Gây nghẽn hàng đợi, kích hoạt cảnh báo AI RCA |
| **Extreme** | 🔴 **Mức Cực Đại** | `250+ RPS` | `+100 MB` | `5,000 ms` | `600,000` | Ép container chạm ngưỡng Limits, thử thách Self-Healing |

---

## 4. Danh Mục 17 Actions Toàn Diện (All Actions Catalog)

### Nhóm 1: Kịch Bản Tấn Công & Giả Lập Lỗi (Chaos Red-Team)
1. **`HTTP_FLOOD`**: Bắn hàng loạt request dồn dập vào danh mục sản phẩm (`/api/products`).
2. **`CPU_BURNER`**: Thiêu đốt CPU với thuật toán tìm kiếm đa chiều (`/api/search/heavy`).
3. **`FLASH_SALE`**: Cơn bão checkout đơn hàng đồng thời gây nghẽn queue (`/api/cart/checkout`).
4. **`MALFORMED_500`**: Tiêm payload độc hại & exception ép sinh mã lỗi 500 (`/api/cart/checkout?fault=internal_error`).
5. **`MEMORY_LEAK`**: Bơm mảng RAM liên tục ép container chạm ngưỡng OOM (`/api/chaos/leak-memory`).
6. **`SLOW_LATENCY`**: Ép độ trễ phản hồi từ 500ms - 5000ms gây thắt cổ chai I/O (`/api/chaos/latency`).
7. **`POD_CRASH`**: Gửi tín hiệu ép container đột tử ExitCode 1 (`/api/chaos/error?crash=true`).
8. **`MIXED_CHAOS`**: Bão đa vector phối hợp ngẫu nhiên nhiều kiểu lỗi cùng lúc.

### Nhóm 2: Kiểm Tra Sẵn Sàng & Phục Hồi (Remediation & Diagnostics)
9. **`SINGLE_PROBE`**: Bắn thử 1 request kiểm tra độ trễ và tính sẵn sàng của endpoint.
10. **`VERIFY_TRAFFIC`**: Bắn mẫu 10 - 50 request kiểm tra tỷ lệ 200/500 và độ trễ trung bình.
11. **`RESET_RAM`**: Xả sạch bộ nhớ rò rỉ trên Web Thương Mại mà không cần restart Pod.
12. **`DB_FAILOVER`**: Chuyển mạch CSDL kép Master sang Replace DB và ngược lại.

### Nhóm 3: Vòng Đời Triển Khai K8s (Deployment Lifecycle)
13. **`CLEAN_ROLLOUT`**: Nâng cấp phiên bản chuẩn v1.2.0-stable (Zero-downtime).
14. **`DEPLOY_5XX_REGRESSION`**: Triển khai bản lỗi hồi quy 500 (v1.2.1-faulty).
15. **`DEPLOY_CRASHLOOP`**: Triển khai bản lỗi nạp sập container (CrashLoopBackOff v1.2.2-crash).
16. **`DEPLOY_BAD_IMAGE`**: Triển khai tag image hỏng (ImagePullBackOff v9.9.9-corrupted).
17. **`ROLLBACK_DEPLOYMENT`**: Hoàn nguyên an toàn về phiên bản gốc v1.0.0-stable.

---

## 5. Hướng Dẫn Sử Dụng Bộ Test Tự Động (CLI & UI)

### 1. Trên Giao Diện Web (UI):
Mở trình duyệt truy cập: **`http://localhost:30896`**
- Chuyển sang Tab: **🧪 KIỂM THỬ TẤT CẢ ACTIONS (ALL-ACTION TEST SUITE)**.
- Chọn Thời gian (5s, 10s, 30s, 60s) và Mức độ (🟢 Nhẹ, 🟡 Vừa, 🟠 Nặng, 🔴 Cực Đại).
- Nhấn **"▶️ Test Action"** cho từng action riêng biệt HOẶC nhấn **"⚡ CHẠY TỰ ĐỘNG TOÀN BỘ 17 ACTIONS"** để chạy liên hoàn toàn bộ hệ thống.

### 2. Qua Dòng Lệnh Python (CLI):
```powershell
# Chạy toàn bộ 17 actions với thời gian 10s và mức độ Vừa (Medium)
python test_all_actions.py --action all --duration 10 --intensity medium

# Chạy riêng action HTTP Flood với mức độ Cực Đại (Extreme)
python test_all_actions.py --action HTTP_FLOOD --duration 15 --intensity extreme

# Chạy riêng kịch bản triển khai lỗi hồi quy 500
python test_all_actions.py --action DEPLOY_5XX_REGRESSION --duration 10 --intensity high
```
