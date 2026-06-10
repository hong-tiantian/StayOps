#!/usr/bin/env bash
# Deploy StayOps to Cloud Run: the Next.js app + the ADK agent service, wired together.
#
# Usage:
#   ./scripts/deploy-cloud-run.sh
#
# Prereqs: gcloud authenticated (`gcloud auth login`), billing-enabled project.
# Reads PHOENIX_* from .env.local so the Arize Phoenix MCP integration works in prod.
set -euo pipefail

# gcloud may not be on PATH (this machine keeps the SDK in ~/Documents).
if ! command -v gcloud >/dev/null 2>&1; then
  for sdk in "$HOME/Documents/google-cloud-sdk/bin" "$HOME/google-cloud-sdk/bin"; do
    [ -x "$sdk/gcloud" ] && export PATH="$sdk:$PATH" && break
  done
fi
command -v gcloud >/dev/null 2>&1 || { echo "gcloud not found — install the Google Cloud SDK first."; exit 1; }

PROJECT="${GCP_PROJECT:-stayops-498807}"
REGION="${GCP_REGION:-us-central1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Pull Phoenix config from .env.local (never committed).
PHOENIX_COLLECTOR_ENDPOINT="$(grep -E '^PHOENIX_COLLECTOR_ENDPOINT=' "$ROOT/.env.local" | cut -d= -f2-)"
PHOENIX_API_KEY="$(grep -E '^PHOENIX_API_KEY=' "$ROOT/.env.local" | cut -d= -f2-)"
GMAIL_CLIENT_ID="$(grep -E '^GMAIL_CLIENT_ID=' "$ROOT/.env.local" | cut -d= -f2-)"
GMAIL_CLIENT_SECRET="$(grep -E '^GMAIL_CLIENT_SECRET=' "$ROOT/.env.local" | cut -d= -f2-)"
GMAIL_REDIRECT_URI="$(grep -E '^GMAIL_REDIRECT_URI=' "$ROOT/.env.local" | cut -d= -f2-)"
GMAIL_REFRESH_TOKEN="$(grep -E '^GMAIL_REFRESH_TOKEN=' "$ROOT/.env.local" | cut -d= -f2-)"

echo "==> [0/3] One-time setup: APIs + Cloud Build permissions for the default compute SA ..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project "$PROJECT"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role roles/cloudbuild.builds.builder --condition=None >/dev/null

echo "==> [1/3] Deploying Next.js app (stayops) ..."
gcloud run deploy stayops \
  --source "$ROOT" \
  --project "$PROJECT" --region "$REGION" \
  --allow-unauthenticated \
  --max-instances 1 --memory 1Gi --timeout 300 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash,PHOENIX_COLLECTOR_ENDPOINT=$PHOENIX_COLLECTOR_ENDPOINT,PHOENIX_API_KEY=$PHOENIX_API_KEY,GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID,GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET,GMAIL_REDIRECT_URI=$GMAIL_REDIRECT_URI,GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN,GMAIL_OAUTH_SHOW_TOKEN=false" \
  --quiet

APP_URL="$(gcloud run services describe stayops --project "$PROJECT" --region "$REGION" --format 'value(status.url)')"
echo "==> App URL: $APP_URL"

echo "==> [2/3] Deploying ADK agent service (stayops-adk) ..."
gcloud run deploy stayops-adk \
  --source "$ROOT/agent/promise_agent" \
  --project "$PROJECT" --region "$REGION" \
  --allow-unauthenticated \
  --max-instances 1 --memory 512Mi --timeout 300 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,STAYOPS_TOOLS_URL=$APP_URL" \
  --quiet

ADK_URL="$(gcloud run services describe stayops-adk --project "$PROJECT" --region "$REGION" --format 'value(status.url)')"
echo "==> ADK URL: $ADK_URL"

echo "==> [3/3] Pointing the app at the ADK service ..."
gcloud run services update stayops \
  --project "$PROJECT" --region "$REGION" \
  --update-env-vars "ADK_AGENT_URL=$ADK_URL" \
  --quiet

echo ""
echo "✅ Done."
echo "   Hosted URL (submission): $APP_URL"
echo "   ADK service:             $ADK_URL"
echo ""
echo "Smoke test:"
echo "  curl -s $ADK_URL/health"
echo "  curl -s -X POST $APP_URL/api/audit/BKG-2026-0718-ACME | head -c 400"
