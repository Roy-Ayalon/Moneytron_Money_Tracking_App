#!/usr/bin/env bash
# ============================================================================
# MoneyTron - Deploy to Google Cloud Run (with persistent user data)
# ============================================================================
# Run this from the project root:
#   chmod +x deploy.sh   (first time only)
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud) installed  - https://cloud.google.com/sdk/docs/install
#   2. Docker Desktop installed             - https://www.docker.com/products/docker-desktop/
#   3. A GCP project with billing enabled
#
# Usage:
#   ./deploy.sh                    # first time – full setup
#   ./deploy.sh -SkipSetup         # redeploy only (after code changes)
#
# Optional env vars:
#   MONEYTRON_PROJECT_ID=<gcp-project-id>
#   MONEYTRON_REGION=europe-west1
#   MONEYTRON_SERVICE_NAME=moneytron
#   MONEYTRON_REPO_NAME=moneytron-repo
#   MONEYTRON_BUCKET_NAME=moneytron-data-<project>
#   MONEYTRON_ENABLE_BUCKET_BACKUP=true|false
#   MONEYTRON_ENABLE_MONITORING=true|false
#   MONEYTRON_ALERT_EMAIL=alerts@example.com
# ============================================================================

set -euo pipefail

# -- Source gcloud SDK if installed but not on PATH ---------------------------
# Common install locations on macOS
for _gcdir in "$HOME/google-cloud-sdk" \
              "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk" \
              "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk" \
              "/usr/local/google-cloud-sdk" \
              "/opt/google-cloud-sdk"; do
  if [[ -f "${_gcdir}/path.bash.inc" ]]; then
    source "${_gcdir}/path.bash.inc"
    break
  fi
done
unset _gcdir

# -- Parse flags --------------------------------------------------------------
SKIP_SETUP=false
for arg in "$@"; do
  case "$arg" in
    -SkipSetup|--skip-setup|-skipsetup) SKIP_SETUP=true ;;
    *) echo "[WARN] Unknown argument: $arg" ;;
  esac
done

# -- Preflight: ensure gcloud is available (auto-install if missing) ----------
if ! command -v gcloud &>/dev/null; then
  echo ""
  echo "[INFO] gcloud CLI not found. Attempting automatic installation..."

  # Try Homebrew first (fastest on macOS)
  if command -v brew &>/dev/null; then
    echo "[INFO] Installing Google Cloud SDK via Homebrew..."
    brew install --cask google-cloud-sdk
    # Source the newly installed SDK
    for _gcdir in "$(brew --prefix)/Caskroom/google-cloud-sdk/latest/google-cloud-sdk" \
                  "$(brew --prefix)/share/google-cloud-sdk"; do
      if [[ -f "${_gcdir}/path.bash.inc" ]]; then
        source "${_gcdir}/path.bash.inc"
        break
      fi
    done
    unset _gcdir
  else
    # Fallback: official Google installer
    echo "[INFO] Homebrew not found. Installing via Google's official installer..."
    INSTALL_DIR="$HOME/google-cloud-sdk"
    if [[ ! -d "$INSTALL_DIR" ]]; then
      curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir="$HOME"
    fi
    source "$INSTALL_DIR/path.bash.inc"
  fi

  # Final check
  if ! command -v gcloud &>/dev/null; then
    echo ""
    echo "[ERROR] gcloud installation failed or PATH not set." >&2
    echo "  Install manually from: https://cloud.google.com/sdk/docs/install" >&2
    echo "  Then restart your terminal and re-run this script." >&2
    exit 1
  fi
  echo "[INFO] gcloud installed successfully: $(gcloud --version 2>&1 | head -1)"

  # Authenticate
  echo "[INFO] Please log in to your Google Cloud account..."
  gcloud auth login
fi

# -- Helper: run a command, abort on failure ----------------------------------
invoke_step() {
  local label="$1"
  shift
  echo "  ▸ $label"
  if ! "$@"; then
    local rc=$?
    echo ""
    echo "[ERROR] '$label' failed with exit code $rc" >&2
    exit 1
  fi
}

warn_step() {
  local label="$1"
  shift
  echo "  ▸ $label"
  if ! "$@"; then
    local rc=$?
    echo "  [WARN] '$label' failed with exit code $rc (continuing)"
    return 1
  fi
  return 0
}

