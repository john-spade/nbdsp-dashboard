#!/bin/bash
# setup-firebase.sh — One-time setup (run once before first deploy)
# Run: chmod +x setup-firebase.sh && ./setup-firebase.sh

set -e

PROJECT_ID="up-demo-9c45f"
REGION="asia-northeast1"

echo "=== Logging in to gcloud ==="
gcloud auth login
gcloud config set project $PROJECT_ID

echo "=== Creating Artifact Registry repository ==="
gcloud artifacts repositories create nbdsp-docker \
  --repository-format=docker \
  --location=$REGION \
  --description="NBDSP Docker images" 2>/dev/null || echo "Repo already exists"

echo "=== Configuring Docker for Artifact Registry ==="
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo "=== Creating secrets in Secret Manager ==="

echo -n "Enter FIREBASE_ADMIN_PROJECT_ID value: "
read -s ADMIN_PROJECT_ID
echo
echo -n "Enter FIREBASE_ADMIN_CLIENT_EMAIL value: "
read -s ADMIN_CLIENT_EMAIL
echo
echo -n "Enter FIREBASE_ADMIN_PRIVATE_KEY value (paste the full key): "
read -s ADMIN_PRIVATE_KEY
echo

echo "$ADMIN_PROJECT_ID" | gcloud secrets create FIREBASE_ADMIN_PROJECT_ID --data-file=- --replication-policy=automatic
echo "$ADMIN_CLIENT_EMAIL" | gcloud secrets create FIREBASE_ADMIN_CLIENT_EMAIL --data-file=- --replication-policy=automatic
echo "$ADMIN_PRIVATE_KEY" | gcloud secrets create FIREBASE_ADMIN_PRIVATE_KEY --data-file=- --replication-policy=automatic

echo "=== Adding Secret Manager secret access to Cloud Run ==="
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${ADMIN_CLIENT_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" 2>/dev/null || echo "IAM binding may already exist"

echo "=== Done! Secrets created and Cloud Run service account can access them. ==="
echo "Now run ./deploy.sh to deploy the app."