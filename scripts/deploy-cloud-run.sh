#!/usr/bin/env bash
# Deploy StayOps to Cloud Run: the Next.js app + the ADK agent service, wired together.
#
# Usage:
#   GCP_PROJECT=<your-gcp-project-id> ./scripts/deploy-cloud-run.sh
#
# Prereqs: gcloud authenticated (`gcloud auth login`), billing-enabled project.
# Reads PHOENIX_* and Gmail values from env or .env.local so integrations work in prod.
set -euo pipefail

# gcloud may not be on PATH (this machine keeps the SDK in ~/Documents).
if ! command -v gcloud >/dev/null 2>&1; then
  for sdk in "$HOME/Documents/google-cloud-sdk/bin" "$HOME/google-cloud-sdk/bin"; do
    [ -x "$sdk/gcloud" ] && export PATH="$sdk:$PATH" && break
  done
fi
command -v gcloud >/dev/null 2>&1 || { echo "gcloud not found - install the Google Cloud SDK first."; exit 1; }

PROJECT="${GCP_PROJECT:-}"
REGION="${GCP_REGION:-us-central1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -n "$PROJECT" ] || { echo "GCP_PROJECT is required. Usage: GCP_PROJECT=<your-gcp-project-id> ./scripts/deploy-cloud-run.sh"; exit 1; }

read_env() {
  local name="$1"
  if [ -n "${!name:-}" ]; then
    printf '%s' "${!name}"
    return
  fi
  if [ -f "$ROOT/.env.local" ]; then
    grep -E "^${name}=" "$ROOT/.env.local" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
  fi
}

APP_ENV_VARS="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash,EVAL_API_ENABLED=1,GMAIL_OAUTH_SHOW_TOKEN=false"
append_app_env_if_present() {
  local name="$1"
  local value
  value="$(read_env "$name")"
  if [ -n "$value" ]; then
    APP_ENV_VARS="$APP_ENV_VARS,$name=$value"
  fi
}

# ---- Optional: Cloud SQL (Postgres + pgvector) persistent learning ----
# Without these, learning lives in container-local SQLite (lost on cold start).
# One-time instance setup (run once, ~10 min):
#   gcloud sql instances create stayops-pg --project $PROJECT --region $REGION \
#     --database-version=POSTGRES_16 --tier=db-f1-micro
#   gcloud sql databases create stayops --instance stayops-pg --project $PROJECT
#   gcloud sql users set-password postgres --instance stayops-pg --project $PROJECT --password '<PASS>'
# Then export before running this script:
#   export CLOUD_SQL_INSTANCE="$PROJECT:$REGION:stayops-pg"
#   export DATABASE_URL='postgresql://postgres:<PASS>@/stayops?host=/cloudsql/'"$CLOUD_SQL_INSTANCE"
# The app runs CREATE EXTENSION IF NOT EXISTS vector automatically.
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-}"
DATABASE_URL="${DATABASE_URL:-}"
SQL_DEPLOY_FLAGS=()
if [ -n "$CLOUD_SQL_INSTANCE" ] && [ -n "$DATABASE_URL" ]; then
  SQL_DEPLOY_FLAGS=(--add-cloudsql-instances "$CLOUD_SQL_INSTANCE")
  echo "==> Cloud SQL persistence enabled via $CLOUD_SQL_INSTANCE"
else
  echo "==> Cloud SQL not configured (CLOUD_SQL_INSTANCE/DATABASE_URL unset) - learning persists per-container only"
fi

for name in PHOENIX_COLLECTOR_ENDPOINT PHOENIX_API_KEY GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REDIRECT_URI GMAIL_REFRESH_TOKEN DATABASE_URL; do
  append_app_env_if_present "$name"
done

echo "==> [0/3] One-time setup: APIs + Cloud Build permissions for the default compute SA ..."
echo "==> Target project: $PROJECT"
echo "==> Active account: $(gcloud config get-value account 2>/dev/null || echo unknown)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project "$PROJECT"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
if ! gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role roles/cloudbuild.builds.builder --condition=None >/dev/null; then
  echo ""
  echo "Could not update Cloud Build IAM for project $PROJECT."
  echo "   Your active gcloud account may not have resourcemanager.projects.setIamPolicy."
  echo "   If the deploy fails during Cloud Build, ask a project Owner to run:"
  echo "   gcloud projects add-iam-policy-binding $PROJECT \\"
  echo "     --member serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \\"
  echo "     --role roles/cloudbuild.builds.builder --condition=None"
  echo ""
fi

echo "==> [1/3] Deploying Next.js app (stayops) ..."
gcloud run deploy stayops \
  --source "$ROOT" \
  --project "$PROJECT" --region "$REGION" \
  --allow-unauthenticated \
  --max-instances 1 --memory 1Gi --timeout 300 \
  --update-env-vars "$APP_ENV_VARS" \
  ${SQL_DEPLOY_FLAGS[@]+"${SQL_DEPLOY_FLAGS[@]}"} \
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
echo "Done."
echo "   Hosted URL (submission): $APP_URL"
echo "   ADK service:             $ADK_URL"
echo ""
echo "Smoke test:"
echo "  curl -s $ADK_URL/health"
echo "  curl -s -X POST $APP_URL/api/audit/BKG-2026-0718-ACME | head -c 400"
