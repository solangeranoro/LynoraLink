import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAwardedBadges } from "@/lib/gamification";
import { isPlatformAdmin } from "@/lib/premium";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z.string().trim().toLowerCase().max(30).regex(/^[a-z0-9_]*$/).refine((value) => !value || value.length >= 3),
  headline: z.string().trim().max(120),
  age: z.coerce.number().int().min(13).max(120).optional().or(z.literal("")).transform((value) => value === "" ? undefined : Number(value)),
  city: z.string().trim().max(100),
  phoneNumber: z.string().trim().max(30).regex(/^[+()\d\s-]*$/).optional().or(z.literal("")),
  bio: z.string().trim().max(600),
  skills: z.array(z.string().trim().min(1).max(30)).max(20),
  openToCoBuild: z.boolean(),
  githubUrl: z.string().trim().max(300).refine(isWebUrl),
  twitterUrl: z.string().trim().max(300).refine(isWebUrl),
  websiteUrl: z.string().trim().max(300).refine(isWebUrl),
  location: z.string().trim().max(100),
  image: z.string().max(600_000).refine(isProfileImage),
});

function isProfileImage(value: string) {
  if (!value || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && /\/image\/upload\//.test(url.pathname);
  } catch {
    return false;
  }
}

function isWebUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const profileSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  handle: true,
  headline: true,
  age: true,
  city: true,
  phoneNumber: true,
  bio: true,
  skills: true,
  githubUrl: true,
  twitterUrl: true,
  websiteUrl: true,
  location: true,
  isVerified: true,
  emailVerified: true,
  marketplaceVerification: { select: { email: true, emailVerifiedAt: true, status: true, currentPeriodEnd: true } },
  openToCoBuild: true,
  isOnline: true,
  _count: { select: { projects: true, posts: true, collaborations: true } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: profileSelect,
  });
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const badges = await getAwardedBadges(session.user.id);
  const { emailVerified, marketplaceVerification, ...profileData } = profile;
  return NextResponse.json({
    profile: {
      ...profileData,
      isVerified: isPlatformAdmin(profile.email) ||
        (profile.isVerified && Boolean(emailVerified)) ||
        Boolean(emailVerified && profile.email.toLowerCase() === marketplaceVerification?.email.toLowerCase() && marketplaceVerification?.emailVerifiedAt && hasActiveMarketplaceVerification(marketplaceVerification)),
      badges,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_profile", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.handle) {
    const existingHandle = await prisma.user.findFirst({
      where: { handle: parsed.data.handle, NOT: { id: session.user.id } },
      select: { id: true },
    });
    if (existingHandle) return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  try {
    const profile = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...parsed.data,
        handle: parsed.data.handle || null,
        headline: parsed.data.headline || null,
        age: parsed.data.age ?? null,
        city: parsed.data.city || null,
        phoneNumber: parsed.data.phoneNumber || null,
        bio: parsed.data.bio || null,
        skills: [...new Set(parsed.data.skills.map((skill) => skill.trim()).filter(Boolean))],
        githubUrl: parsed.data.githubUrl || null,
        twitterUrl: parsed.data.twitterUrl || null,
        websiteUrl: parsed.data.websiteUrl || null,
        location: parsed.data.location || null,
        image: parsed.data.image || null,
      },
      select: profileSelect,
    });
    const { emailVerified, marketplaceVerification, ...profileData } = profile;
    return NextResponse.json({
      profile: {
        ...profileData,
        isVerified: isPlatformAdmin(profile.email) ||
          (profile.isVerified && Boolean(emailVerified)) ||
          Boolean(emailVerified && profile.email.toLowerCase() === marketplaceVerification?.email.toLowerCase() && marketplaceVerification?.emailVerifiedAt && hasActiveMarketplaceVerification(marketplaceVerification)),
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    }
    throw error;
  }
}