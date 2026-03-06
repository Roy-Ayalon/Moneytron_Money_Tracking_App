# ============================================================================
# MoneyTron - Deploy to Google Cloud Run (with persistent user data)
# ============================================================================
# Run this from the project root in PowerShell.
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud) installed  - https://cloud.google.com/sdk/docs/install
#   2. Docker Desktop installed             - https://www.docker.com/products/docker-desktop/
#   3. A GCP project with billing enabled
#
# Usage:
#   .\deploy.ps1                           # first time - full setup
#   .\deploy.ps1 -SkipSetup                # redeploy only (after code changes)
# ============================================================================

param(
    [switch]$SkipSetup
)

# NOTE: Do NOT use $ErrorActionPreference = "Stop" globally.
# gcloud/gsutil write informational messages to stderr, and PowerShell treats
# any stderr output from native commands as a terminating error when
# ErrorActionPreference is Stop. Instead we check $LASTEXITCODE after each call.

# -- Helper: run a command, print stderr as warnings, abort on non-zero exit --
function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command 2>&1 | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                Write-Host "  $_" -ForegroundColor DarkYellow
            } else {
                Write-Output $_
            }
        }
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            Write-Host "`n[ERROR] '$Label' failed with exit code $LASTEXITCODE" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } finally {
        $ErrorActionPreference = $oldPref
    }
}

# -- Configuration -----------------------------------------------------------
$PROJECT_ID   = "moneytron-488817"
$REGION       = "europe-west1"
$SERVICE_NAME = "moneytron"
$BUCKET_NAME  = "moneytron-data-${PROJECT_ID}"
$IMAGE_NAME   = "${REGION}-docker.pkg.dev/${PROJECT_ID}/moneytron-repo/moneytron"

# -- Validate config ---------------------------------------------------------
if (-not $PROJECT_ID) {
    Write-Host "`n[ERROR] You must set `$PROJECT_ID in this script first!" -ForegroundColor Red
    Write-Host "  Go to https://console.cloud.google.com -> pick or create a project -> copy the Project ID" -ForegroundColor Yellow
    exit 1
}
if (-not $BUCKET_NAME) {
    Write-Host "`n[ERROR] You must set `$BUCKET_NAME in this script first!" -ForegroundColor Red
    Write-Host "  Choose a globally unique name like 'moneytron-data-yourname'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== MoneyTron GCP Deploy ===" -ForegroundColor Cyan
Write-Host "Project : $PROJECT_ID"
Write-Host "Region  : $REGION"
Write-Host "Service : $SERVICE_NAME"
Write-Host "Bucket  : $BUCKET_NAME"
Write-Host "Image   : $IMAGE_NAME"
Write-Host ""

# -- One-time setup -----------------------------------------------------------
if (-not $SkipSetup) {
    Write-Host "[1/7] Setting GCP project..." -ForegroundColor Green
    Invoke-Step "set project" { gcloud config set project $PROJECT_ID }

    Write-Host "[2/7] Enabling required APIs..." -ForegroundColor Green
    Invoke-Step "enable APIs" {
        gcloud services enable `
            run.googleapis.com `
            artifactregistry.googleapis.com `
            cloudbuild.googleapis.com `
            storage.googleapis.com
    }

    Write-Host "[3/7] Creating Artifact Registry repo (if needed)..." -ForegroundColor Green
    $ErrorActionPreference = "Continue"
    $existingRepo = gcloud artifacts repositories list --location=$REGION --filter="name:moneytron-repo" --format="value(name)" 2>&1 |
        Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
    if (-not $existingRepo) {
        Invoke-Step "create repo" {
            gcloud artifacts repositories create moneytron-repo `
                --repository-format=docker `
                --location=$REGION `
                --description="MoneyTron container images"
        }
    } else {
        Write-Host "  (repo already exists)" -ForegroundColor DarkGray
    }

    Write-Host "[4/7] Creating GCS bucket for user data (if needed)..." -ForegroundColor Green
    # First, try to check if bucket exists - but don't fail if network issues occur
    $ErrorActionPreference = "Continue"
    $bucketExists = $false
    try {
        $existingBucketCheck = gcloud storage buckets describe "gs://${BUCKET_NAME}" --format="value(name)" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $bucketExists = $true
            Write-Host "  (bucket already exists)" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  (checking bucket existence failed, will attempt to create)" -ForegroundColor DarkYellow
    }
    
    if (-not $bucketExists) {
        Write-Host "  Creating bucket gs://${BUCKET_NAME}..." -ForegroundColor DarkGray
        Invoke-Step "create bucket" { 
            gcloud storage buckets create "gs://${BUCKET_NAME}" --location=$REGION 
        }
    }

    Write-Host "[5/7] Uploading existing user data to bucket..." -ForegroundColor Green
    if (Test-Path "users") {
        Invoke-Step "upload users" { 
            gcloud storage rsync "users/" "gs://${BUCKET_NAME}/" --recursive 
        }
        Write-Host "  Uploaded users/ folder to gs://${BUCKET_NAME}/" -ForegroundColor DarkGray
    }

    Write-Host "[6/7] Configuring Docker auth for Artifact Registry..." -ForegroundColor Green
    Invoke-Step "docker auth" { gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet }
}

# -- Build & push container (via Cloud Build -- no local Docker needed) -------
Write-Host "[BUILD] Building image with Cloud Build and pushing to Artifact Registry..." -ForegroundColor Green
Invoke-Step "cloud build" {
    gcloud builds submit --tag $IMAGE_NAME .
}

# -- Deploy to Cloud Run ------------------------------------------------------
Write-Host "[DEPLOY] Deploying to Cloud Run..." -ForegroundColor Green

Invoke-Step "cloud run deploy" {
    gcloud run deploy $SERVICE_NAME `
        --image $IMAGE_NAME `
        --region $REGION `
        --platform managed `
        --allow-unauthenticated `
        --port 8080 `
        --memory 512Mi `
        --cpu 1 `
        --min-instances 0 `
        --max-instances 3 `
        --set-env-vars "MONEYTRON_DATA_DIR=/app/users" `
        --execution-environment gen2 `
        --clear-volumes `
        --clear-volume-mounts `
        --add-volume "name=user-data,type=cloud-storage,bucket=${BUCKET_NAME}" `
        --add-volume-mount "volume=user-data,mount-path=/app/users"
}

# -- Get URL ------------------------------------------------------------------
Write-Host "`n[DONE] Fetching service URL..." -ForegroundColor Green
$ErrorActionPreference = "Continue"
$URL = gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)" 2>&1 |
    Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  MoneyTron is LIVE!" -ForegroundColor Green
Write-Host "  URL: $URL" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nShare this URL with friends and family!"
Write-Host "Each person logs in with their own username - data is separate per user."
Write-Host ""
