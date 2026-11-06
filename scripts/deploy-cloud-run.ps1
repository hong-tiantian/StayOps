# Deploy StayOps to Cloud Run from PowerShell: the Next.js app + the ADK agent
# service, wired together. PowerShell-native equivalent of deploy-cloud-run.sh
# (no bash required).
#
# Usage (PowerShell):
#   .\scripts\deploy-cloud-run.ps1 -Project <your-gcp-project-id>
#   # or:  $env:GCP_PROJECT = "<your-gcp-project-id>"; .\scripts\deploy-cloud-run.ps1
#
# Prereqs: gcloud authenticated (`gcloud auth login`), billing-enabled project.
# Reads PHOENIX_* and Gmail values from the environment or .env.local so the
# integrations work in production.

param(
  [string]$Project = $env:GCP_PROJECT,
  [string]$Region  = $(if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $Project) {
  Write-Error "Project is required. Usage: .\scripts\deploy-cloud-run.ps1 -Project <your-gcp-project-id>"
  exit 1
}
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Error "gcloud not found - install the Google Cloud SDK first."
  exit 1
}

# ---- Read non-secret values from .env.local (process env wins) ----------------
$EnvFile = Join-Path $Root ".env.local"
$FileEnv = @{}
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }
    $FileEnv[$t.Substring(0, $idx).Trim()] = $t.Substring($idx + 1).Trim()
  }
}
function Read-EnvVal([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ($v) { return $v }
  if ($FileEnv.ContainsKey($name)) { return $FileEnv[$name] }
  return $null
}

# ---- Build the app env var string --------------------------------------------
$AppEnvPairs = [System.Collections.Generic.List[string]]::new()
$AppEnvPairs.Add("GOOGLE_GENAI_USE_VERTEXAI=true")
$AppEnvPairs.Add("GOOGLE_CLOUD_PROJECT=$Project")
$AppEnvPairs.Add("GOOGLE_CLOUD_LOCATION=global")
$AppEnvPairs.Add("GEMINI_MODEL=gemini-3.5-flash")
$AppEnvPairs.Add("EVAL_API_ENABLED=1")
$AppEnvPairs.Add("GMAIL_OAUTH_SHOW_TOKEN=false")
foreach ($name in @("PHOENIX_COLLECTOR_ENDPOINT","PHOENIX_API_KEY","GMAIL_CLIENT_ID","GMAIL_CLIENT_SECRET","GMAIL_REDIRECT_URI","GMAIL_REFRESH_TOKEN","DATABASE_URL")) {
  $val = Read-EnvVal $name
  if ($val) { $AppEnvPairs.Add("$name=$val") }
}
$AppEnvVars = [string]::Join(",", $AppEnvPairs)

# ---- Optional Cloud SQL (Postgres + pgvector) persistence --------------------
$SqlInstance = Read-EnvVal "CLOUD_SQL_INSTANCE"
$DbUrl       = Read-EnvVal "DATABASE_URL"
$SqlFlags = @()
if ($SqlInstance -and $DbUrl) {
  $SqlFlags = @("--add-cloudsql-instances", $SqlInstance)
  Write-Host "==> Cloud SQL persistence enabled via $SqlInstance"
} else {
  Write-Host "==> Cloud SQL not configured - learning persists per-container only"
}

Write-Host "==> [0/3] Enabling APIs + Cloud Build permissions ..."
Write-Host "==> Target project: $Project"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $Project
$ProjectNumber = (gcloud projects describe $Project --format "value(projectNumber)").Trim()
try {
  gcloud projects add-iam-policy-binding $Project `
    --member "serviceAccount:$ProjectNumber-compute@developer.gserviceaccount.com" `
    --role roles/cloudbuild.builds.builder --condition=None | Out-Null
} catch {
  Write-Host ""
  Write-Host "Could not update Cloud Build IAM for project $Project."
  Write-Host "   If the deploy fails during Cloud Build, ask a project Owner to run:"
  Write-Host "   gcloud projects add-iam-policy-binding $Project --member serviceAccount:$ProjectNumber-compute@developer.gserviceaccount.com --role roles/cloudbuild.builds.builder --condition=None"
  Write-Host ""
}

Write-Host "==> [1/3] Deploying Next.js app (stayops) ..."
$AppArgs = @(
  "run","deploy","stayops",
  "--source", $Root,
  "--project", $Project, "--region", $Region,
  "--allow-unauthenticated",
  "--max-instances","1","--memory","1Gi","--timeout","300",
  "--update-env-vars", $AppEnvVars
) + $SqlFlags + @("--quiet")
gcloud @AppArgs

$AppUrl = (gcloud run services describe stayops --project $Project --region $Region --format "value(status.url)").Trim()
Write-Host "==> App URL: $AppUrl"

Write-Host "==> [2/3] Deploying ADK agent service (stayops-adk) ..."
$AdkEnv = "GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=$Project,GOOGLE_CLOUD_LOCATION=global,STAYOPS_TOOLS_URL=$AppUrl"
$AdkArgs = @(
  "run","deploy","stayops-adk",
  "--source", (Join-Path $Root "agent\promise_agent"),
  "--project", $Project, "--region", $Region,
  "--allow-unauthenticated",
  "--max-instances","1","--memory","512Mi","--timeout","300",
  "--set-env-vars", $AdkEnv,
  "--quiet"
)
gcloud @AdkArgs

$AdkUrl = (gcloud run services describe stayops-adk --project $Project --region $Region --format "value(status.url)").Trim()
Write-Host "==> ADK URL: $AdkUrl"

Write-Host "==> [3/3] Pointing the app at the ADK service ..."
gcloud run services update stayops --project $Project --region $Region --update-env-vars "ADK_AGENT_URL=$AdkUrl" --quiet

Write-Host ""
Write-Host "Done."
Write-Host "   Hosted URL (submission): $AppUrl"
Write-Host "   ADK service:             $AdkUrl"
Write-Host ""
Write-Host "Smoke test:"
Write-Host "  curl.exe -s $AdkUrl/health"
Write-Host "  curl.exe -s -X POST $AppUrl/api/audit/BKG-2026-0718-ACME"
