# Reuse the installed WhatsApp runtime for this rollout. The selected base must
# be the inspected production image; no provider/library upgrade is performed.
ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/package.json backend/package-lock.json backend/tsconfig.json backend/jest.config.js backend/.sequelizerc ./
COPY backend/src ./src
RUN rm -rf /usr/src/app/dist
COPY backend/dist ./dist
RUN node --check dist/server.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
