#!/usr/bin/env bash
# 重新產生 K-Rider 後台 ADMIN_TOKEN。
# 流程:產生隨機 token -> 用管線餵進 Worker Secret(不經互動貼上,避免夾帶換行)
#       -> 印出來一次讓你存進密碼管理器 -> 驗證 /admin/list 是否回 200。
#
# 用法:bash scripts/rotate-admin-token.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/worker"

API="https://k-rider-api.yazelinj303.workers.dev"
TOKEN="krider_$(openssl rand -hex 24)"

# printf '%s' 不加尾端換行 -> secret 乾淨,跟 admin.html 送出的字串一字不差
printf '%s' "$TOKEN" | npx wrangler secret put ADMIN_TOKEN

echo
echo "------------------------------------------------------------"
echo "新 ADMIN_TOKEN(只會出現這一次,立刻複製進密碼管理器):"
echo
echo "    $TOKEN"
echo
echo "貼進 admin.html 的 ADMIN_TOKEN 欄位即可登入(原始字串,不用加 Bearer)。"
echo "------------------------------------------------------------"
echo

echo "等 secret 傳播再驗證..."
sleep 4
code="$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/list" -H "Authorization: Bearer $TOKEN")"
if [ "$code" = "200" ]; then
  echo "[OK] 新 token 已生效:/admin/list 回 200。"
else
  echo "[WARN] /admin/list 回 $code —— 可能還在傳播(再等 10-30 秒)或網路問題;"
  echo "       稍後直接用上面那串在 admin.html 試,通常很快就生效。"
fi
