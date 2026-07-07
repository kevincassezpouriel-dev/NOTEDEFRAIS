import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "qr_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

const alg = "HS256";

function secret(): Uint8Array {
  // SESSION_SECRET, si défini, remplace le secret par défaut ci-dessous.
  const s =
    process.env.SESSION_SECRET ||
    "qr-platform-secret-par-defaut-3f8a1c9e7b2d4a6f8e0c1b3d5a7f9e2c";
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [alg] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}
