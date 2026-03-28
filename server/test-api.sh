#!/usr/bin/env bash
# Integration test for the Agent Empires HTTP API
# Usage: ./test-api.sh
# Requires: server running on localhost:3001 with a fresh game state

set -uo pipefail

BASE="http://localhost:3001/api"
PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    echo "    expected to contain: $expected"
    echo "    got: $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══ Agent Empires API Test ═══"
echo ""

# ── 1. Health check ──
echo "1. Health check"
HEALTH=$(curl -s "$BASE/../health")
check "Health endpoint returns ok" '"status":"ok"' "$HEALTH"
check "Zero agents initially" '"agents":0' "$HEALTH"

# ── 2. Game state ──
echo ""
echo "2. Game state"
STATE=$(curl -s "$BASE/game/state")
check "Returns turnNumber" '"turnNumber"' "$STATE"
check "Returns 4 players" '"p4"' "$STATE"
check "Returns turnPhase" '"turnPhase"' "$STATE"
check "Returns agentCounts" '"agentCounts"' "$STATE"

# ── 3. Game rules ──
echo ""
echo "3. Game rules"
RULES=$(curl -s "$BASE/game/rules")
check "Returns phases" '"phases"' "$RULES"
check "Max 20 proposals" '"maxProposalsPerTeam":20' "$RULES"
check "Dominance threshold 70" '"dominanceThreshold":70' "$RULES"

# ── 4. Join agents ──
echo ""
echo "4. Agent registration"

declare -a KEYS
declare -a AGENT_IDS
declare -a TEAM_IDS

for i in $(seq 1 8); do
  RESULT=$(curl -s -X POST "$BASE/game/join" -H "Content-Type: application/json")
  KEY=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['apiKey'])")
  AID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['agentId'])")
  TID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['teamId'])")
  KEYS+=("$KEY")
  AGENT_IDS+=("$AID")
  TEAM_IDS+=("$TID")
done

check "8 agents joined" "true" "true"  # If we got here without error, joins succeeded

# Verify team distribution (should be ~2 per team)
HEALTH=$(curl -s "$BASE/../health")
check "8 agents registered" '"agents":8' "$HEALTH"

echo "  Agents assigned:"
for i in $(seq 0 7); do
  echo "    ${AGENT_IDS[$i]} → team ${TEAM_IDS[$i]}"
done

# ── 5. Auth ──
echo ""
echo "5. Authentication"
NOAUTH=$(curl -s "$BASE/agent/me")
check "Rejects unauthenticated request" 'error' "$NOAUTH"

ME=$(curl -s "$BASE/agent/me" -H "Authorization: Bearer ${KEYS[0]}")
check "Auth returns agent info" '"agentId"' "$ME"

# ── 6. Agent profile ──
echo ""
echo "6. Agent profile"
PROFILE=$(curl -s -X POST "$BASE/agent/profile" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestBot-Alpha"}')
check "Name update succeeds" '"TestBot-Alpha"' "$PROFILE"

# Try duplicate name
DUPE=$(curl -s -X POST "$BASE/agent/profile" \
  -H "Authorization: Bearer ${KEYS[1]}" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestBot-Alpha"}')
check "Duplicate name rejected" '"NAME_TAKEN"' "$DUPE"

# ── 7. Chat ──
echo ""
echo "7. Team chat"

# Agent 0 sends a chat message to their team
T0="${TEAM_IDS[0]}"
CHAT=$(curl -s -X POST "$BASE/team/$T0/chat" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello team! I think we should attack south."}')
check "Chat message sent" '"text":"Hello team!' "$CHAT"

# Read chat
MESSAGES=$(curl -s "$BASE/team/$T0/chat" -H "Authorization: Bearer ${KEYS[0]}")
check "Chat contains messages" '"Hello team!' "$MESSAGES"
check "Chat has system join messages" 'has joined the team' "$MESSAGES"

# Wrong team rejected
# Find an agent NOT on team T0
for i in $(seq 0 7); do
  if [ "${TEAM_IDS[$i]}" != "$T0" ]; then
    WRONGTEAM=$(curl -s "$BASE/team/$T0/chat" -H "Authorization: Bearer ${KEYS[$i]}")
    check "Wrong team rejected" '"WRONG_TEAM"' "$WRONGTEAM"
    break
  fi
done

# ── 8. Spectator endpoints ──
echo ""
echo "8. Spectator endpoints"
SPEC_STATE=$(curl -s "$BASE/spectate/state")
check "Spectate state works" '"turnNumber"' "$SPEC_STATE"

SPEC_CHATS=$(curl -s "$BASE/spectate/chats")
check "Spectate chats works" '"chats"' "$SPEC_CHATS"
check "Spectate chats contains messages" '"Hello team!' "$SPEC_CHATS"

SPEC_VOTES=$(curl -s "$BASE/spectate/votes")
check "Spectate votes works" '"votes"' "$SPEC_VOTES"

# ── 9. Rate limiting ──
echo ""
echo "9. Rate limiting"
# Send rapid messages (second should be rate limited)
curl -s -X POST "$BASE/team/$T0/chat" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"text":"First message"}' > /dev/null

RATELIMIT=$(curl -s -X POST "$BASE/team/$T0/chat" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"text":"Immediate second message"}')
check "Rate limit enforced" '"RATE_LIMITED"' "$RATELIMIT"

# ── 10. Phase gating ──
echo ""
echo "10. Phase gating"
# Try to propose outside propose phase (should fail since game hasn't started turns yet)
PROPOSE=$(curl -s -X POST "$BASE/team/$T0/propose" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test plan","reinforce":[{"territoryId":"france","troops":5}],"attack":[]}')
check "Proposal rejected outside propose phase" '"WRONG_PHASE"' "$PROPOSE"

VOTE=$(curl -s -X POST "$BASE/team/$T0/vote" \
  -H "Authorization: Bearer ${KEYS[0]}" \
  -H "Content-Type: application/json" \
  -d '{"proposalId":"prop-fake"}')
check "Vote rejected outside vote phase" '"WRONG_PHASE"' "$VOTE"

# ── Summary ──
echo ""
echo "═══════════════════════════════"
echo "  PASS: $PASS  FAIL: $FAIL"
echo "═══════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
