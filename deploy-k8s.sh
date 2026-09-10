#!/usr/bin/env bash
# ==============================================================================
# KB J Capital Intranet — Kubernetes build & deploy
#
# Usage:
#   ./deploy-k8s.sh                          # registry/tag from defaults below
#   DOCKER_REGISTRY=harbor.kbj.local/kbj IMAGE_TAG=1.2.3 ./deploy-k8s.sh
#
# Environment:
#   DOCKER_REGISTRY  image registry prefix        (default registry.example.com/kbj)
#   IMAGE_NAME       repository name              (default intranet)
#   IMAGE_TAG        tag to build and deploy      (default 2.0.0)
#   SKIP_PUSH=1      build + apply only, do not push (local/kind clusters)
#
# Prerequisites: docker, kubectl configured for the target cluster, and
# k8s/secret.yaml created from k8s/secret.example.yaml with real values.
# ==============================================================================
set -euo pipefail

DOCKER_REGISTRY="${DOCKER_REGISTRY:-registry.example.com/kbj}"
IMAGE_NAME="${IMAGE_NAME:-intranet}"
IMAGE_TAG="${IMAGE_TAG:-2.0.0}"
NAMESPACE="kbj-intranet"
KUSTOMIZATION="k8s/kustomization.yaml"
FULL_IMAGE="${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# --- Preflight -----------------------------------------------------------------
for cmd in docker kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' CLI not found in PATH." >&2
    exit 1
  fi
done

if [ ! -f k8s/secret.yaml ]; then
  echo "ERROR: k8s/secret.yaml is missing." >&2
  echo "  cp k8s/secret.example.yaml k8s/secret.yaml" >&2
  echo "  ...then edit it with real DATABASE_URL / SESSION_SECRET / ADMIN_* values." >&2
  echo "  (kustomization.yaml references secret.yaml; never commit the real file.)" >&2
  exit 1
fi

if [ ! -f Dockerfile ] || [ ! -f package.json ]; then
  echo "ERROR: run this script from the repository root (Dockerfile not found)." >&2
  exit 1
fi

echo "================================================================="
echo "KB J Capital Intranet — Kubernetes deployment"
echo "Image: ${FULL_IMAGE}"
echo "================================================================="

# --- 1. Build & push -----------------------------------------------------------
docker build -t "${FULL_IMAGE}" .

if [ "${SKIP_PUSH:-0}" != "1" ]; then
  echo "Pushing image to registry..."
  docker push "${FULL_IMAGE}"
fi

# --- 2. Point kustomize at this image (portable in-place sed) ------------------
sed -E \
  -e "s#^([[:space:]]*newName:).*#\1 ${DOCKER_REGISTRY}/${IMAGE_NAME}#" \
  -e "s#^([[:space:]]*newTag:).*#\1 \"${IMAGE_TAG}\"#" \
  "${KUSTOMIZATION}" > "${KUSTOMIZATION}.tmp"
mv "${KUSTOMIZATION}.tmp" "${KUSTOMIZATION}"

# --- 3. Apply manifests --------------------------------------------------------
echo "Applying Kubernetes manifests via Kustomize..."
kubectl apply -k ./k8s

# --- 4. Wait for rollout -------------------------------------------------------
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/kbj-intranet-portal -n "${NAMESPACE}" --timeout=180s

echo
echo "================================================================="
echo "Deployment completed."
kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=kbj-intranet-portal
echo
echo "REMINDER — bootstrap admin:"
echo "  The pod creates the admin user from kbj-intranet-secret the first"
echo "  time it starts with an empty users store:"
echo "    username: value of ADMIN_USERNAME   (default: admin)"
echo "    password: value of ADMIN_PASSWORD"
echo "  Log in immediately and rotate that password; the secret value itself"
echo "  is only re-read on pod restart, not on every request."
echo "================================================================="
