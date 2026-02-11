import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest) {
  try {
    const { userId, isActive } = await req.json();

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid userId or isActive' },
        { status: 400 }
      );
    }

    // Update user's isActive status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    return NextResponse.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user status' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
