export const isQuarkPatientNotFound = (error) => {
  if (error?.response?.status !== 404) return false;

  const code = error?.response?.data?.error || error?.response?.data?.message;
  return !code || code === "ERR_QUARK_PATIENT_NOT_FOUND";
};

export const isQuarkPatientAmbiguous = (error) => {
  if (error?.response?.status !== 409) return false;

  const code = error?.response?.data?.error || error?.response?.data?.message;
  return code === "ERR_QUARK_PATIENT_AMBIGUOUS";
};
