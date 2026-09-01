ARG BASE_IMAGE=whaticket-backend:cpf-overlay-20260830-005941
FROM ${BASE_IMAGE}

WORKDIR /usr/src/app

COPY backend/dist/helpers/ContactIdentity.js dist/helpers/ContactIdentity.js
COPY backend/dist/services/ContactServices/CreateOrUpdateContactService.js dist/services/ContactServices/CreateOrUpdateContactService.js
COPY backend/dist/providers/WhatsApp/Implementations/whaileys.js dist/providers/WhatsApp/Implementations/whaileys.js

RUN node --check dist/helpers/ContactIdentity.js \
  && node --check dist/services/ContactServices/CreateOrUpdateContactService.js \
  && node --check dist/providers/WhatsApp/Implementations/whaileys.js
