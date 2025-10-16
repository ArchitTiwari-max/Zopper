import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDostSuggestions } from '@/lib/dost'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 })

    const url = new URL(request.url)
    const q = url.searchParams.get('q') || undefined

    const executive = await prisma.executive.findUnique({ where: { userId: user.userId }, select: { id: true } })
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 })

    const suggestions = await getDostSuggestions(executive.id, { question: q })

    // Persist chat if question provided and answer exists
    if (q && suggestions?.answer?.answer) {
      try {
        await prisma.dostChat.create({
          data: {
            question: q,
            answerText: suggestions.answer.answer,
            payload: suggestions as any,
            executiveId: executive.id,
            userId: user.userId,
          }
        })
      } catch (e) {
        console.warn('Failed to save Dost chat:', e)
      }
    }

    // Cache per-user lightly
    const response = NextResponse.json({ success: true, data: suggestions })
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30')
    response.headers.set('Vary', 'Cookie')
    return response
  } catch (error: any) {
    console.error('Dost API error:', error)
    const isDev = process.env.NODE_ENV !== 'production'
    const message = error?.message || 'Failed to generate suggestions'
    return NextResponse.json({ success: false, error: isDev ? message : 'Failed to generate suggestions' }, { status: 500 })
  }
}
