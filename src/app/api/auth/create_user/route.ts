// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireAuth } from '@/lib/apiAuth';
// import bcrypt from 'bcryptjs';

// export async function POST(request: NextRequest) {
//   const authCheck = await requireAuth(request, ['ADMIN']);
//   if (authCheck.error) return authCheck.error;
  
//   const user = authCheck.user;
  
//   try {
//     const { email, username, password, role } = await request.json();

//     // Validate required fields
//     if (!email || !username || !password || !role) {
//       return NextResponse.json(
//         { error: 'Email, username, password, and role are required' },
//         { status: 400 }
//       );
//     }

//     // Validate role
//     if (!['ADMIN', 'EXECUTIVE'].includes(role)) {
//       return NextResponse.json(
//         { error: 'Role must be either ADMIN or EXECUTIVE' },
//         { status: 400 }
//       );
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return NextResponse.json(
//         { error: 'Please provide a valid email address' },
//         { status: 400 }
//       );
//     }

//     // Validate username (alphanumeric and underscore only, 3-30 characters)
//     const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
//     if (!usernameRegex.test(username)) {
//       return NextResponse.json(
//         { error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores' },
//         { status: 400 }
//       );
//     }

//     // Validate password strength (at least 6 characters)
//     if (password.length < 6) {
//       return NextResponse.json(
//         { error: 'Password must be at least 6 characters long' },
//         { status: 400 }
//       );
//     }

//     // Check if user already exists
//     const existingUser = await prisma.user.findFirst({
//       where: {
//         OR: [
//           { email: email.toLowerCase().trim() },
//           { username: username.toLowerCase().trim() }
//         ]
//       }
//     });

//     if (existingUser) {
//       const conflictField = existingUser.email === email.toLowerCase().trim() ? 'email' : 'username';
//       return NextResponse.json(
//         { error: `User with this ${conflictField} already exists` },
//         { status: 400 }
//       );
//     }

//     // Hash password with bcrypt
//     const saltRounds = 12;
//     const hashedPassword = await bcrypt.hash(password, saltRounds);

//     // Create user with hashed password
//     const newUser = await prisma.user.create({
//       data: {
//         email: email.toLowerCase().trim(),
//         username: username.toLowerCase().trim(),
//         password: hashedPassword,
//         role: role as 'ADMIN' | 'EXECUTIVE'
//       }
//     });

//     return NextResponse.json({
//       message: `${role} user created successfully`,
//       user: {
//         id: newUser.id,
//         email: newUser.email,
//         username: newUser.username,
//         role: newUser.role,
//         createdAt: newUser.createdAt
//       }
//     }, { status: 201 });

//   } catch (error) {
//     console.error('Create user error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }
