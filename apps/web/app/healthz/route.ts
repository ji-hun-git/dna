import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    applicationId: "genome-companion-korea-web",
    trustPlane: "health-product",
    researchCredentials: "not-accepted",
  });
}
