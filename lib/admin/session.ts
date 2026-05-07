import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tina_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD_HASH ||
    process.env.ADMIN_PASSWORD
  );
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET or ADMIN_PASSWORD_HASH.");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyAdminPassword(password: string) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (hash?.startsWith("sha256:")) {
    const [, salt, expected] = hash.split(":");
    if (!salt || !expected) {
      return false;
    }

    const actual = crypto
      .createHash("sha256")
      .update(`${salt}:${password}`)
      .digest("hex");
    return constantTimeEqual(actual, expected);
  }

  if (hash) {
    const actual = crypto.createHash("sha256").update(password).digest("hex");
    return constantTimeEqual(actual, hash);
  }

  if (plainPassword) {
    return constantTimeEqual(password, plainPassword);
  }

  return false;
}

export async function createAdminSession() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = String(issuedAt);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) {
    return false;
  }

  const [issuedAtValue, signature] = session.split(".");
  const issuedAt = Number(issuedAtValue);

  if (!issuedAtValue || !signature || !Number.isFinite(issuedAt)) {
    return false;
  }

  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (age < 0 || age > SESSION_MAX_AGE) {
    return false;
  }

  return constantTimeEqual(sign(issuedAtValue), signature);
}
