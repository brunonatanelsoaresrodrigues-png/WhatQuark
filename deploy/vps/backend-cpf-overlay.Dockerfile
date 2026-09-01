# Keep the exact production runtime and replace only the tested Quark CPF path.
ARG BACKEND_BASE_IMAGE
FROM ${BACKEND_BASE_IMAGE}
ARG SOURCE_REVISION=staging
WORKDIR /usr/src/app
COPY backend/dist/services/QuarkClinicServices/appointmentUtils.js ./dist/services/QuarkClinicServices/appointmentUtils.js
COPY backend/dist/services/QuarkClinicServices/QuarkClinicClient.js ./dist/services/QuarkClinicServices/QuarkClinicClient.js
COPY backend/dist/services/QuarkClinicServices/ShowQuarkClinicContactService.js ./dist/services/QuarkClinicServices/ShowQuarkClinicContactService.js
COPY backend/dist/services/QuarkClinicServices/ShowQuarkClinicPatientService.js ./dist/services/QuarkClinicServices/ShowQuarkClinicPatientService.js
RUN node --check dist/services/QuarkClinicServices/appointmentUtils.js \
  && node --check dist/services/QuarkClinicServices/QuarkClinicClient.js \
  && node --check dist/services/QuarkClinicServices/ShowQuarkClinicContactService.js \
  && node --check dist/services/QuarkClinicServices/ShowQuarkClinicPatientService.js
LABEL org.opencontainers.image.revision="${SOURCE_REVISION}"
