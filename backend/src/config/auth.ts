import "../bootstrap";

const requiredSecret = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length < 32) {
    throw new Error(`${name} must contain at least 32 characters`);
  }
  return value;
};

const secret = requiredSecret("JWT_SECRET");
const refreshSecret = requiredSecret("JWT_REFRESH_SECRET");
if (secret === refreshSecret) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
}

export default {
  secret,
  expiresIn: "15m",
  refreshSecret,
  refreshExpiresIn: "7d"
};
