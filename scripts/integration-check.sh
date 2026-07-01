#!/usr/bin/env bash
# QuickNotes Integration Check (MongoDB-adapted)
set -uo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ FAIL: $1"; FAIL=$((FAIL+1)); }

echo ""
echo "QuickNotes Integration Check — $BASE"
echo "============================================"

echo ""
echo "[F6] Health endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
[ "$STATUS" = "200" ] && pass "GET /api/health → 200" || fail "GET /api/health → expected 200, got $STATUS"
BODY=$(curl -s "$BASE/api/health")
echo "$BODY" | grep -q '"status"' && echo "$BODY" | grep -q '"ok"' && pass 'GET /api/health body ok' || fail "health body wrong: $BODY"

echo ""
echo "[F9] Iframe compatibility"
HEADERS=$(curl -s -I "$BASE/")
echo "$HEADERS" | grep -qi 'x-frame-options' && fail "X-Frame-Options present" || pass "no X-Frame-Options"
echo "$HEADERS" | grep -qi 'frame-ancestors' && fail "frame-ancestors CSP present" || pass "no frame-ancestors CSP"

echo ""
echo "[F7] Auto-migration"
POST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/notes" -H "Content-Type: application/json" -d '{"title":"__mig_check__","body":"","pinned":false}')
[ "$POST_STATUS" = "201" ] && pass "POST /api/notes → 201 (collection ready)" || fail "POST → expected 201, got $POST_STATUS"

echo ""
echo "[US2] Create note Groceries"
CREATED=$(curl -s -X POST "$BASE/api/notes" -H "Content-Type: application/json" -d '{"title":"Groceries","body":"milk, eggs","pinned":false}')
GROCERIES_ID=$(echo "$CREATED" | grep -o '"id":"[a-f0-9]*"' | grep -o '[a-f0-9]\{24\}' | head -1)
[ -n "$GROCERIES_ID" ] && pass "POST created id=$GROCERIES_ID" || fail "POST did not return an id: $CREATED"
LIST=$(curl -s "$BASE/api/notes")
echo "$LIST" | grep -q 'Groceries' && pass "GET /api/notes includes Groceries" || fail "GET does not include Groceries"

echo ""
echo "[US3] Edit note"
if [ -n "$GROCERIES_ID" ]; then
  PUT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/notes/$GROCERIES_ID" -H "Content-Type: application/json" -d '{"title":"Groceries Updated","body":"bread","pinned":false}')
  [ "$PUT_STATUS" = "200" ] && pass "PUT /api/notes/$GROCERIES_ID → 200" || fail "PUT → expected 200, got $PUT_STATUS"
  LIST2=$(curl -s "$BASE/api/notes")
  echo "$LIST2" | grep -q 'Groceries Updated' && pass "list reflects updated title" || fail "list does not reflect updated title"
else
  fail "US3 skipped — no id"
fi

echo ""
echo "[US5] Search"
SR=$(curl -s "$BASE/api/notes?q=Grocer")
echo "$SR" | grep -q 'Groceries' && pass "search ?q=Grocer returns match" || fail "search returned nothing"
NM=$(curl -s "$BASE/api/notes?q=zzzno_match_zzz")
echo "$NM" | grep -q '"id"' && fail "no-match search returned results" || pass "no-match search returns empty"
SL=$(curl -s "$BASE/api/notes?q=grocer")
echo "$SL" | grep -q 'Groceries' && pass "case-insensitive search works" || fail "case-insensitive search failed"

echo ""
echo "[US4] Delete note"
if [ -n "$GROCERIES_ID" ]; then
  DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/notes/$GROCERIES_ID")
  [ "$DEL_STATUS" = "204" ] && pass "DELETE → 204" || fail "DELETE → expected 204, got $DEL_STATUS"
  LIST3=$(curl -s "$BASE/api/notes")
  echo "$LIST3" | grep -q "\"id\":\"$GROCERIES_ID\"" && fail "deleted note still in list" || pass "deleted note gone from list"
  GET_DEL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notes/$GROCERIES_ID")
  [ "$GET_DEL" = "404" ] && pass "GET deleted note → 404" || fail "GET deleted note → expected 404, got $GET_DEL"
else
  fail "US4 skipped"
fi

echo ""
echo "[F5] API validation"
EMPTY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/notes" -H "Content-Type: application/json" -d '{"title":""}')
[ "$EMPTY" = "400" ] && pass "empty title → 400" || fail "empty title → expected 400, got $EMPTY"
ERR_BODY=$(curl -s -X POST "$BASE/api/notes" -H "Content-Type: application/json" -d '{"title":""}')
echo "$ERR_BODY" | grep -q 'TITLE_REQUIRED' && pass "error code TITLE_REQUIRED" || fail "missing TITLE_REQUIRED: $ERR_BODY"
INVALID=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notes/999999999")
[ "$INVALID" = "404" ] && pass "invalid id → 404" || fail "invalid id → expected 404, got $INVALID"
NOTALPHA=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notes/abc")
[ "$NOTALPHA" = "404" ] && pass "non-objectid abc → 404" || fail "abc → expected 404, got $NOTALPHA"

echo ""
echo "[US6] Persistence"
PN=$(curl -s -X POST "$BASE/api/notes" -H "Content-Type: application/json" -d '{"title":"__persist_test__","body":"survives","pinned":false}')
PID=$(echo "$PN" | grep -o '"id":"[a-f0-9]*"' | grep -o '[a-f0-9]\{24\}' | head -1)
if [ -n "$PID" ]; then
  GP=$(curl -s "$BASE/api/notes/$PID")
  echo "$GP" | grep -q '__persist_test__' && pass "GET persisted note → found (MongoDB confirmed)" || fail "persisted note not found"
  curl -s -o /dev/null -X DELETE "$BASE/api/notes/$PID"
else
  fail "persistence: could not create note"
fi

echo ""
echo "[US1] Home page"
HS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
[ "$HS" = "200" ] && pass "GET / → 200" || fail "GET / → expected 200, got $HS"
HTML=$(curl -s "$BASE/")
echo "$HTML" | grep -qi 'QuickNotes' && pass "/ has QuickNotes branding" || fail "/ missing QuickNotes"
echo "$HTML" | grep -qi 'notes/new\|New note' && pass "/ has New note CTA" || fail "/ missing New note"
NS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/notes/new")
[ "$NS" = "200" ] && pass "GET /notes/new → 200" || fail "GET /notes/new → expected 200, got $NS"

# Cleanup
curl -s "$BASE/api/notes?q=__mig_check__" | grep -o '[a-f0-9]\{24\}' | while read id; do
  curl -s -o /dev/null -X DELETE "$BASE/api/notes/$id"
done

echo ""
echo "============================================"
echo "Results: $PASS passed, $FAIL failed"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL CHECKS PASSED" && exit 0 || echo "SOME CHECKS FAILED" && exit 1