# -- Configuration ------------------------------------------------------------
PROJECT_ID="${MONEYTRON_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${MONEYTRON_REGION:-europe-west1}"
SERVICE_NAME="${MONEYTRON_SERVICE_NAME:-moneytron}"
REPO_NAME="${MONEYTRON_REPO_NAME:-moneytron-repo}"
BUCKET_NAME="${MONEYTRON_BUCKET_NAME:-moneytron-data-${PROJECT_ID}}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/moneytron"
ENABLE_BUCKET_BACKUP="${MONEYTRON_ENABLE_BUCKET_BACKUP:-true}"
ENABLE_MONITORING="${MONEYTRON_ENABLE_MONITORING:-true}"
ALERT_EMAIL="${MONEYTRON_ALERT_EMAIL:-}"
COOKIE_SECURE="${MONEYTRON_COOKIE_SECURE:-1}"
MAX_UPLOAD_MB="${MONEYTRON_MAX_UPLOAD_MB:-12}"
ALLOWED_ORIGINS="${MONEYTRON_ALLOWED_ORIGINS:-}"

# -- Validate config ----------------------------------------------------------
if [[ -z "$PROJECT_ID" ]]; then
  echo ""
  echo "[ERROR] PROJECT_ID is empty." >&2
  echo "  Set MONEYTRON_PROJECT_ID or run: gcloud config set project <PROJECT_ID>"
  exit 1
fi
if [[ -z "$BUCKET_NAME" ]]; then
  echo ""
  echo "[ERROR] BUCKET_NAME is empty." >&2
  echo "  Set MONEYTRON_BUCKET_NAME to a globally unique bucket."
  exit 1
fi

echo ""
echo "=== MoneyTron GCP Deploy ==="
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Service : $SERVICE_NAME"
echo "Repo    : $REPO_NAME"
echo "Bucket  : $BUCKET_NAME"
echo "Image   : $IMAGE_NAME"
echo "Backup  : $ENABLE_BUCKET_BACKUP"
echo "Monitor : $ENABLE_MONITORING"
echo "CookieS : $COOKIE_SECURE"
echo "UploadMB: $MAX_UPLOAD_MB"
echo ""

# -- One-time setup -----------------------------------------------------------
if [[ "$SKIP_SETUP" == false ]]; then

  echo "[1/9] Setting GCP project..."
  invoke_step "set project" gcloud config set project "$PROJECT_ID"

  echo "[2/9] Enabling required APIs..."
  invoke_step "enable APIs" gcloud services enable \
      run.googleapis.com \
      artifactregistry.googleapis.com \
      cloudbuild.googleapis.com \
      storage.googleapis.com \
      monitoring.googleapis.com \
      logging.googleapis.com

  echo "[3/9] Creating Artifact Registry repo (if needed)..."
  EXISTING_REPO=$(gcloud artifacts repositories list \
      --location="$REGION" \
      --filter="name:${REPO_NAME}" \
      --format="value(name)" 2>/dev/null || true)
  if [[ -z "$EXISTING_REPO" ]]; then
    invoke_step "create repo" gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="MoneyTron container images"
  else
    echo "  (repo already exists)"
  fi

  echo "[4/9] Creating GCS bucket for user data (if needed)..."
  BUCKET_EXISTS=false
  if gcloud storage buckets describe "gs://${BUCKET_NAME}" --format="value(name)" &>/dev/null; then
    BUCKET_EXISTS=true
    echo "  (bucket already exists)"
  fi
  if [[ "$BUCKET_EXISTS" == false ]]; then
    echo "  Creating bucket gs://${BUCKET_NAME}..."
    invoke_step "create bucket" gcloud storage buckets create "gs://${BUCKET_NAME}" --location="$REGION"
  fi

  if [[ "${ENABLE_BUCKET_BACKUP,,}" == "true" ]]; then
    echo "[5/9] Enabling bucket versioning + lifecycle backup policy..."
    invoke_step "enable bucket versioning" gcloud storage buckets update "gs://${BUCKET_NAME}" --versioning
    lifecycle_file="$(mktemp)"
    cat > "$lifecycle_file" <<'EOF'
{
  "rule": [
    {
      "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
      "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] }
    },
    {
      "action": { "type": "Delete" },
      "condition": { "isLive": false, "age": 90 }
    }
  ]
}
EOF
    invoke_step "apply bucket lifecycle" gcloud storage buckets update "gs://${BUCKET_NAME}" --lifecycle-file="$lifecycle_file"
    rm -f "$lifecycle_file"
  fi

  echo "[6/9] Uploading existing user data to bucket..."
  if [[ -d "users" ]]; then
    invoke_step "upload users" gcloud storage rsync "users/" "gs://${BUCKET_NAME}/" --recursive
    echo "  Uploaded users/ folder to gs://${BUCKET_NAME}/"
  fi

  echo "[7/9] Configuring Docker auth for Artifact Registry..."
  invoke_step "docker auth" gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

fi

# -- Build & push container (via Cloud Build -- no local Docker needed) -------
echo "[BUILD] Building image with Cloud Build and pushing to Artifact Registry..."
invoke_step "cloud build" gcloud builds submit --tag "$IMAGE_NAME" .

# -- Deploy to Cloud Run ------------------------------------------------------
echo "[DEPLOY] Deploying to Cloud Run..."
ENV_VARS="MONEYTRON_DATA_DIR=/app/users,MONEYTRON_COOKIE_SECURE=${COOKIE_SECURE},MONEYTRON_MAX_UPLOAD_MB=${MAX_UPLOAD_MB}"
if [[ -n "$ALLOWED_ORIGINS" ]]; then
  ENV_VARS="${ENV_VARS},MONEYTRON_ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
fi
invoke_step "cloud run deploy" gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "$ENV_VARS" \
    --execution-environment gen2 \
    --clear-volumes \
    --clear-volume-mounts \
    --add-volume "name=user-data,type=cloud-storage,bucket=${BUCKET_NAME}" \
    --add-volume-mount "volume=user-data,mount-path=/app/users"

if [[ "${ENABLE_MONITORING,,}" == "true" ]]; then
  echo "[MONITORING] Configuring baseline alert policy for 5xx spikes (best effort)..."
  channel_arg=""
  if [[ -n "$ALERT_EMAIL" ]]; then
    warn_step "ensure monitoring email channel" gcloud alpha monitoring channels create \
      --display-name="MoneyTron Alerts" \
      --type=email \
      --channel-labels="email_address=${ALERT_EMAIL}"
    CHANNEL_ID="$(gcloud alpha monitoring channels list \
      --filter="type=\"email\" AND labels.email_address=\"${ALERT_EMAIL}\"" \
      --format="value(name)" 2>/dev/null | head -n1 || true)"
    if [[ -n "$CHANNEL_ID" ]]; then
      channel_arg="\"notificationChannels\": [\"${CHANNEL_ID}\"],"
    fi
  fi

  policy_file="$(mktemp)"
  cat > "$policy_file" <<EOF
{
  "displayName": "MoneyTron Cloud Run 5xx Spike",
  "combiner": "OR",
  ${channel_arg}
  "conditions": [
    {
      "displayName": "5xx responses per minute",
      "conditionThreshold": {
        "filter": "resource.type=\\"cloud_run_revision\\" AND resource.label.\\"service_name\\"=\\"${SERVICE_NAME}\\" AND metric.type=\\"run.googleapis.com/request_count\\" AND metric.label.\\"response_code_class\\"=\\"5xx\\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "120s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "enabled": true
}
EOF
  warn_step "create/update alert policy" gcloud alpha monitoring policies create --policy-from-file="$policy_file"
  rm -f "$policy_file"
fi

# -- Get URL ------------------------------------------------------------------
echo ""
echo "[DONE] Fetching service URL..."
URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)" 2>/dev/null || true)

echo ""
echo "============================================"
echo "  MoneyTron is LIVE!"
echo "  URL: $URL"
echo "============================================"
echo ""
echo "Share this URL with friends and family!"
echo "Each person logs in with their own username - data is separate per user."
echo ""
echo "Staging smoke checklist:"
echo "  1. Open URL and sign up with a test account."
echo "  2. Upload CSV/XLS/XLSX (single and multi-file), verify preview rows."
echo "  3. Save transactions and confirm Summary/Statistics render."
echo "  4. Export data and verify downloaded JSON."
echo "  5. Delete test account and confirm login fails afterwards."
echo "  6. Check Cloud Run logs/metrics for 4xx/5xx spikes."
echo ""
