# Keep the VPS nginx configuration and runtime public environment injection.
ARG FRONTEND_BASE_IMAGE
FROM ${FRONTEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
COPY frontend/build/ /usr/share/nginx/html/
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
