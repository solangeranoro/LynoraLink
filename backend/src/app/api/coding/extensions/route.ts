import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const permissions = ["files.read", "files.write", "workspace.events", "ui.notify"] as const;
const extensionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).default(""),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  permissions: z.array(z.enum(permissions)).max(4),
  source: z.string().min(1).max(32_000),
  published: z.boolean().default(false),
});

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("UNAUTHORIZED", 401);
  try {
    const extensions = await prisma.codingExtension.findMany({
      where: {
        OR: [{ ownerId: session.user.id }, { published: true }],
      },
      orderBy: [{ published: "desc" }, { name: "asc" }],
      select: {
        id: true, ownerId: true, slug: true, name: true, description: true,
        version: true, permissions: true, source: true, published: true, enabled: true,
      },
    });
    const ownedSlugs = new Set(extensions
      .filter((extension) => extension.ownerId === session.user.id)
      .map((extension) => extension.slug));
    return NextResponse.json({
      extensions: extensions.map(({ permissions: extensionPermissions, ...extension }) => ({
        ...extension,
        permissions: JSON.parse(extensionPermissions),
        owned: extension.ownerId === session.user.id,
        installed: extension.ownerId === session.user.id || ownedSlugs.has(extension.slug),
      })),
    });
  } catch (error) {
    console.error("Unable to load coding extensions:", error);
    return errorResponse("Unable to load extensions.", 500);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("UNAUTHORIZED", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", 400);
  }
  const marketplaceRequest = z.object({ marketplaceId: z.string().min(1) }).safeParse(body);
  if (marketplaceRequest.success) {
    try {
      const listing = await prisma.codingExtension.findFirst({
        where: { id: marketplaceRequest.data.marketplaceId, published: true },
      });
      if (!listing) return errorResponse("EXTENSION_NOT_FOUND", 404);
      const extension = await prisma.codingExtension.create({
        data: {
          ownerId: session.user.id,
          slug: listing.slug,
          name: listing.name,
          description: listing.description,
          version: listing.version,
          permissions: listing.permissions,
          source: listing.source,
          enabled: false,
        },
        select: {
          id: true, ownerId: true, slug: true, name: true, description: true,
          version: true, permissions: true, source: true, published: true, enabled: true,
        },
      });
      return NextResponse.json({
        extension: { ...extension, permissions: JSON.parse(extension.permissions) },
      }, { status: 201 });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return errorResponse("EXTENSION_ALREADY_INSTALLED", 409);
      }
      console.error("Unable to install marketplace extension:", error);
      return errorResponse("Unable to install the extension.", 500);
    }
  }
  const parsed = extensionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const slug = parsed.data.name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 64);
  if (!slug) return errorResponse("INVALID_EXTENSION_NAME", 422);
  try {
    const extension = await prisma.codingExtension.create({
      data: {
        ownerId: session.user.id,
        slug,
        name: parsed.data.name,
        description: parsed.data.description,
        version: parsed.data.version,
        permissions: JSON.stringify(parsed.data.permissions),
        source: parsed.data.source,
        published: parsed.data.published,
      },
      select: {
        id: true, ownerId: true, slug: true, name: true, description: true,
        version: true, permissions: true, source: true, published: true, enabled: true,
      },
    });
    return NextResponse.json({
      extension: { ...extension, permissions: JSON.parse(extension.permissions) },
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return errorResponse("EXTENSION_ALREADY_INSTALLED", 409);
    }
    console.error("Unable to install coding extension:", error);
    return errorResponse("Unable to install the extension.", 500);
  }
}
