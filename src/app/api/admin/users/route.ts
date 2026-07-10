import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sendCredentialsEmail } from '@/lib/email';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

// Helper function to generate next ID based on role
async function getNextId(role: string): Promise<string> {
  let prefix: string;
  if (role.toLowerCase() === 'admin' || role.toLowerCase() === 'executive' || role.toLowerCase() === 'employee') {
    prefix = 'employee_';
  } else {
    prefix = 'user_';
  }
  
  try {
    let lastId: string;
    
    if (role.toLowerCase() === 'admin' || role.toLowerCase() === 'executive' || role.toLowerCase() === 'employee') {
      // Query unified Employee table
      const lastRecord = await prisma.employee.findMany({
        where: {
          id: {
            startsWith: 'employee_'
          }
        },
        orderBy: {
          id: 'desc'
        },
        take: 1,
        select: { id: true }
      });
      
      lastId = lastRecord[0]?.id || `employee_00000`;
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
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      whereClause.OR = [
        { username: { contains: escapedSearch, mode: 'insensitive' } },
        { email: { contains: escapedSearch, mode: 'insensitive' } },
        {
          employee: {
            name: { contains: escapedSearch, mode: 'insensitive' }
          }
        }
      ];
    }
    
    // Add role filter
    if (role) {
      whereClause.roles = { has: role.toUpperCase() };
    }
    
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        employee: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({
      success: true,
      users: users.map(user => {
        const userRoles = user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'];
        const primaryRole = userRoles[0];
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: userRoles,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          adminInfo: user.employee && userRoles.includes('ADMIN') ? {
            adminId: user.employee.id,
            name: user.employee.name,
            contactNumber: user.employee.contact_number,
            region: user.employee.region
          } : null,
          executiveInfo: user.employee && userRoles.includes('EXECUTIVE') ? {
            executiveId: user.employee.id,
            name: user.employee.name,
            contactNumber: user.employee.contact_number,
            region: user.employee.region
          } : null,
          employeeInfo: user.employee ? {
            adminId: userRoles.includes('ADMIN') ? user.employee.id : undefined,
            executiveId: userRoles.includes('EXECUTIVE') ? user.employee.id : undefined,
            name: user.employee.name,
            contactNumber: user.employee.contact_number,
            region: user.employee.region
          } : null
        };
      })
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
    const targetRole = role.toUpperCase();
    if (!['ADMIN', 'EXECUTIVE'].includes(targetRole)) {
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
    
    // Get target role mapping from UserRole table
    const userRoleRecord = await prisma.userRole.findUnique({
      where: { name: targetRole === 'ADMIN' ? 'ADMIN' : 'EXECUTIVE' }
    });
    
    // Generate IDs
    const userId = await getNextId('user');
    const hashedPassword = await bcrypt.hash(password, 12);
    
    let newUser;
    
    if (targetRole === 'EXECUTIVE') {
      const executiveId = await getNextId('executive');
      
      newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email,
          username: username,
          password: hashedPassword,
          roles: ['EXECUTIVE'],
          permissions: userRoleRecord?.permissions || [],
          employee: {
            create: {
              id: executiveId,
              name: name,
              contact_number: contactNumber || '',
              region: region || null,
              designation: 'Relationship Manager',
              department: 'Sales'
            }
          }
        },
        include: {
          employee: true
        }
      });
      
    } else {
      const adminId = await getNextId('admin');
      
      newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email,
          username: username,
          password: hashedPassword,
          roles: ['ADMIN'],
          permissions: userRoleRecord?.permissions || [],
          employee: {
            create: {
              id: adminId,
              name: name,
              contact_number: contactNumber || '',
              region: region || null,
              designation: 'Operations Admin',
              department: 'Operations'
            }
          }
        },
        include: {
          employee: true
        }
      });
    }
    
    // Remove password from response
    const createdRoles = newUser!.roles && newUser!.roles.length > 0 ? newUser!.roles : ['EXECUTIVE'];
    const primaryCreatedRole = createdRoles[0];

    const responseUser = {
      id: newUser!.id,
      username: newUser!.username,
      email: newUser!.email,
      role: primaryCreatedRole,
      roles: createdRoles,
      createdAt: newUser!.createdAt,
      adminInfo: newUser.employee && createdRoles.includes('ADMIN') ? {
        adminId: newUser.employee.id,
        name: newUser.employee.name,
        contactNumber: newUser.employee.contact_number,
        region: newUser.employee.region
      } : null,
      executiveInfo: newUser.employee && createdRoles.includes('EXECUTIVE') ? {
        executiveId: newUser.employee.id,
        name: newUser.employee.name,
        contactNumber: newUser.employee.contact_number,
        region: newUser.employee.region
      } : null,
      employeeInfo: newUser.employee ? {
        adminId: createdRoles.includes('ADMIN') ? newUser.employee.id : undefined,
        executiveId: createdRoles.includes('EXECUTIVE') ? newUser.employee.id : undefined,
        name: newUser.employee.name,
        contactNumber: newUser.employee.contact_number,
        region: newUser.employee.region
      } : null
    };
    
    // Send email with credentials
    let emailSent = false;
    try {
      emailSent = await sendCredentialsEmail(
        email.trim(),
        username.trim(),
        targetRole,
        name.trim(),
        password
      );
    } catch (mailError) {
      console.error('Failed to send welcome credentials email:', mailError);
    }
    
    return NextResponse.json({
      success: true,
      message: `${role} user created successfully${emailSent ? ' and credentials email sent' : ' (email send failed)'}`,
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
        employee: true
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
      // Delete related Employee record first, then delete User
      if (user.employee) {
        const employeeId = user.employee.id;
        
        console.log(`Starting comprehensive deletion for employee: ${employeeId}`);
        
        // Delete all employee-related records in the correct order to avoid foreign key conflicts
        
        // 1. Delete AssignReports first (they depend on Assigned)
        const assignReports = await tx.assignReport.deleteMany({
          where: {
            assigned: {
              executiveId: employeeId
            }
          }
        });
        console.log(`Deleted ${assignReports.count} assign reports`);
        
        // 2. Delete Assigned records (issue assignments)
        const assigned = await tx.assigned.deleteMany({
          where: {
            executiveId: employeeId
          }
        });
        console.log(`Deleted ${assigned.count} assignments`);
        
        // 3. Delete Issues that were created from visits by this employee
        const issues = await tx.issue.deleteMany({
          where: {
            visit: {
              executiveId: employeeId
            }
          }
        });
        console.log(`Deleted ${issues.count} issues`);
        
        // 4. Delete Visits conducted by this employee
        const visits = await tx.visit.deleteMany({
          where: {
            executiveId: employeeId
          }
        });
        console.log(`Deleted ${visits.count} visits`);
        
        // 5. Delete VisitPlans created by this employee
        const visitPlans = await tx.visitPlan.deleteMany({
          where: {
            executiveId: employeeId
          }
        });
        console.log(`Deleted ${visitPlans.count} visit plans`);
        
        // 6. Delete EmployeeStoreAssignments
        const storeAssignments = await tx.employeeStoreAssignment.deleteMany({
          where: {
            employeeId: employeeId
          }
        });
        console.log(`Deleted ${storeAssignments.count} store assignments`);
        
        // 7. Delete Notifications related to this employee (both sent and received)
        const notifications = await tx.notification.deleteMany({
          where: {
            OR: [
              { recipientId: userId }, // Notifications received by this user
              { senderId: userId },    // Notifications sent by this user
            ]
          }
        });
        console.log(`Deleted ${notifications.count} notifications`);
        
        // 8. Delete DostChat records
        const dostChats = await tx.dostChat.deleteMany({
          where: {
            executiveId: employeeId
          }
        });
        console.log(`Deleted ${dostChats.count} dost chats`);
        
        // 9. Finally, delete the Employee record
        await tx.employee.delete({
          where: { id: employeeId }
        });
        console.log(`Deleted employee record: ${employeeId}`);
      }
      
      // Now delete the User record
      await tx.user.delete({
        where: { id: userId }
      });
      console.log(`Deleted user record: ${userId}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `User and all associated records deleted successfully${user.employee ? ' (including visits, assignments, and notifications)' : ''}`
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}