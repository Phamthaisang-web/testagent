# cleanup.ps1 - Remove testagent3 resources from Kubernetes
Write-Host ">>> Deleting testagent3 deployments and services in namespace 'test-lab'..." -ForegroundColor Yellow
kubectl delete -f "$PSScriptRoot\ecommerce-deployment.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\attack-deployment.yaml" --ignore-not-found
Write-Host ">>> testagent3 cleanup finished." -ForegroundColor Green
