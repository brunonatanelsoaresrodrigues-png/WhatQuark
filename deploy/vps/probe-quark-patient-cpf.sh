#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/whaticket

patient_ids="$({
  docker compose --env-file .env -f compose.yaml exec -T mariadb sh -lc \
    'mariadb -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "
      SELECT DISTINCT l.quarkPatientId
      FROM ContactIdentityIssues i
      JOIN ContactQuarkLinks l ON l.contactId=i.contactId AND l.status=\"CONFIRMED\"
      WHERE i.status=\"OPEN\" AND i.type=\"MISSING_CPF\"
      ORDER BY i.lastSeenAt ASC
      LIMIT 5;"'
} | tr '\n' ' ')"

docker compose --env-file .env -f compose.yaml exec -T backend \
  node - $patient_ids <<'NODE'
const { getQuarkConfig } = require("./dist/services/QuarkClinicServices/config");
const { getQuarkPatient } = require("./dist/services/QuarkClinicServices/QuarkClinicClient");

const validCpf = value => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && !/^(\d)\1{10}$/.test(digits);
};

(async () => {
  const config = getQuarkConfig();
  for (const patientId of process.argv.slice(2)) {
    try {
      const patient = await getQuarkPatient(config, patientId);
      const hasCpf = patient && Object.entries(patient).some(
        ([key, value]) => /cpf/i.test(key) && validCpf(value)
      );
      console.log(JSON.stringify({ patientId, found: Boolean(patient), hasCpf: Boolean(hasCpf) }));
    } catch (error) {
      console.log(JSON.stringify({ patientId, error: error && error.name || "Error" }));
    }
  }
})().catch(error => {
  console.error(error && error.name || "Error");
  process.exit(1);
});
NODE
