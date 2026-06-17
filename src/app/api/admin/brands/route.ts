import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const prisma = new PrismaClient();
  try {
    const brands = await prisma.brand.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    });
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("Failed to retrieve brands:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch brands",
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
