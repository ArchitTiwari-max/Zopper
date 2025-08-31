import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

const prisma = new PrismaClient();

interface PersonMet {
  name: string;
  designation: string;
}

interface UploadedImage {
  url: string;
  public_id: string;
  bytes: number;
  format: string;
}

interface SubmitTaskRequest {
  taskId: number;
  personMet?: PersonMet | null;
  remarks: string;
  photos: UploadedImage[];
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    const body: SubmitTaskRequest = await request.json();
    const { taskId, personMet, remarks, photos } = body;

    // Validate required fields
    if (!remarks || remarks.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Remarks are required' },
        { status: 400 }
      );
    }

    // Validate person met fields if provided
    if (personMet && personMet.designation && (!personMet.name || personMet.name.trim() === '')) {
      return NextResponse.json(
        { success: false, error: 'Name is required when designation is provided' },
        { status: 400 }
      );
    }

    // Find the assigned task
    const assignedTask = await prisma.assigned.findFirst({
      where: {
        id: taskId.toString(),
        executiveId: executive.id
      },
      include: {
        assignReport: true,
        issue: true
      }
    });

    if (!assignedTask) {
      return NextResponse.json(
        { success: false, error: 'Assigned task not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if task is already completed
    if (assignedTask.status === 'Completed') {
      return NextResponse.json(
        { success: false, error: 'Task is already completed' },
        { status: 400 }
      );
    }

    // Check if report already exists
    if (assignedTask.assignReport) {
      return NextResponse.json(
        { success: false, error: 'Task report already submitted' },
        { status: 400 }
      );
    }

    // Extract photo URLs from uploaded images
    const photoUrls = photos.map(photo => photo.url);

    // Create the assign report
    const assignReport = await prisma.assignReport.create({
      data: {
        remarks: remarks.trim(),
        personMetName: personMet?.name?.trim() || null,
        personMetDesignation: personMet?.designation?.trim() || null,
        photoUrls: photoUrls,
        assignedId: assignedTask.id
      }
    });

    // Update the assigned task status to Completed
    await prisma.assigned.update({
      where: { id: assignedTask.id },
      data: { 
        status: 'Completed'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Task submitted successfully',
      data: {
        reportId: assignReport.id,
        assignedTaskId: assignedTask.id,
        status: 'Completed'
      }
    });

  } catch (error) {
    console.error('Submit task error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit task' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Get task ID from query parameters
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Get the assign report for the task
    const assignReport = await prisma.assignReport.findFirst({
      where: {
        assigned: {
          id: taskId,
          executiveId: executive.id
        }
      },
      include: {
        assigned: {
          include: {
            issue: true
          }
        }
      }
    });

    if (!assignReport) {
      return NextResponse.json(
        { success: false, error: 'Task report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: assignReport.id,
        remarks: assignReport.remarks,
        personMet: {
          name: assignReport.personMetName,
          designation: assignReport.personMetDesignation
        },
        photoUrls: assignReport.photoUrls,
        createdAt: assignReport.createdAt,
        assignedTask: {
          id: assignReport.assigned.id,
          status: assignReport.assigned.status,
          issue: assignReport.assigned.issue
        }
      }
    });

  } catch (error) {
    console.error('Get assign report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch task report' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
