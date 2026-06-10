#!/bin/bash
# deploy.sh — Build and deploy to Firebase Hosting + Cloud Run (no GitHub needed)
# Run: chmod +x deploy.sh && ./deploy.sh

set -e

PROJECT_ID="up-demo-9c45f"
REGION="asia-northeast1"
SERVICE_NAME="nbdsp"
ARTIFACT_REPO="nbdsp-docker"

echo "=== Building Next.js app ==="
npm run build

echo "=== Building Docker image ==="
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$COMMIT_SHA $(pwd)
docker tag gcr.io/$PROJECT_ID/$SERVICE_NAME:$COMMIT_SHA gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

echo "=== Pushing to Artifact Registry ==="
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$COMMIT_SHA
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

echo "=== Deploying to Cloud Run ==="
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --set-secrets "FIREBASE_ADMIN_PROJECT_ID=FIREBASE_ADMIN_PROJECT_ID:latest" \
  --set-secrets "FIREBASE_ADMIN_CLIENT_EMAIL=FIREBASE_ADMIN_CLIENT_EMAIL:latest" \
  --set-secrets "FIREBASE_ADMIN_PRIVATE_KEY=FIREBASE_ADMIN_PRIVATE_KEY:latest"

echo "=== Deploying Firestore rules ==="
firebase deploy --only firestore

echo "=== Deploying Firebase Hosting ==="
firebase deploy --only hosting

echo "=== Done! ==="
echo "Cloud Run URL: https://$SERVICE_NAME-$COMMIT_HASH-$REGION.run.app"
echo "Hosting URL: https://$PROJECT_ID.web.app"