import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    console.log("Godrej SFDC API - authenticated user:", user);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow both EXECUTIVE and ADMIN roles to access this endpoint.
    // - EXECUTIVE: sees their Godrej SFDC data in the executive portal
    // - ADMIN: uses the same endpoint to view imported records from the admin data management screen
    const normalizedRole = String(user.role).toUpperCase();
    if (normalizedRole !== "EXECUTIVE" && normalizedRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Executive or Admin role required." },
        { status: 403 },
      );
    }

    // Check if model exists in prisma before query
    if (!(prisma as any).godrejSfdc) {
      console.error("Prisma error: godrejSfdc model not found in client");
      return NextResponse.json(
        { 
          success: false, 
          error: "Database model error",
          message: "The data model 'godrejSfdc' is missing from the client. Please run prisma generate."
        },
        { status: 500 },
      );
    }

    // Fetch all Godrej SFDC records (sorted by most recent first)
    const godrejSfdcRecords = await prisma.godrejSfdc.findMany({
      orderBy: {
        uploadedAt: "desc",
      },
      select: {
        id: true,
        planId: true,
        phone: true,
        contractBookingId: true,
        uploadedAt: true,
      },
    });

    // Format the data for the frontend
    const formattedData = godrejSfdcRecords.map((record) => ({
      id: record.id,
      planId: record.planId,
      phone: record.phone,
      contractBookingId: record.contractBookingId,
      uploadedAt: record.uploadedAt ? record.uploadedAt.toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: formattedData,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Executive Godrej SFDC fetch error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 },
    );
  }
}
