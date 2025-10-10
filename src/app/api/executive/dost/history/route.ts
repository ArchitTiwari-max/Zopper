import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 })

    const executive = await prisma.executive.findUnique({ where: { userId: user.userId }, select: { id: true } })
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 })

    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '20')

    const history = await prisma.dostChat.findMany({
      where: { executiveId: executive.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        question: true,
        answerText: true,
        createdAt: true,
      }
    })

    return NextResponse.json({ success: true, data: history })
  } catch (error: any) {
    console.error('Dost history error:', error)
    const isDev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ success: false, error: isDev ? error?.message : 'Failed to fetch history' }, { status: 500 })
  }
}
