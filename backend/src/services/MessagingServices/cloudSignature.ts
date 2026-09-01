import { createHmac, timingSafeEqual } from "crypto";
export const validSignature = (
  body: Buffer,
  signature: string,
  secret: string
): boolean => {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
};
