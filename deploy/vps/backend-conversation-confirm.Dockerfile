# Preserve the live messaging runtime and replace only the compiled controller
# that authorizes manual appointment confirmation from the conversation.
ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/dist/controllers/QuarkDashboardController.js ./dist/controllers/QuarkDashboardController.js
RUN node --check dist/controllers/QuarkDashboardController.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
