import { isIP } from "node:net";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const unknownCountry = "Inconnu";
let missingTokenWarningSent = false;

function getClientIp(headerValues: string[]) {
  for (const value of headerValues) {
    const candidate = value.split(",")[0]?.trim();
    if (candidate && isPublicIp(candidate)) return candidate;
  }
  return null;
}

function isPublicIp(value: string) {
  const version = isIP(value);
  if (version === 4) {
    const [first, second] = value.split(".").map(Number);
    return first !== undefined && second !== undefined &&
      first !== 0 && first !== 10 && first !== 127 && first < 224 &&
      !(first === 100 && second >= 64 && second <= 127) &&
      !(first === 169 && second === 254) &&
      !(first === 172 && second >= 16 && second <= 31) &&
      !(first === 192 && second === 168) &&
      !(first === 198 && (second === 18 || second === 19));
  }
  if (version === 6) {
    const normalized = value.toLowerCase();
    return normalized !== "::" && normalized !== "::1" &&
      !normalized.startsWith("fc") && !normalized.startsWith("fd") &&
      !/^fe[89ab]/.test(normalized) && !normalized.startsWith("ff") &&
      !normalized.startsWith("::ffff:");
  }
  return false;
}

async function lookupCountry(ip: string) {
  const token = process.env.IPINFO_TOKEN?.trim();
  if (!token) {
    if (!missingTokenWarningSent) {
      console.warn("User country enrichment skipped: IPINFO_TOKEN is not configured");
      missingTokenWarningSent = true;
    }
    return null;
  }

  const response = await fetch(
    `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`,
    { cache: "no-store", signal: AbortSignal.timeout(2500) },
  );
  if (!response.ok) throw new Error(`IPINFO_HTTP_${response.status}`);

  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("country" in result)) return null;
  const country = result.country;
  return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
}

export async function enrichUserCountryOnSignIn(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    if (!user || (user.country !== "" && user.country !== unknownCountry)) return;

    const requestHeaders = await headers();
    const ip = getClientIp([
      requestHeaders.get("cf-connecting-ip") ?? "",
      requestHeaders.get("x-real-ip") ?? "",
      requestHeaders.get("x-forwarded-for") ?? "",
    ]);
    const country = ip ? await lookupCountry(ip) : null;

    await prisma.user.updateMany({
      where: { id: userId, country: { in: ["", unknownCountry] } },
      data: { country: country ?? unknownCountry },
    });
  } catch (error) {
    console.warn("User country enrichment failed:", error instanceof Error ? error.message : "unknown error");
  }
}
