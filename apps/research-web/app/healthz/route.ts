import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    applicationId: "genome-companion-research-web",
    trustPlane: "public-research",
    personalHealthData: "not-accepted",
  });
}
