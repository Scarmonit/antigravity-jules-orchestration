#!/bin/bash
# scripts/test-live-mcp.sh
# Test the live Jules MCP Server endpoints

API_URL="https://antigravity-jules-orchestration.onrender.com"

echo "🔍 Testing Jules MCP Server at $API_URL"
echo "======================================="

# 1. Test Root
echo "1. Checking Service Metadata..."
ROOT_RESPONSE=$(curl -s "$API_URL/")
echo "   Response: $ROOT_RESPONSE"
if echo "$ROOT_RESPONSE" | grep -q "Jules MCP Server"; then
    echo "✅ Metadata OK"
else
    echo "❌ Metadata Failed"
fi

# 2. Test Health
echo "2. Checking Health..."
HEALTH=$(curl -s "$API_URL/health")
echo "   Response: $HEALTH"
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "✅ Health OK"
else
    echo "❌ Health Check Failed"
fi

# 3. List Tools
echo "3. Listing MCP Tools..."
TOOLS=$(curl -s "$API_URL/mcp/tools")
echo "   Response (first 100 chars): $(echo $TOOLS | cut -c 1-100)..."
if echo "$TOOLS" | grep -q "jules_create_session"; then
    echo "✅ Tools List OK"
else
    echo "❌ Tools List Failed"
fi

# 4. Simulate Tool Execution (List Sessions)
echo "4. Testing Tool Execution (jules_list_sessions)..."
EXEC_RESPONSE=$(curl -s -X POST "$API_URL/mcp/execute" \
  -H "Content-Type: application/json" \
  -d '{ 
    "name": "jules_list_sessions", 
    "arguments": {} 
  }')

echo "   Response: $EXEC_RESPONSE"

if echo "$EXEC_RESPONSE" | grep -q "content"; then
    echo "✅ Tool Execution OK"
elif echo "$EXEC_RESPONSE" | grep -q "error"; then
    echo "⚠️  Tool Execution Error (Expected if Auth fails): $EXEC_RESPONSE"
else
    echo "❌ Tool Execution Failed (Unknown response)"
fi

echo ""
echo "🚀 Test Complete"