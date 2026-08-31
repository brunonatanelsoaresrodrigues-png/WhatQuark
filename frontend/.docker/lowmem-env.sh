#!/bin/sh
set -eu

env_json="$(jq -cn \
    --arg backend "${VITE_BACKEND_URL:?VITE_BACKEND_URL is required}" \
    --arg quarkClinic "${VITE_QUARK_CLINIC_URL:-https://ng.quarkclinic.com.br/}" \
    '{VITE_BACKEND_URL: $backend, VITE_QUARK_CLINIC_URL: $quarkClinic}')"
printf 'window.ENV=%s;\n' "$env_json" > "${PUBLIC_HTML}/runtime-config.js"
