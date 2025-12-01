#!/bin/bash
# scripts/setup-gcp-auth.sh
# Automate creation of Google Cloud Service Account and JSON Key for Jules Orchestrator

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Jules Orchestrator - Google Cloud Auth Setup${NC}"
echo "==============================================="

# 1. Check for gcloud
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found.${NC}"
    echo "Please install it: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 2. Login check
echo -e "\n${YELLOW}📋 Checking gcloud authentication...${NC}"
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ]; then
    echo "Please login to Google Cloud:"
    gcloud auth login
fi
echo -e "${GREEN}✓ Authenticated as $ACCOUNT${NC}"

# 3. Project Setup
# Use a timestamp to ensure uniqueness if creating new
PROJECT_ID="jules-orchestrator-$(date +%s | tail -c 4)"

echo -e "\n${YELLOW}📦 Project Configuration${NC}"
echo "You can create a new project ($PROJECT_ID) or use an existing one."
read -p "Create new project '$PROJECT_ID'? (y/n): " CREATE_NEW

if [[ "$CREATE_NEW" =~ ^[Yy]$ ]]; then
    echo "Creating project $PROJECT_ID..."
    # Removed --name argument which was causing issues with quotes
    gcloud projects create $PROJECT_ID
    gcloud config set project $PROJECT_ID
else
    read -p "Enter existing Project ID: " EXISTING_ID
    if [ ! -z "$EXISTING_ID" ]; then
        PROJECT_ID=$EXISTING_ID
        gcloud config set project $PROJECT_ID
    else
        echo "No project selected. Exiting."
        exit 1
    fi
fi

# 4. Enable Services
echo -e "\n${YELLOW}🔌 Enabling APIs...${NC}"
# Link billing account if needed (often required for enabling services)
# gcloud beta billing projects link $PROJECT_ID --billing-account=... 

gcloud services enable iam.googleapis.com
echo "Attempting to enable Jules API..."
gcloud services enable jules.googleapis.com || echo "⚠️  Jules API might not be public or requires allowlisting."

# 5. Create Service Account
SA_NAME="jules-agent"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo -e "\n${YELLOW}🤖 Creating Service Account: $SA_NAME${NC}"
if gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
    echo "Service account already exists."
else
    gcloud iam service-accounts create $SA_NAME \
        --description="Service account for Jules Orchestrator automation" \
        --display-name="Jules Agent"
fi

# 6. Create Key
KEY_FILE="jules-service-account-key.json"
echo -e "\n${YELLOW}🔑 Generating JSON Key...${NC}"
# Remove existing key file if it exists to avoid error
rm -f $KEY_FILE

gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SA_EMAIL

echo -e "\n${GREEN}✅ SUCCESS! Key saved to: $KEY_FILE${NC}"
echo "==============================================="
echo -e "${YELLOW}👇 FINAL STEP:${NC}"
echo "1. Open this file: $KEY_FILE"
echo "2. Copy the ENTIRE content."
echo "3. Go to Render Dashboard -> Environment"
echo "4. Add Variable: GOOGLE_APPLICATION_CREDENTIALS_JSON"
echo "5. Paste the content."
echo ""
echo "Your Jules Orchestrator will then be fully authenticated!"