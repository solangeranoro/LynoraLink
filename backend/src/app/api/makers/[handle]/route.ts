import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAwardedBadges } from "@/lib/gamification";
import { isPlatformAdmin } from "@/lib/premium";
import { hasActiveMarketplaceVerification } from "@/lib/marketplace-verification";

const projectSelect = {
  id: true,
  title: true,
  slug: true,
  githubUrl: true,
  tagline: true,
  status: true,
  logoUrl: true,
  liveUrl: true,
  techStack: true,
  _count: { select: { collaborators: true, posts: true } },
} as const;

export async function GET(_request: Request, props: { params: Promise<{ handle: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const maker = await prisma.user.findFirst({
    where: { OR: [{ handle: params.handle.toLowerCase() }, { id: params.handle }] },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      handle: true,
      headline: true,
      bio: true,
      city: true,
      skills: true,
      location: true,
      websiteUrl: true,
      githubUrl: true,
      twitterUrl: true,
      openToCoBuild: true,
      isOnline: true,
      isVerified: true,
      emailVerified: true,
      marketplaceVerification: { select: { email: true, emailVerifiedAt: true, status: true, currentPeriodEnd: true } },
      projects: { where: { isPrivate: false, teamName: null }, select: projectSelect },
      collaborations: {
        where: { status: "APPROVED", project: { isPrivate: false, teamName: null } },
        select: { project: { select: projectSelect } },
      },
      _count: { select: { posts: true, collaborations: true } },
    },
  });
  if (!maker) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const projectMap = new Map([...maker.projects, ...maker.collaborations.map((item) => item.project)].map((project) => [project.id, project]));
  const badges = await getAwardedBadges(maker.id);
  const association = maker.id === session.user.id ? null : await prisma.association.findFirst({
    where: {
      OR: [
        { requesterId: session.user.id, addresseeId: maker.id },
        { requesterId: maker.id, addresseeId: session.user.id },
      ],
    },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });
  const { city, email, emailVerified, isVerified, marketplaceVerification, ...publicMaker } = maker;
  return NextResponse.json({
    maker: {
      ...publicMaker,
      isVerified: isPlatformAdmin(email) ||
        (isVerified && Boolean(emailVerified)) ||
        Boolean(emailVerified && email.toLowerCase() === marketplaceVerification?.email.toLowerCase() && marketplaceVerification?.emailVerifiedAt && hasActiveMarketplaceVerification(marketplaceVerification)),
      location: maker.location ?? city,
      projects: Array.from(projectMap.values()),
      association,
      badges,
    },
  });
}