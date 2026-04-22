#!/usr/bin/env bash
# Basic end-to-end API smoke test for the seeded Hospital CRM backend.
# Usage:
#   ./scripts/smoke-api.sh
#   API_URL=http://127.0.0.1:8080 ./scripts/smoke-api.sh

set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8080}"
PASS_COUNT=0
FAIL_COUNT=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[smoke] missing required command: $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq

print_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] $1"
}

print_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] $1"
}

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local token="${5:-}"
  local body="${6:-}"

  local body_file
  body_file="$(mktemp)"

  local -a curl_args
  curl_args=(-sS -X "$method" "$API_URL$path" -o "$body_file" -w "%{http_code}")
  if [[ -n "$token" ]]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    curl_args+=(-H "Content-Type: application/json" -d "$body")
  fi

  local status
  if ! status="$(curl "${curl_args[@]}")"; then
    print_fail "$name (request error)"
    rm -f "$body_file"
    return 1
  fi

  if [[ "$status" == "$expected_status" ]]; then
    print_pass "$name ($status)"
    rm -f "$body_file"
    return 0
  fi

  local preview
  preview="$(head -c 240 "$body_file" | tr '\n' ' ')"
  print_fail "$name (expected $expected_status, got $status) body=$preview"
  rm -f "$body_file"
  return 1
}

login() {
  local email="$1"
  local password="$2"
  local label="$3"

  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl -sS -X POST "$API_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    -o "$body_file" -w "%{http_code}")"

  if [[ "$status" != "200" ]]; then
    local preview
    preview="$(head -c 240 "$body_file" | tr '\n' ' ')"
    print_fail "login $label (expected 200, got $status) body=$preview" >&2
    rm -f "$body_file"
    return 1
  fi

  local token
  token="$(jq -r '.accessToken // empty' "$body_file")"
  if [[ -z "$token" ]]; then
    print_fail "login $label (missing accessToken)" >&2
    rm -f "$body_file"
    return 1
  fi

  print_pass "login $label" >&2
  rm -f "$body_file"
  printf '%s' "$token"
}

echo "[smoke] API_URL=$API_URL"

request "healthz" "GET" "/healthz" "200"
request "readyz" "GET" "/readyz" "200"

ADMIN_TOKEN="$(login "admin@hospital.local" "AdminPass123!" "admin")"
PHARM_TOKEN="$(login "pharm@hospital.local" "PharmPass123!" "pharmacist")"
DOCTOR_TOKEN="$(login "ada@hospital.local" "DoctorPass123!" "doctor")"

request "auth me (admin)" "GET" "/v1/auth/me" "200" "$ADMIN_TOKEN"
request "auth me (pharmacist)" "GET" "/v1/auth/me" "200" "$PHARM_TOKEN"
request "auth me (doctor)" "GET" "/v1/auth/me" "200" "$DOCTOR_TOKEN"

request "patients list (admin)" "GET" "/v1/patients" "200" "$ADMIN_TOKEN"
request "doctors list (admin)" "GET" "/v1/doctors" "200" "$ADMIN_TOKEN"
request "drugs list (admin)" "GET" "/v1/drugs" "200" "$ADMIN_TOKEN"
request "encounters list (admin)" "GET" "/v1/encounters" "200" "$ADMIN_TOKEN"
request "prescriptions list (admin)" "GET" "/v1/prescriptions" "200" "$ADMIN_TOKEN"
request "dispensations list (pharmacist)" "GET" "/v1/dispensations" "200" "$PHARM_TOKEN"
request "billing invoices list (admin)" "GET" "/v1/billing/invoices" "200" "$ADMIN_TOKEN"
request "audit list (admin)" "GET" "/v1/audit" "200" "$ADMIN_TOKEN"
request "admin insurance policies (admin)" "GET" "/v1/admin/insurance-policies" "200" "$ADMIN_TOKEN"

# RBAC sanity check: pharmacist should not access admin-only dictionary endpoints.
request "RBAC deny admin insurance policies (pharmacist)" "GET" "/v1/admin/insurance-policies" "403" "$PHARM_TOKEN"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "[smoke] done: total=$TOTAL pass=$PASS_COUNT fail=$FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
