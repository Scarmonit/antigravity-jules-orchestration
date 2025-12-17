#!/bin/bash
# scripts/wait-for-deploy.sh
# Waits for version 1.3.1 to be live

API_URL="https://scarmonit.com"
TARGET_VERSION="1.3.1"

echo "⏳ Waiting for deployment of version $TARGET_VERSION at $API_URL..."

while true; do
    RESPONSE=$(curl -s "$API_URL/")
    CURRENT_VERSION=$(echo $RESPONSE | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$CURRENT_VERSION" == "$TARGET_VERSION" ]; then
        echo "✅ Deployed! Current version: $CURRENT_VERSION"
        echo "Response: $RESPONSE"
        break
    fi
    
    echo "   Current version: $CURRENT_VERSION. Retrying in 10s..."
    sleep 10
done

echo ""
echo "🚀 Running full test suite..."
bash scripts/test-live-mcp.sh
