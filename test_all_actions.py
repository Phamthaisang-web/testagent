#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_all_actions.py - Comprehensive Automated Test Suite for testagent3
Runs and verifies all 17 actions with customizable Duration and Intensity Levels.
Usage:
    python test_all_actions.py --action all --duration 10 --intensity medium
    python test_all_actions.py --action HTTP_FLOOD --duration 15 --intensity high
    python test_all_actions.py --action DEPLOY_5XX_REGRESSION --duration 10 --intensity extreme
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

DEFAULT_BASE_URL = 'http://localhost:30896'

# ANSI Color Codes
C_CYAN = '\033[96m'
C_GREEN = '\033[92m'
C_YELLOW = '\033[93m'
C_RED = '\033[91m'
C_MAGENTA = '\033[95m'
C_BOLD = '\033[1m'
C_RESET = '\033[0m'

def make_request(url, method='GET', data=None, timeout=120):
    headers = {'Content-Type': 'application/json'}
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_actions_catalog(base_url):
    try:
        data = make_request(f"{base_url}/api/actions/catalog")
        return data.get('catalog', []), data.get('intensityLevels', {})
    except Exception as e:
        print(f"{C_RED}[ERROR] Không thể lấy danh mục actions từ {base_url}: {e}{C_RESET}")
        return [], {}

def run_action_test(base_url, action_id, duration_sec, intensity_level):
    payload = {
        'action': action_id,
        'durationSeconds': duration_sec,
        'intensityLevel': intensity_level,
    }
    return make_request(f"{base_url}/api/actions/run", method='POST', data=payload, timeout=duration_sec + 20)

