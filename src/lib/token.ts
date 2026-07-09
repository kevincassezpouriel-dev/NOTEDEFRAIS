import { SignJWT, jwtVerify } from "jose";

/**
 * Jetons d'action signés, à usage public sans connexion admin : ils portent
 * le bouton « Publier » 1-clic des e-mails de validation. Portée limitée
 * (une action, un objet) et durée de vie courte.
 */

function secret(): Uint8Array {
  const s =
    process.env.SESSION_SECRET ||
    "qr-platform-secret-par-defaut-3f8a1c9e7b2d4a6f8e0c1b3d5a7f9e2c";
  return new TextEncoder().encode(s);
}

export async function createActionToken(
  action: string,
  id: string,
  ttlSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  return new SignJWT({ action, id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}

export async function verifyActionToken(
  token: string | undefined,
  expectedAction: string
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.action !== expectedAction || typeof payload.id !== "string") return null;
    return payload.id;
  } catch {
    return null;
  }
}
