import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://localhost:30896'

def request_with_retry(fn, retries=3, delay=1.5):
    for i in range(retries):
        try:
            return fn()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(delay)

def call_action(action_name):
    def _do():
        req = urllib.request.Request(
            f'{BASE_URL}/api/deployment/action',
            data=json.dumps({'action': action_name}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read())
    return request_with_retry(_do)

def get_status():
    def _do():
        with urllib.request.urlopen(f'{BASE_URL}/api/deployment/status', timeout=10) as res:
            return json.loads(res.read())
    return request_with_retry(_do)

def verify_traffic():
    def _do():
        req = urllib.request.Request(
            f'{BASE_URL}/api/deployment/verify-traffic',
            data=b'{}',
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read())
    return request_with_retry(_do)

print("==================================================================")
print("TEST SUITE: TESTAGENT3 KUBERNETES DEPLOYMENT & RESILIENCE LAB")
print("==================================================================")

# 1. Clean Rollout
print("\n[SCENARIO 1] Executing CLEAN_ROLLOUT (v1.2.0-stable)...")
act1 = call_action('CLEAN_ROLLOUT')
print(f"-> Action Status: {act1['k8sStatus']}, Action: {act1['actionTitle']}")
print("Waiting 5s for rollout...")
time.sleep(5)
st1 = get_status()
print(f"-> Deployment Version: {st1['deployment']['version']}")
print(f"-> Pods Ready: {st1['deployment']['replicas']['ready']}/{st1['deployment']['replicas']['desired']}")
print(f"-> App Probe: {st1['appProbe']['status']} (Version: {st1['appProbe'].get('version')})")
vf1 = verify_traffic()
print(f"-> Traffic Check: {vf1['status200']}/{vf1['totalProbes']} OK, 5xx Rate: {vf1['error5xxRate']}%, Healthy: {vf1['isHealthy']}")

# 2. 5xx Regression
print("\n[SCENARIO 2] Executing DEPLOY_5XX_REGRESSION (v1.2.1-faulty)...")
act2 = call_action('DEPLOY_5XX_REGRESSION')
print(f"-> Action Status: {act2['k8sStatus']}, Action: {act2['actionTitle']}")
print("Waiting 6s for rollout...")
time.sleep(6)
st2 = get_status()
print(f"-> Deployment Version: {st2['deployment']['version']}")
vf2 = verify_traffic()
print(f"-> Traffic Check: {vf2['status200']}/{vf2['totalProbes']} OK, {vf2['status500']}/{vf2['totalProbes']} 5xx, 5xx Rate: {vf2['error5xxRate']}%, Healthy: {vf2['isHealthy']}")

# 3. CrashLoopBackOff
print("\n[SCENARIO 3] Executing DEPLOY_CRASHLOOP (v1.2.2-crash)...")
act3 = call_action('DEPLOY_CRASHLOOP')
print(f"-> Action Status: {act3['k8sStatus']}, Action: {act3['actionTitle']}")
print("Waiting 5s for crash detection...")
time.sleep(5)
st3 = get_status()
print(f"-> Deployment Version: {st3['deployment']['version']}")
crash_pods = [p for p in st3['pods'] if p['restartCount'] > 0 or 'BackOff' in p['stateReason'] or 'Error' in p['stateReason']]
print(f"-> Detected Failing/Crashing Pods: {len(crash_pods)}")
for cp in crash_pods[:2]:
    print(f"   * {cp['name']} -> State: {cp['stateReason']}, Restarts: {cp['restartCount']}")

# 4. Bad Image Tag
print("\n[SCENARIO 4] Executing DEPLOY_BAD_IMAGE (v9.9.9-corrupted)...")
act4 = call_action('DEPLOY_BAD_IMAGE')
print(f"-> Action Status: {act4['k8sStatus']}, Action: {act4['actionTitle']}")
print("Waiting 5s for image pull failure...")
time.sleep(5)
st4 = get_status()
print(f"-> Deployment Version: {st4['deployment']['version']}")
bad_pods = [p for p in st4['pods'] if 'Image' in p['stateReason'] or 'Err' in p['stateReason']]
print(f"-> Detected ImagePull Failing Pods: {len(bad_pods)}")
for bp in bad_pods[:2]:
    print(f"   * {bp['name']} -> State: {bp['stateReason']}")

# 5. Rollback to Stable
print("\n[SCENARIO 5] Executing ROLLBACK_DEPLOYMENT (v1.0.0-stable)...")
act5 = call_action('ROLLBACK_DEPLOYMENT')
print(f"-> Action Status: {act5['k8sStatus']}, Action: {act5['actionTitle']}")
print("Waiting 6s for safe rollback...")
time.sleep(6)
st5 = get_status()
print(f"-> Deployment Version: {st5['deployment']['version']}")
print(f"-> Pods Ready: {st5['deployment']['replicas']['ready']}/{st5['deployment']['replicas']['desired']}")
print(f"-> App Probe: {st5['appProbe']['status']} (Version: {st5['appProbe'].get('version')})")
vf5 = verify_traffic()
print(f"-> Traffic Check: {vf5['status200']}/{vf5['totalProbes']} OK, 5xx Rate: {vf5['error5xxRate']}%, Healthy: {vf5['isHealthy']}")

print("\n==================================================================")
print("ALL 5 DEPLOYMENT TEST SCENARIOS COMPLETED SUCCESSFULLY!")
print("==================================================================")
