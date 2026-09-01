# Preserve the complete live backend and replace only the compiled dispatcher.
ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/dist/services/MessagingServices/dispatcher.js ./dist/services/MessagingServices/dispatcher.js
RUN node --check dist/services/MessagingServices/dispatcher.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
