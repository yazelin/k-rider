#!/usr/bin/env bash
# 現場共同創作投票的主持端驗收。ADMIN_TOKEN 從環境變數讀,不要打進指令列
# (會留在 shell history)。用法:
#
#   read -rs ADMIN_TOKEN && export ADMIN_TOKEN && bash scripts/live-smoke.sh
#
# 跑完會把測試用的那一場清乾淨。真的直播那一場叫 larch0909,這支不會碰到它。
set -u
API=https://k-rider-api.yazelinj303.workers.dev
EV=smoketest
: "${ADMIN_TOKEN:?先 export ADMIN_TOKEN}"
ok=0; bad=0
chk(){ if [ "$1" = 1 ]; then echo "ok   $2"; ok=$((ok+1)); else echo "FAIL $2"; bad=$((bad+1)); fi; }
adm(){ curl -s -X POST "$API/live/admin" -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H 'content-type: application/json' -d "$1"; }

adm "{\"event\":\"$EV\",\"action\":\"reset\"}" > /dev/null

R=$(adm "{\"event\":\"$EV\",\"action\":\"push\",\"question\":\"主角在哪裡遇到對方？\",\"options\":[\"便利商店\",\"深夜公車\",\"醫院走廊\"]}")
echo "$R" | grep -q '主角在哪裡遇到對方' && chk 1 "推題" || chk 0 "推題 → $R"
echo "$R" | grep -q '"seq":1' && chk 1 "題號從 1 開始" || chk 0 "題號"

R=$(adm "{\"event\":\"$EV\",\"action\":\"push\",\"question\":\"第二題\",\"options\":[\"甲\",\"乙\"]}")
echo "$R" | grep -q '"seq":2' && chk 1 "推第二題,題號遞增" || chk 0 "題號遞增"
echo "$R" | grep -q '"state":"open"' && chk 1 "新題是開著的" || chk 0 "新題狀態"

# 兩個人投,乙 2 票、甲 1 票
for v in aaaaaaaa-1111-2222-3333-000000000001 aaaaaaaa-1111-2222-3333-000000000002; do
  curl -s -X POST "$API/live" -H 'content-type: application/json' \
    -d "{\"voter\":\"$v\",\"event\":\"$EV\",\"choice\":1}" > /dev/null
done
curl -s -X POST "$API/live" -H 'content-type: application/json' \
  -d "{\"voter\":\"aaaaaaaa-1111-2222-3333-000000000003\",\"event\":\"$EV\",\"choice\":0}" > /dev/null

R=$(adm "{\"event\":\"$EV\",\"action\":\"close\"}")
echo "$R" | grep -q '"state":"closed"' && chk 1 "關票" || chk 0 "關票 → $R"
echo "$R" | grep -q '"winner":1' && chk 1 "最高票(乙,2 票)被凍結成答案" || chk 0 "定案 → $R"

R=$(curl -s "$API/live?e=$EV")
echo "$R" | grep -q '"answer":"乙"' && chk 1 "已定案清單帶得出答案" || chk 0 "已定案清單 → $R"

R=$(curl -s -X POST "$API/live" -H 'content-type: application/json' \
    -d "{\"voter\":\"aaaaaaaa-1111-2222-3333-000000000009\",\"event\":\"$EV\",\"choice\":0}")
echo "$R" | grep -q 'no_open_round' && chk 1 "關票之後不能再投" || chk 0 "關票後投票 → $R"

R=$(adm "{\"event\":\"$EV\",\"action\":\"push\",\"question\":\"只有一個選項\",\"options\":[\"甲\"]}")
echo "$R" | grep -q 'need_question_and_2_options' && chk 1 "少於兩個選項被擋" || chk 0 "選項數檢查"

adm "{\"event\":\"$EV\",\"action\":\"reset\"}" > /dev/null
R=$(curl -s "$API/live?e=$EV")
echo "$R" | grep -q '"round":null' && chk 1 "reset 清乾淨" || chk 0 "reset → $R"

echo; echo "通過 $ok / 失敗 $bad"
[ "$bad" = 0 ] || exit 1
