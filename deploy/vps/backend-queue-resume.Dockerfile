# Keep the exact production runtime and replace only the two compiled queue
# workers changed by this rollout.
ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/dist/services/QuarkClinicServices/QuarkNotificationWorker.js ./dist/services/QuarkClinicServices/QuarkNotificationWorker.js
COPY backend/dist/services/MessagingServices/dispatcher.js ./dist/services/MessagingServices/dispatcher.js
RUN node --check dist/services/QuarkClinicServices/QuarkNotificationWorker.js \
  && node --check dist/services/MessagingServices/dispatcher.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
