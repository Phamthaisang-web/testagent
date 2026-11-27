# deploy.ps1 - Automated Build and Deployment for testagent3
# Targets: ecommerce-app & attack-injector in Kubernetes namespace test-lab

$ErrorActionPreference = "Stop"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [TESTAGENT3] Building & Deploying Enterprise E-Commerce" -ForegroundColor Cyan
Write-Host "              & Red-Team Chaos Attack Injector" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$ECOM_DIR = Join-Path $ROOT_DIR "ecommerce-app"
$ATTACK_DIR = Join-Path $ROOT_DIR "attack-injector"

# 1. Ensure namespace test-lab exists
Write-Host "`n>>> [1/6] Ensuring Kubernetes namespace 'test-lab' exists..." -ForegroundColor Yellow
kubectl create namespace test-lab --dry-run=client -o yaml | kubectl apply -f -

# 2. Build Docker images
Write-Host "`n>>> [2/6] Building Docker image for ecommerce-store:1.0.0..." -ForegroundColor Yellow
docker build -t selfheal-ecommerce-store:1.0.0 -f "$ECOM_DIR\Dockerfile" "$ECOM_DIR"

Write-Host "`n>>> [3/6] Building Docker image for attack-injector:1.0.0..." -ForegroundColor Yellow
docker build -t selfheal-attack-injector:1.0.0 -f "$ATTACK_DIR\Dockerfile" "$ATTACK_DIR"

# 3. Load into Minikube
Write-Host "`n>>> [4/6] Loading images into Minikube..." -ForegroundColor Yellow
minikube image load selfheal-ecommerce-store:1.0.0
minikube image load selfheal-attack-injector:1.0.0

# 4. Apply Kubernetes Manifests
Write-Host "`n>>> [5/7] Deploying MongoDB Replica Set (Master & Replicas)..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot\mongodb-replica-set.yaml"
kubectl rollout status statefulset/mongodb -n test-lab --timeout=120s
kubectl delete job mongodb-rs-init -n test-lab --ignore-not-found
kubectl apply -f "$PSScriptRoot\mongodb-init-job.yaml"

Write-Host "`n>>> [6/7] Applying manifests for E-Commerce & Attack Injector in namespace 'test-lab'..." -ForegroundColor Yellow
kubectl apply -f "$PSScriptRoot\ecommerce-deployment.yaml"
kubectl apply -f "$PSScriptRoot\attack-deployment.yaml"

# 5. Wait for rollouts
Write-Host "`n>>> [7/7] Waiting for rollouts to complete..." -ForegroundColor Yellow
kubectl rollout status deployment/ecommerce-store-app -n test-lab --timeout=90s
kubectl rollout status deployment/attack-injector-app -n test-lab --timeout=90s

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " [SUCCESS] testagent3 deployed successfully!" -ForegroundColor Green
Write-Host " --------------------------------------------------------" -ForegroundColor Green
Write-Host " 1. Enterprise E-Commerce Storefront: NodePort 30895" -ForegroundColor White
Write-Host "    Internal:  http://ecommerce-store-service:8080" -ForegroundColor Gray
Write-Host " 2. Red-Team Chaos Attack Injector:  NodePort 30896" -ForegroundColor White
Write-Host "    Internal:  http://attack-injector-service:8080" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Green
