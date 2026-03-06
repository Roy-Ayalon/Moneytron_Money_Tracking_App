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

# -- Configuration ------------------------------------------------------------
PROJECT_ID="moneytron-488817"
REGION="europe-west1"
SERVICE_NAME="moneytron"
BUCKET_NAME="moneytron-data-${PROJECT_ID}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/moneytron-repo/moneytron"

# -- Validate config ----------------------------------------------------------
if [[ -z "$PROJECT_ID" ]]; then
  echo ""
  echo "[ERROR] You must set PROJECT_ID in this script first!" >&2
  echo "  Go to https://console.cloud.google.com -> pick or create a project -> copy the Project ID"
  exit 1
fi
if [[ -z "$BUCKET_NAME" ]]; then
  echo ""
  echo "[ERROR] You must set BUCKET_NAME in this script first!" >&2
  echo "  Choose a globally unique name like 'moneytron-data-yourname'"
  exit 1
fi

echo ""
echo "=== MoneyTron GCP Deploy ==="
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Service : $SERVICE_NAME"
echo "Bucket  : $BUCKET_NAME"
echo "Image   : $IMAGE_NAME"
echo ""

# -- One-time setup -----------------------------------------------------------
if [[ "$SKIP_SETUP" == false ]]; then

  echo "[1/7] Setting GCP project..."
  invoke_step "set project" gcloud config set project "$PROJECT_ID"

  echo "[2/7] Enabling required APIs..."
  invoke_step "enable APIs" gcloud services enable \
      run.googleapis.com \
      artifactregistry.googleapis.com \
      cloudbuild.googleapis.com \
      storage.googleapis.com

  echo "[3/7] Creating Artifact Registry repo (if needed)..."
  EXISTING_REPO=$(gcloud artifacts repositories list \
      --location="$REGION" \
      --filter="name:moneytron-repo" \
      --format="value(name)" 2>/dev/null || true)
  if [[ -z "$EXISTING_REPO" ]]; then
    invoke_step "create repo" gcloud artifacts repositories create moneytron-repo \
        --repository-format=docker \
        --location="$REGION" \
        --description="MoneyTron container images"
  else
    echo "  (repo already exists)"
  fi

  echo "[4/7] Creating GCS bucket for user data (if needed)..."
  BUCKET_EXISTS=false
  if gcloud storage buckets describe "gs://${BUCKET_NAME}" --format="value(name)" &>/dev/null; then
    BUCKET_EXISTS=true
    echo "  (bucket already exists)"
  fi
  if [[ "$BUCKET_EXISTS" == false ]]; then
    echo "  Creating bucket gs://${BUCKET_NAME}..."
    invoke_step "create bucket" gcloud storage buckets create "gs://${BUCKET_NAME}" --location="$REGION"
  fi

  echo "[5/7] Uploading existing user data to bucket..."
  if [[ -d "users" ]]; then
    invoke_step "upload users" gcloud storage rsync "users/" "gs://${BUCKET_NAME}/" --recursive
    echo "  Uploaded users/ folder to gs://${BUCKET_NAME}/"
  fi

  echo "[6/7] Configuring Docker auth for Artifact Registry..."
  invoke_step "docker auth" gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

fi

# -- Build & push container (via Cloud Build -- no local Docker needed) -------
echo "[BUILD] Building image with Cloud Build and pushing to Artifact Registry..."
invoke_step "cloud build" gcloud builds submit --tag "$IMAGE_NAME" .

# -- Deploy to Cloud Run ------------------------------------------------------
echo "[DEPLOY] Deploying to Cloud Run..."
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
    --set-env-vars "MONEYTRON_DATA_DIR=/app/users" \
    --execution-environment gen2 \
    --clear-volumes \
    --clear-volume-mounts \
    --add-volume "name=user-data,type=cloud-storage,bucket=${BUCKET_NAME}" \
    --add-volume-mount "volume=user-data,mount-path=/app/users"

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