def main():
    parser = argparse.ArgumentParser(description="TestAgent3 All-Action Automation Test Suite")
    parser.add_argument('--action', type=str, default='all', help="Action ID to run or 'all' for full suite")
    parser.add_argument('--duration', type=int, default=10, help="Test duration in seconds per action (default: 10)")
    parser.add_argument('--intensity', type=str, default='medium', choices=['low', 'medium', 'high', 'extreme'], help="Intensity level: low, medium, high, extreme")
    parser.add_argument('--url', type=str, default=DEFAULT_BASE_URL, help="Base URL of Chaos Attack Injector")
    args = parser.parse_args()

    print(f"\n{C_CYAN}{C_BOLD}================================================================================{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}  TESTAGENT3: HỆ THỐNG KIỂM THỬ TẤT CẢ ACTIONS (CUSTOM DURATION & INTENSITY)    {C_RESET}")
    print(f"{C_CYAN}{C_BOLD}================================================================================{C_RESET}")
    print(f"Target URL:     {args.url}")
    print(f"Thời gian test: {args.duration} giây mỗi action")
    print(f"Mức độ tải:     {args.intensity.upper()}")
    print(f"Hành động chọn: {args.action.upper()}")
    print(f"{C_CYAN}--------------------------------------------------------------------------------{C_RESET}\n")

    catalog, intensities = get_actions_catalog(args.url)
    if not catalog:
        print(f"{C_RED}❌ Không tìm thấy danh mục actions. Vui lòng đảm bảo cổng {args.url} đang hoạt động.{C_RESET}")
        sys.exit(1)

    # Filter actions
    if args.action.lower() == 'all':
        actions_to_run = catalog
    else:
        actions_to_run = [a for a in catalog if a['id'].lower() == args.action.lower()]
        if not actions_to_run:
            print(f"{C_RED}❌ Action '{args.action}' không tồn tại. Danh sách actions có sẵn:{C_RESET}")
            for a in catalog:
                print(f"  * {a['id']:<24} -> {a['name']}")
            sys.exit(1)

    print(f"🚀 Bắt đầu thực hiện kiểm thử {len(actions_to_run)} actions...\n")

    results = []
    total_requests = 0
    start_all = time.time()

    for idx, act in enumerate(actions_to_run, 1):
        print(f"[{idx}/{len(actions_to_run)}] {C_BOLD}{act['icon']} {act['name']}{C_RESET} (ID: {act['id']})")
        print(f"    * Nhóm:       {act.get('categoryName', '')}")
        print(f"    * Endpoint:   {act.get('endpoint', '')}")
        print(f"    * Thông số:   Thời gian = {args.duration}s | Mức độ = {args.intensity.upper()}")

        t0 = time.time()
        try:
            res = run_action_test(args.url, act['id'], args.duration, args.intensity)
            elapsed = round(time.time() - t0, 1)

            if res.get('success'):
                outcome = res.get('result', {})
                status = outcome.get('status', 'PASS')
                metrics = outcome.get('metrics', {})
                reqs = metrics.get('requestsSent', metrics.get('totalProbes', 0))
                total_requests += reqs

                if status == 'PASS':
                    status_badge = f"{C_GREEN}[PASS ✅]{C_RESET}"
                elif status == 'WARN':
                    status_badge = f"{C_YELLOW}[WARN ⚠️]{C_RESET}"
                else:
                    status_badge = f"{C_RED}[FAIL ❌]{C_RESET}"

                print(f"    -> Kết quả:   {status_badge} ({elapsed}s)")
                print(f"    -> Tóm tắt:   {outcome.get('summary', 'OK')}")
                results.append({'id': act['id'], 'name': act['name'], 'status': status, 'elapsed': elapsed, 'summary': outcome.get('summary')})
            else:
                print(f"    -> Kết quả:   {C_RED}[FAIL ❌]{C_RESET} ({elapsed}s): {res.get('error')}")
                results.append({'id': act['id'], 'name': act['name'], 'status': 'FAIL', 'elapsed': elapsed, 'summary': res.get('error')})

        except Exception as e:
            elapsed = round(time.time() - t0, 1)
            print(f"    -> Kết quả:   {C_RED}[ERROR ❌]{C_RESET} ({elapsed}s): {str(e)}")
            results.append({'id': act['id'], 'name': act['name'], 'status': 'ERROR', 'elapsed': elapsed, 'summary': str(e)})

        print("")
        time.sleep(1.0)

    total_time = round(time.time() - start_all, 1)

    # Print Summary Table
    pass_count = sum(1 for r in results if r['status'] == 'PASS')
    warn_count = sum(1 for r in results if r['status'] == 'WARN')
    fail_count = sum(1 for r in results if r['status'] in ('FAIL', 'ERROR'))

    print(f"\n{C_CYAN}{C_BOLD}================================================================================{C_RESET}")
    print(f"{C_CYAN}{C_BOLD}                 BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ ACTIONS                         {C_RESET}")
    print(f"{C_CYAN}{C_BOLD}================================================================================{C_RESET}")
    print(f"{'STT':<4} {'ACTION ID':<24} {'TRẠNG THÁI':<12} {'THỜI GIAN':<10} {'TÓM TẮT'}")
    print(f"{'-'*4} {'-'*24} {'-'*12} {'-'*10} {'-'*30}")

    for idx, r in enumerate(results, 1):
        st_color = C_GREEN if r['status'] == 'PASS' else (C_YELLOW if r['status'] == 'WARN' else C_RED)
        print(f"{idx:<4} {r['id']:<24} {st_color}{r['status']:<12}{C_RESET} {str(r['elapsed']) + 's':<10} {(r['summary'] or '')[:45]}")

    print(f"{C_CYAN}--------------------------------------------------------------------------------{C_RESET}")
    print(f"TỔNG KẾT: {C_GREEN}Đạt (PASS): {pass_count}{C_RESET} | {C_YELLOW}Cảnh báo (WARN): {warn_count}{C_RESET} | {C_RED}Lỗi (FAIL): {fail_count}{C_RESET}")
    print(f"Tổng số request đã gửi: {total_requests:,}")
    print(f"Tổng thời gian chạy:    {total_time} giây")
    print(f"{C_CYAN}================================================================================{C_RESET}\n")

if __name__ == '__main__':
    main()
