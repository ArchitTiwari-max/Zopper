import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateUniqueIssueId } from "@/lib/issueIdGenerator";

export const runtime = "nodejs";

const prisma = new PrismaClient();

// GET endpoint to fetch past visits for a store (all executives)
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.roles.includes('EXECUTIVE')) {
      return NextResponse.json(
        { error: "Access denied. Executive role required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID is required" },
        { status: 400 },
      );
    }

    const currentExecutive = await prisma.employee.findUnique({
      where: { userId: user.userId },
    });

    if (!currentExecutive) {
      return NextResponse.json(
        { error: "Executive profile not found" },
        { status: 404 },
      );
    }

    // Get last 5 visits for this store by ANY executive or admin
    const [execVisitsRaw, employeeVisitsRaw] = await Promise.all([
      prisma.visit.findMany({
        where: { storeId },
        include: {
          issues: {
            include: {
              assigned: {
                include: {
                  employee: {
                    include: { user: true },
                  },
                },
              },
            },
          },
          store: true,
          employee: {
            include: { user: true },
          },
        },
        orderBy: { visitDate: "desc" },
        take: 5,
      }),
      (prisma as any).adminVisit
        ? (prisma as any).adminVisit.findMany({
            where: { storeId },
            include: { store: true, employee: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    const allVisits = [
      ...execVisitsRaw.map((v: any) => ({
        ...v,
        submitterType: "EXECUTIVE" as const,
      })),
      ...employeeVisitsRaw.map((v: any) => ({
        ...v,
        submitterType: "ADMIN" as const,
      })),
    ]
      .sort((a, b) => {
        const aDate = (a as any).visitDate || a.createdAt;
        const bDate = (b as any).visitDate || b.createdAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 5);

    // Transform visits data
    const transformedVisits = allVisits
      .filter((visit: any) => visit.employee)
      .map((visit: any) => {
        if (visit.submitterType === "ADMIN") {
          return {
            id: visit.id,
            date: visit.createdAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            status: "REVIEWD",
            representative: visit.employee?.name
              ? `${visit.employee.name} (Admin)`
              : "Unknown Admin",
            canViewDetails: false,
            personMet: visit.personMet,
            POSMchecked: null,
            remarks: null,
            imageUrls: [],
            adminComment: null,
            storeName: visit.store?.storeName || "Unknown Store",
            issues: [],
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
          };
        }

        const isCurrentExecutive = visit.executiveId === currentExecutive.id;

        if (isCurrentExecutive) {
          return {
            id: visit.id,
            date: (visit.visitDate || visit.createdAt).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            ),
            status: visit.status,
            representative: visit.employee?.name || "Unknown Executive",
            canViewDetails: true,
            personMet: visit.personMet,
            POSMchecked: visit.POSMchecked,
            remarks: visit.remarks,
            imageUrls: visit.imageUrls,
            adminComment: visit.adminComment,
            storeName: visit.store?.storeName || "Unknown Store",
            brandVisitDetails: visit.brandVisitDetails || null,
            visitDate: visit.visitDate
              ? visit.visitDate.toISOString().split("T")[0]
              : null,
            issues: visit.issues
              .filter((issue: any) =>
                issue.assigned.some(
                  (assignment: any) =>
                    assignment.employee &&
                    assignment.employee.id === currentExecutive.id,
                ),
              )
              .map((issue: any) => ({
                id: issue.id,
                details: issue.details,
                status: issue.status,
                createdAt: issue.createdAt,
                assigned: issue.assigned
                  .filter(
                    (assignment: any) =>
                      assignment.employee &&
                      assignment.employee.id === currentExecutive.id,
                  )
                  .map((assignment: any) => ({
                    id: assignment.id,
                    adminComment: assignment.adminComment,
                    status: assignment.status,
                    createdAt: assignment.createdAt,
                    executiveName:
                      assignment.employee?.name || "Unknown Executive",
                  })),
              })),
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
          };
        } else {
          return {
            id: visit.id,
            date: (visit.visitDate || visit.createdAt).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            ),
            status: visit.status,
            representative: visit.employee?.name || "Unknown Executive",
            canViewDetails: false,
            personMet: visit.personMet,
            POSMchecked: null,
            remarks: null,
            imageUrls: [],
            adminComment: null,
            storeName: visit.store?.storeName || "Unknown Store",
            brandVisitDetails: visit.brandVisitDetails || null,
            visitDate: visit.visitDate
              ? visit.visitDate.toISOString().split("T")[0]
              : null,
            issues: (visit.issues || []).map((issue: any) => ({
              id: issue.id,
              details: issue.details,
              status: issue.status,
              createdAt: issue.createdAt,
              assigned: [],
            })),
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
          };
        }
      });

    return NextResponse.json({ success: true, data: transformedVisits });
  } catch (error) {
    console.error("Error fetching visits:", error);
    return NextResponse.json(
      { error: "Failed to fetch visits" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST endpoint to create a new visit with optional issue
export async function POST(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.roles.includes('EXECUTIVE')) {
      return NextResponse.json(
        { error: "Access denied. Executive role required." },
        { status: 403 },
      );
    }

    const executive = await prisma.employee.findUnique({
      where: { userId: user.userId },
    });

    if (!executive) {
      return NextResponse.json(
        { error: "Executive profile not found" },
        { status: 404 },
      );
    }

    const {
      storeId,
      visitDate,
      personMet,
      POSMchecked,
      issuesRaised,
      brandsVisited,
      brandVisitDetails,
      remarks,
      imageUrls,
      nextScheduledDate,
    } = await request.json();

    if (!storeId || !personMet || personMet.length === 0) {
      return NextResponse.json(
        {
          error: "Store ID and at least one person met are required",
        },
        { status: 400 },
      );
    }

    if (!visitDate) {
      return NextResponse.json(
        { error: "Visit date is required" },
        { status: 400 },
      );
    }

    // Validate visit date (IST timezone)
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istToday = new Date(today.getTime() + istOffset);
    const todayStr = istToday.toISOString().split("T")[0];
    const ninetyDaysAgo = new Date(
      istToday.getTime() - 90 * 24 * 60 * 60 * 1000,
    );
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

    if (visitDate > todayStr) {
      return NextResponse.json(
        {
          error: "Visit date cannot be in the future",
          message: "Please select today or a past date within the last 90 days",
          code: "INVALID_VISIT_DATE_FUTURE",
        },
        { status: 400 },
      );
    }

    if (visitDate < ninetyDaysAgoStr) {
      return NextResponse.json(
        {
          error: "Visit date is too old",
          message: "Please select a date within the last 90 days",
          code: "INVALID_VISIT_DATE_TOO_OLD",
        },
        { status: 400 },
      );
    }

    const assignment = await prisma.employeeStoreAssignment.findUnique({
      where: {
        employeeId_storeId: { employeeId: executive.id,
          storeId: storeId,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          error: "Access denied: You are not assigned to this store",
          code: "STORE_NOT_ASSIGNED",
        },
        { status: 403 },
      );
    }

    // Check for duplicate visits (physical or digital) on this day for this store
    const startOfDay = new Date(visitDate + "T00:00:00.000Z");
    const endOfDay = new Date(visitDate + "T23:59:59.999Z");

    const [existingPhysicalVisit, existingDigitalVisit] = await Promise.all([
      prisma.visit.findFirst({
        where: {
          storeId,
          executiveId: executive.id,
          visitDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      prisma.digitalVisit.findFirst({
        where: {
          storeId,
          executiveId: executive.id,
          connectDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    if (existingPhysicalVisit || existingDigitalVisit) {
      return NextResponse.json(
        {
          error:
            "A visit has already been submitted for this store on this date",
          code: "DUPLICATE_VISIT",
        },
        { status: 400 },
      );
    }

    // Get brand IDs from brand names (either from brandsVisited or brandVisitDetails)
    const brandIds: string[] = [];
    const brandsToLookup =
      brandsVisited && brandsVisited.length > 0
        ? brandsVisited
        : brandVisitDetails
          ? brandVisitDetails.map((b: any) => b.brandName)
          : [];

    const brandMap: Record<string, string> = {};
    if (brandsToLookup.length > 0) {
      const brands = await prisma.brand.findMany({
        where: { brandName: { in: brandsToLookup } },
      });
      brands.forEach((brand) => {
        brandMap[brand.brandName] = brand.id;
      });
      brandIds.push(...brands.map((brand) => brand.id));
    }

    // Inject brandId inside brandVisitDetails JSON array
    const updatedBrandVisitDetails =
      brandVisitDetails && Array.isArray(brandVisitDetails)
        ? brandVisitDetails.map((b: any) => ({
            ...b,
            brandId: brandMap[b.brandName] || null,
          }))
        : null;

    // Aggregate brand remarks into root remarks field
    const combinedRemarks =
      brandVisitDetails && Array.isArray(brandVisitDetails)
        ? brandVisitDetails
            .filter((b: any) => b.remarks && b.remarks.trim() !== "")
            .map((b: any) => `${b.brandName}\n${b.remarks.trim()}`)
            .join("\n\n")
        : "";

    const visitDateTime = new Date(visitDate + "T00:00:00.000Z");

    const visit = await prisma.visit.create({
      data: {
        personMet,
        POSMchecked,
        remarks: combinedRemarks || remarks || "",
        imageUrls: imageUrls || [],
        status: "PENDING_REVIEW" as any,
        executiveId: executive.id,
        storeId,
        brandIds,
        brandVisitDetails: updatedBrandVisitDetails,
        visitDate: visitDateTime,
        ...(nextScheduledDate
          ? {
              nextScheduledDate: new Date(nextScheduledDate + "T00:00:00.000Z"),
            }
          : {}),
      },
      include: {
        store: true,
        employee: { include: { user: true } },
      },
    });

    let createdIssues: any[] = [];

    // Process top-level issues
    if (
      issuesRaised &&
      Array.isArray(issuesRaised) &&
      issuesRaised.length > 0
    ) {
      for (const issueDetail of issuesRaised) {
        if (issueDetail && issueDetail.trim() !== "") {
          const uniqueIssueId = await generateUniqueIssueId();
          const createdIssue = await prisma.issue.create({
            data: {
              id: uniqueIssueId,
              details: issueDetail.trim(),
              visitId: visit.id,
              status: "Pending",
            },
          });
          createdIssues.push({
            id: createdIssue.id,
            details: createdIssue.details,
            status: createdIssue.status,
          });
        }
      }
    }

    // Process per-brand issues
    if (brandVisitDetails && Array.isArray(brandVisitDetails)) {
      for (const brandData of brandVisitDetails) {
        if (
          brandData.issuesRaised &&
          Array.isArray(brandData.issuesRaised) &&
          brandData.issuesRaised.length > 0
        ) {
          for (const issueDetail of brandData.issuesRaised) {
            if (issueDetail && issueDetail.trim() !== "") {
              const uniqueIssueId = await generateUniqueIssueId();
              const createdIssue = await prisma.issue.create({
                data: {
                  id: uniqueIssueId,
                  details: `[${brandData.brandName}] ${issueDetail.trim()}`,
                  visitId: visit.id,
                  status: "Pending",
                },
              });
              createdIssues.push({
                id: createdIssue.id,
                details: createdIssue.details,
                status: createdIssue.status,
              });
            }
          }
        }
      }
    }

    if (nextScheduledDate) {
      const nextDate = new Date(nextScheduledDate + "T00:00:00.000Z");

      const existingPlan = await prisma.visitPlan.findFirst({
        where: {
          executiveId: executive.id,
          plannedVisitDate: nextDate,
        },
      });

      const storeSnapshotInfo = {
        id: visit.store.id,
        storeName: visit.store.storeName,
        isRescheduled: true,
        rescheduledFromVisitId: visit.id,
      };

      if (existingPlan) {
        if (!existingPlan.storeIds.includes(storeId)) {
          let updatedSnapshots: any[] = [];
          if (
            existingPlan.storesSnapshot &&
            Array.isArray(existingPlan.storesSnapshot)
          ) {
            updatedSnapshots = [...existingPlan.storesSnapshot];
          }
          updatedSnapshots.push(storeSnapshotInfo);

          await prisma.visitPlan.update({
            where: { id: existingPlan.id },
            data: {
              storeIds: { push: storeId },
              storesSnapshot: updatedSnapshots,
            },
          });
        }
      } else {
        await prisma.visitPlan.create({
          data: {
            executiveId: executive.id,
            plannedVisitDate: nextDate,
            storeIds: [storeId],
            storesSnapshot: [storeSnapshotInfo],
            createdByRole: "EXECUTIVE",
            adminComment: "Auto-added from physical visit rescheduling",
            status: "SUBMITTED",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          status: visit.status,
          visitDate: visit.visitDate,
          createdAt: visit.createdAt,
        },
        issues: createdIssues,
      },
    });
  } catch (error) {
    console.error("Error creating visit:", error);
    return NextResponse.json(
      { error: "Failed to create visit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
