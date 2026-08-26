const production = process.env.NODE_ENV === "production";
const secret = process.env.JWT_SECRET || "mysecret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "myanothersecret";

if (
  production &&
  (secret.length < 32 || refreshSecret.length < 32 || secret === refreshSecret)
) {
  throw new Error(
    "JWT_SECRET and JWT_REFRESH_SECRET must be distinct and at least 32 characters in production"
  );
}

export default {
  secret,
  expiresIn: "15m",
  refreshSecret,
  refreshExpiresIn: "7d"
};
