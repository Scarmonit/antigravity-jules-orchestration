#!/bin/bash
# Post-deployment verification script
# Run this after Render deployment completes

set -e

echo "🔍 Verifying Render Deployment..."
echo ""

# Configuration
SERVICE_URL="${1:-https://jules-orchestrator.onrender.com}"
TIMEOUT=10

echo "📡 Service URL: $SERVICE_URL"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$SERVICE_URL/api/v1/health" || echo "000")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HEALTH_CODE" = "200" ]; then
    echo "   ✅ Health check passed (HTTP $HEALTH_CODE)"
    echo "   Response: $HEALTH_BODY"
else
    echo "   ❌ Health check failed (HTTP $HEALTH_CODE)"
    echo "   Response: $HEALTH_BODY"
fi

echo ""

# Test 2: Database Connection
echo "2️⃣  Testing Database Endpoint..."
DB_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$SERVICE_URL/api/v1/health/db" || echo "000")
DB_CODE=$(echo "$DB_RESPONSE" | tail -n1)
DB_BODY=$(echo "$DB_RESPONSE" | head -n-1)

if [ "$DB_CODE" = "200" ]; then
    echo "   ✅ Database connection OK (HTTP $DB_CODE)"
    echo "   Response: $DB_BODY"
else
    echo "   ⚠️  Database check: HTTP $DB_CODE"
    echo "   Response: $DB_BODY"
fi

echo ""

# Test 3: Redis Connection  
echo "3️⃣  Testing Redis Endpoint..."
REDIS_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$SERVICE_URL/api/v1/health/redis" || echo "000")
REDIS_CODE=$(echo "$REDIS_RESPONSE" | tail -n1)
REDIS_BODY=$(echo "$REDIS_RESPONSE" | head -n-1)

if [ "$REDIS_CODE" = "200" ]; then
    echo "   ✅ Redis connection OK (HTTP $REDIS_CODE)"
    echo "   Response: $REDIS_BODY"
else
    echo "   ⚠️  Redis check: HTTP $REDIS_CODE"
    echo "   Response: $REDIS_BODY"
fi

echo ""
echo "═════════════════════════════════════"

# Summary
PASSING=0
TOTAL=3

[ "$HEALTH_CODE" = "200" ] && ((PASSING++))
[ "$DB_CODE" = "200" ] && ((PASSING++))
[ "$REDIS_CODE" = "200" ] && ((PASSING++))

echo "📊 Summary: $PASSING/$TOTAL checks passed"

if [ $PASSING -eq $TOTAL ]; then
    echo "🎉 Deployment successful! All systems operational."
    exit 0
elif [ $PASSING -gt 0 ]; then
    echo "⚠️  Partial deployment. Some services need attention."
    exit 1
else
    echo "❌ Deployment failed. Please check Render logs."
    exit 1
fi
