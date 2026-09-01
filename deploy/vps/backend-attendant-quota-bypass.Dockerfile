ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/src/services/MessagingServices/dispatcher.ts ./src/services/MessagingServices/dispatcher.ts
RUN ./node_modules/.bin/tsc \
  && node --check dist/services/MessagingServices/dispatcher.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
