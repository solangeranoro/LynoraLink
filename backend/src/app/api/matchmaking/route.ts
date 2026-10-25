import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasPremiumAccess } from "@/lib/premium";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!await hasPremiumAccess(userId)) return NextResponse.json({ error: "PREMIUM_REQUIRED" }, { status: 402 });

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { skills: true },
  }).catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const projects = await prisma.project.findMany({ where: { creatorId: userId }, select: { lookingFor: true, techStack: true, tags: true } });
  const interests = Array.from(new Set([
    ...currentUser.skills,
    ...projects.flatMap((project) => [...project.lookingFor, ...project.techStack, ...project.tags]),
  ].map((value) => value.trim()).filter(Boolean)));
  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, openToCoBuild: true, skills: { isEmpty: false } },
    select: { id: true, name: true, handle: true, image: true, headline: true, bio: true, city: true, skills: true },
    take: 100,
  });
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9+#.]/g, "");
  const matches = candidates.map((maker) => {
    const matchingSkills = maker.skills.filter((skill) => interests.some((interest) => {
      const normalizedSkill = normalize(skill);
      const normalizedInterest = normalize(interest);
      return normalizedSkill && normalizedInterest && (normalizedSkill === normalizedInterest || normalizedSkill.includes(normalizedInterest) || normalizedInterest.includes(normalizedSkill));
    }));
    return {
      ...maker,
      matchingSkills,
      matchScore: interests.length ? Math.round(matchingSkills.length / Math.max(maker.skills.length, 1) * 100) : 0,
    };
  }).filter((maker) => maker.matchScore > 0)
    .sort((first, second) => second.matchScore - first.matchScore || second.matchingSkills.length - first.matchingSkills.length)
    .slice(0, 24);

  return NextResponse.json({ matches, interests });
}