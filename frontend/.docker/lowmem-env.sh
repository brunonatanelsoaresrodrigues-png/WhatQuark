#!/bin/sh
set -eu

env_json="$(jq -cn \
    --arg backend "${VITE_BACKEND_URL:?VITE_BACKEND_URL is required}" \
    --arg quarkClinic "${VITE_QUARK_CLINIC_URL:-https://ng.quarkclinic.com.br/}" \
    '{VITE_BACKEND_URL: $backend, VITE_QUARK_CLINIC_URL: $quarkClinic}')"
escaped="$(printf '%s' "$env_json" | sed -e 's/[\&/]/\\&/g')"

sed -i "s#<noscript id=\"env-insertion-point\"></noscript>#<script>window.ENV=${escaped}</script>#" \
    "${PUBLIC_HTML}/index.html"
