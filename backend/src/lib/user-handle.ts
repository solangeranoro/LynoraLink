import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function isPersonalizedPublicName(name: string | null | undefined, email?: string | null) {
  const normalizedName = name?.trim();
  return Boolean(
    normalizedName &&
    !normalizedName.includes("@") &&
    normalizedName.toLowerCase() !== email?.trim().toLowerCase() &&
    !/^maker(?:\s|$)/i.test(normalizedName) &&
    !isGeneratedPublicName(normalizedName),
  );
}

export function isGeneratedPublicName(name: string | null | undefined) {
  return /^user#\d{6}$/i.test(name?.trim() ?? "");
}

export function needsGeneratedPublicName(name: string | null | undefined, email?: string | null) {
  const normalizedName = name?.trim();
  return !normalizedName ||
    normalizedName.toLowerCase() === email?.trim().toLowerCase() ||
    /^maker(?:\s|$)/i.test(normalizedName);
}

export async function createUniqueUserIdentity(name: string | null | undefined) {
  const generatedSuffix = name?.trim().match(/^user#(\d{6})$/i)?.[1];
  if (generatedSuffix) {
    const handle = `user${generatedSuffix}`;
    const collision = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!collision) return { handle, name: `user#${generatedSuffix}` };
  }

  const personalizedName = isPersonalizedPublicName(name) ? name!.trim() : null;
  const normalizedName = personalizedName?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const namedBase = normalizedName?.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);

  if (namedBase && namedBase.length >= 3) {
    const existing = await prisma.user.findUnique({ where: { handle: namedBase }, select: { id: true } });
    if (!existing) return { handle: namedBase, name: personalizedName };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomInt(1000, 1_000_000).toString();
      const candidate = `${namedBase.slice(0, 20 - suffix.length)}${suffix}`;
      const collision = await prisma.user.findUnique({ where: { handle: candidate }, select: { id: true } });
      if (!collision) return { handle: candidate, name: personalizedName };
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomInt(100_000, 1_000_000).toString();
    const handle = `user${suffix}`;
    const collision = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!collision) return { handle, name: `user#${suffix}` };
  }

  throw new Error("Could not generate a unique public username.");
}
