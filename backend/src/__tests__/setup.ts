// These keys are for isolated tests only, never production configuration.
process.env.JWT_SECRET = "test-only-access-secret-not-for-production-0001";
process.env.JWT_REFRESH_SECRET =
  "test-only-refresh-secret-not-for-production-0002";
