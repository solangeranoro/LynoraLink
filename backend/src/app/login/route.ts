import { NextResponse } from "next/server";

export function GET(request: Request) {
  const frontendUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (!frontendUrl) {
    return new NextResponse("Frontend URL is not configured.", { status: 503 });
  }

  let destination: URL;
  try {
    destination = new URL("/login", frontendUrl);
  } catch {
    return new NextResponse("Frontend URL is invalid.", { status: 503 });
  }
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    return new NextResponse("Frontend URL is invalid.", { status: 503 });
  }

  new URL(request.url).searchParams.forEach((value, key) => {
    if (key !== "error" || value !== "undefined") {
      destination.searchParams.append(key, value);
    }
  });

  return NextResponse.redirect(destination);
}