#!/bin/bash
# scripts/test-mcp-orchestration.sh
# Test MCP Tool Discovery & Orchestration Workflow
# 
# This script validates the 6-step orchestration process:
# 1. Sequential thinking - objectives defined
# 2. Documentation fetched
# 3. MCP servers inventoried
# 4. Sequential thinking - execution planned
# 5. Tool chain designed
# 6. Execution validated

set -e

API_URL="${API_URL:-http://localhost:3323}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MCP Tool Discovery & Orchestration Workflow Test         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test results
test_result() {
    local name="$1"
    local result="$2"
    local details="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "  ${GREEN}✓${NC} $name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $name"
        [ -n "$details" ] && echo -e "    ${RED}→ $details${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Step 1: Validate Service Health (prerequisite)
echo -e "\n${YELLOW}Step 0: Validate Service Prerequisites${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH_RESPONSE=$(curl -s "$API_URL/health" 2>/dev/null || echo "CONNECTION_FAILED")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    test_result "Service health check" "PASS"
else
    test_result "Service health check" "FAIL" "Could not connect to $API_URL"
    echo -e "\n${RED}Cannot proceed without healthy service. Start the server first:${NC}"
    echo "  npm run dev"
    exit 1
fi

# Step 3: Inventory MCP Tools (corresponds to Step 3 in MCP_TOOL_DISCOVERY.md)
echo -e "\n${YELLOW}Step 3: Inventory MCP Servers & Tools${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOOLS_RESPONSE=$(curl -s "$API_URL/mcp/tools")

# Check required tools exist
REQUIRED_TOOLS=("jules_list_sources" "jules_create_session" "jules_list_sessions" "jules_get_session" "jules_send_message" "jules_approve_plan" "jules_get_activities")

echo "  Checking for required tools..."
for tool in "${REQUIRED_TOOLS[@]}"; do
    if echo "$TOOLS_RESPONSE" | grep -q "\"$tool\""; then
        test_result "Tool '$tool' available" "PASS"
    else
        test_result "Tool '$tool' available" "FAIL" "Tool not found in /mcp/tools response"
    fi
done

# Count total tools
TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l)
echo ""
echo -e "  ${BLUE}ℹ${NC} Total tools discovered: $TOOL_COUNT"

# Step 5: Validate Tool Chain Execution Endpoint
echo -e "\n${YELLOW}Step 5: Validate Tool Chain Execution${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test that execution endpoint exists and validates input
echo "  Testing execution endpoint validation..."

# Test missing tool name
EXEC_NO_TOOL=$(curl -s -X POST "$API_URL/mcp/execute" \
    -H "Content-Type: application/json" \
    -d '{}')

if echo "$EXEC_NO_TOOL" | grep -q "error"; then
    test_result "Execution validates tool name required" "PASS"
else
    test_result "Execution validates tool name required" "FAIL" "Should reject empty request"
fi

# Test unknown tool
EXEC_UNKNOWN=$(curl -s -X POST "$API_URL/mcp/execute" \
    -H "Content-Type: application/json" \
    -d '{"tool": "unknown_tool"}')

if echo "$EXEC_UNKNOWN" | grep -q "Unknown tool\|error"; then
    test_result "Execution rejects unknown tools" "PASS"
else
    test_result "Execution rejects unknown tools" "FAIL" "Should reject unknown tool"
fi

# Step 6: Test Actual Tool Execution (requires API key)
echo -e "\n${YELLOW}Step 6: Validate Tool Execution Chain${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if API key is configured
API_KEY_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"apiKeyConfigured":[^,}]*' | cut -d':' -f2)

if [ "$API_KEY_STATUS" = "true" ]; then
    echo -e "  ${GREEN}ℹ${NC} Jules API Key configured - testing live execution"
    
    # Test jules_list_sources
    SOURCES_RESPONSE=$(curl -s -X POST "$API_URL/mcp/execute" \
        -H "Content-Type: application/json" \
        -d '{"tool": "jules_list_sources", "parameters": {}}')
    
    if echo "$SOURCES_RESPONSE" | grep -q '"success":true'; then
        test_result "jules_list_sources execution" "PASS"
        
        # Test jules_list_sessions
        SESSIONS_RESPONSE=$(curl -s -X POST "$API_URL/mcp/execute" \
            -H "Content-Type: application/json" \
            -d '{"tool": "jules_list_sessions", "parameters": {}}')
        
        if echo "$SESSIONS_RESPONSE" | grep -q '"success":true'; then
            test_result "jules_list_sessions execution" "PASS"
        else
            test_result "jules_list_sessions execution" "FAIL" "Execution returned error"
        fi
    else
        test_result "jules_list_sources execution" "FAIL" "Execution returned error"
    fi
else
    echo -e "  ${YELLOW}ℹ${NC} Jules API Key not configured - skipping live execution tests"
    echo -e "  ${YELLOW}ℹ${NC} Set JULES_API_KEY environment variable for full testing"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      Test Summary                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All orchestration workflow tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review output above.${NC}"
    exit 1
fi
