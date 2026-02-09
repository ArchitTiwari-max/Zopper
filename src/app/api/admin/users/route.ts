import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

// Helper function to generate next ID based on role
async function getNextId(role: string): Promise<string> {
  let prefix: string;
  let model: any;
  
  switch (role.toLowerCase()) {
    case 'admin':
      prefix = 'admin_';
      model = prisma.admin;
      break;
    case 'executive':
      prefix = 'executive_';
      model = prisma.executive;
      break;
    default:
      prefix = 'user_';
      // For regular users, we check User table
      model = prisma.user;
  }
  
  try {
    let lastId: string;
    
    if (role.toLowerCase() === 'admin' || role.toLowerCase() === 'executive') {
      // Query Admin or Executive table
      const lastRecord = await model.findMany({
        where: {
          id: {
            startsWith: prefix
          }
        },
        orderBy: {
          id: 'desc'
        },
        take: 1,
        select: { id: true }
      });
      
      lastId = lastRecord[0]?.id || `${prefix}00000`;
    } else {
      // Query User table for user_ prefix
      const lastRecord = await prisma.user.findMany({
        where: {
          id: {
            startsWith: prefix
          }
        },
        orderBy: {
          id: 'desc'
        },
        take: 1,
        select: { id: true }
      });
      
      lastId = lastRecord[0]?.id || `${prefix}00000`;
    }
    
    // Extract number and increment
    const numPart = lastId.replace(prefix, '');
    const nextNum = parseInt(numPart) + 1;
    
    // Format with zero padding (5 digits)
    return `${prefix}${nextNum.toString().padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating next ID:', error);
    return `${prefix}00001`; // Default fallback
  }
}

// GET: Fetch all users with optional search/filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    
    const whereClause: any = {};
    
    // Add search filter (name, email, username)
    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          admin: {
            name: { contains: search, mode: 'insensitive' }
          }
        },
        {
          executive: {
            name: { contains: search, mode: 'insensitive' }
          }
        }
      ];
    }
    
    // Add role filter
    if (role) {
      whereClause.role = role.toUpperCase();
    }
    
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        admin: true,
        executive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        adminInfo: user.admin ? {
          adminId: user.admin.id,
          name: user.admin.name,
          contactNumber: user.admin.contact_number,
          region: user.admin.region
        } : null,
        executiveInfo: user.executive ? {
          executiveId: user.executive.id,
          name: user.executive.name,
          contactNumber: user.executive.contact_number,
          region: user.executive.region
        } : null
      }))
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST: Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password, role, name, contactNumber, region } = body;
    
    // Validation
    if (!username || !email || !password || !role || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: username, email, password, role, name' },
        { status: 400 }
      );
    }
    
    // Validate role
    if (!['ADMIN', 'EXECUTIVE'].includes(role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'Role must be ADMIN or EXECUTIVE' },
        { status: 400 }
      );
    }
    
    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username or email already exists' },
        { status: 400 }
      );
    }
    
    // Generate IDs
    const userId = await getNextId('user');
    const hashedPassword = await bcrypt.hash(password, 12);
    
    let newUser;
    
    if (role.toUpperCase() === 'EXECUTIVE') {
      const executiveId = await getNextId('executive');
      
      newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email,
          username: username,
          password: hashedPassword,
          role: 'EXECUTIVE',
          executive: {
            create: {
              id: executiveId,
              name: name,
              contact_number: contactNumber || '',
              region: region || null
            }
          }
        },
        include: {
          executive: true
        }
      });
      
    } else if (role.toUpperCase() === 'ADMIN') {
      const adminId = await getNextId('admin');
      
      newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email,
          username: username,
          password: hashedPassword,
          role: 'ADMIN',
          admin: {
            create: {
              id: adminId,
              name: name,
              contact_number: contactNumber || '',
              region: region || null
            }
          }
        },
        include: {
          admin: true
        }
      });
    }
    
    // Remove password from response
    const responseUser = {
      id: newUser!.id,
      username: newUser!.username,
      email: newUser!.email,
      role: newUser!.role,
      createdAt: newUser!.createdAt,
      adminInfo: (newUser as any).admin ? {
        adminId: (newUser as any).admin.id,
        name: (newUser as any).admin.name,
        contactNumber: (newUser as any).admin.contact_number,
        region: (newUser as any).admin.region
      } : null,
      executiveInfo: (newUser as any).executive ? {
        executiveId: (newUser as any).executive.id,
        name: (newUser as any).executive.name,
        contactNumber: (newUser as any).executive.contact_number,
        region: (newUser as any).executive.region
      } : null
    };
    
    return NextResponse.json({
      success: true,
      message: `${role} user created successfully`,
      user: responseUser
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a user (restricted to test_admin only with password confirmation)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, confirmationPassword } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    if (!confirmationPassword) {
      return NextResponse.json(
        { success: false, error: 'Password confirmation is required for user deletion' },
        { status: 400 }
      );
    }
    
    // Security check: Only test_admin can delete users
    const adminUser = await prisma.user.findUnique({
      where: { username: 'test_admin' }
    });
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin user not found' },
        { status: 403 }
      );
    }
    
    // Verify the confirmation password matches test_admin's password
    const passwordMatch = await bcrypt.compare(confirmationPassword, adminUser.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid password confirmation' },
        { status: 403 }
      );
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        admin: true,
        executive: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Use transaction to ensure all deletions succeed together
    await prisma.$transaction(async (tx) => {
      // Delete related Admin/Executive record first, then delete User
      if (user.admin) {
        // Delete Admin record first
        await tx.admin.delete({
          where: { id: user.admin.id }
        });
      }
      
      if (user.executive) {
        const executiveId = user.executive.id;
        
        console.log(`Starting comprehensive deletion for executive: ${executiveId}`);
        
        // Delete all executive-related records in the correct order to avoid foreign key conflicts
        
        // 1. Delete AssignReports first (they depend on Assigned)
        const assignReports = await tx.assignReport.deleteMany({
          where: {
            assigned: {
              executiveId: executiveId
            }
          }
        });
        console.log(`Deleted ${assignReports.count} assign reports`);
        
        // 2. Delete Assigned records (issue assignments)
        const assigned = await tx.assigned.deleteMany({
          where: {
            executiveId: executiveId
          }
        });
        console.log(`Deleted ${assigned.count} assignments`);
        
        // 3. Delete Issues that were created from visits by this executive
        const issues = await tx.issue.deleteMany({
          where: {
            visit: {
              executiveId: executiveId
            }
          }
        });
        console.log(`Deleted ${issues.count} issues`);
        
        // 4. Delete Visits conducted by this executive
        const visits = await tx.visit.deleteMany({
          where: {
            executiveId: executiveId
          }
        });
        console.log(`Deleted ${visits.count} visits`);
        
        // 5. Delete VisitPlans created by this executive
        const visitPlans = await tx.visitPlan.deleteMany({
          where: {
            executiveId: executiveId
          }
        });
        console.log(`Deleted ${visitPlans.count} visit plans`);
        
        // 6. Delete ExecutiveStoreAssignments
        const storeAssignments = await tx.executiveStoreAssignment.deleteMany({
          where: {
            executiveId: executiveId
          }
        });
        console.log(`Deleted ${storeAssignments.count} store assignments`);
        
        // 7. Delete Notifications related to this executive (both sent and received)
        const notifications = await tx.notification.deleteMany({
          where: {
            OR: [
              { recipientId: userId }, // Notifications received by this user
              { senderId: userId },    // Notifications sent by this user
            ]
          }
        });
        console.log(`Deleted ${notifications.count} notifications`);
        
        // 8. Delete DostChat records (they have required relations to Executive and User)
        const dostChats = await tx.dostChat.deleteMany({
          where: {
            executiveId: executiveId
          }
        });
        console.log(`Deleted ${dostChats.count} dost chats`);
        
        // 9. Finally, delete the Executive record
        await tx.executive.delete({
          where: { id: executiveId }
        });
        console.log(`Deleted executive record: ${executiveId}`);
      }
      
      // Now delete the User record
      await tx.user.delete({
        where: { id: userId }
      });
      console.log(`Deleted user record: ${userId}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `User and all associated records deleted successfully${user.executive ? ' (including visits, assignments, and notifications)' : ''}`
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}