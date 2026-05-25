import { NextRequest, NextResponse } from "next/server";

function signedOutRedirect(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);

  response.headers.set("Cache-Control", "no-store, max-age=0");

  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });

  return response;
}

export function GET(request: NextRequest) {
  return signedOutRedirect(request);
}

export function POST(request: NextRequest) {
  return signedOutRedirect(request);
}
