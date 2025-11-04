import { prisma } from '@/lib/prisma'
import { generateJSON } from '@/lib/llm'

export type DostStoreSuggestion = {
  storeId: string
  storeName: string
  city?: string | null
  brandFocus: string[]
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export type DostDiscussionPoint = {
  storeId: string | null
  storeName?: string | null
  topic: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
}

export type DostPerformanceInsight = {
  metric: string
  finding: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
}

export type DostAnswer = { question: string; answer: string }

export type DostSuggestions = {
  storesToVisit: DostStoreSuggestion[]
  discussionPoints: DostDiscussionPoint[]
  performanceInsights: DostPerformanceInsight[]
  generatedAt: string
  answer?: DostAnswer
}

function daysBetween(a: Date | null | undefined, b: Date): number {
  if (!a) return 9999
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// Simple helper to compute revenue trend from SalesRecord.monthlySales JSON
function computeMoMRevenueDelta(monthlySales: any[]): { lastMonthRevenue?: number; prevMonthRevenue?: number; deltaPct?: number } {
  try {
    if (!Array.isArray(monthlySales)) return {}
    // assume entries are last 3 months; take last two by month ascending
    const sorted = [...monthlySales].sort((a, b) => (a?.month ?? 0) - (b?.month ?? 0))
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const lastRev = Number(last?.revenue ?? last?.R ?? 0)
    const prevRev = Number(prev?.revenue ?? prev?.R ?? 0)
    if (prevRev > 0) {
      const deltaPct = ((lastRev - prevRev) / prevRev) * 100
      return { lastMonthRevenue: lastRev, prevMonthRevenue: prevRev, deltaPct }
    }
    return { lastMonthRevenue: lastRev, prevMonthRevenue: prevRev, deltaPct: undefined }
  } catch {
    return {}
  }
}

export async function getDostSuggestions(executiveId: string, opts?: { question?: string }): Promise<DostSuggestions> {
  const now = new Date()

  // 1. Fetch context in parallel
  const executive = await prisma.executive.findUnique({
    where: { id: executiveId },
    include: {
      executiveStores: {
        include: { store: true }
      }
    }
  })

  if (!executive) {
    return {
      storesToVisit: [],
      discussionPoints: [],
      performanceInsights: [{
        metric: 'executive',
        finding: 'Executive profile not found',
        suggestion: 'Re-login or contact admin to create executive profile',
        severity: 'high'
      }],
      generatedAt: now.toISOString()
    }
  }

  const storeIds = executive.executiveStores.map(es => es.storeId)

  const [visitsByStore, salesByStore, unresolvedIssuesByStore, announcements] = await Promise.all([
    // Last visit per store with remarks and unresolved issue statuses
    Promise.all(storeIds.map(async (storeId) => {
      const lastVisit = await prisma.visit.findFirst({
        where: { executiveId: executive.id, storeId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          remarks: true,
          issues: { select: { status: true, details: true } }
        }
      })
      return { storeId, lastVisit }
    })),

    // Sales records per store (latest year)
    Promise.all(storeIds.map(async (storeId) => {
      const rec = await prisma.salesRecord.findMany({
        where: { storeId },
        orderBy: [{ year: 'desc' }],
        take: 1,
        select: { brandId: true, categoryId: true, monthlySales: true }
      })
      return { storeId, records: rec }
    })),

    // Unresolved issues per store across visits
    Promise.all(storeIds.map(async (storeId) => {
      const issues = await prisma.issue.findMany({
        where: {
          status: { not: 'Resolved' },
          visit: { storeId }
        },
        select: { id: true, status: true, details: true, visitId: true }
      })
      return { storeId, issues }
    })),

    // System announcements as proxy for incentives/schemes
    prisma.notification.findMany({
      where: {
        type: 'SYSTEM_ANNOUNCEMENT',
        createdAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true, message: true, createdAt: true }
    })
  ])

  // Build per-store signals
  const storeSignals = new Map<string, {
    lastVisitDate?: Date
    daysSinceLastVisit: number
    remarks?: string | null
    unresolvedIssueCount: number
    unresolvedSamples: string[]
    momDeltaPct?: number
    brandFocus: string[]
  }>()

  for (const { storeId, lastVisit } of visitsByStore) {
    const days = daysBetween(lastVisit?.createdAt ?? null, now)
    storeSignals.set(storeId, {
      lastVisitDate: lastVisit?.createdAt ?? undefined,
      daysSinceLastVisit: days,
      remarks: lastVisit?.remarks ?? null,
      unresolvedIssueCount: lastVisit?.issues?.filter(i => i.status !== 'Resolved').length ?? 0,
      unresolvedSamples: (lastVisit?.issues || []).slice(0, 2).map(i => i.details).filter(Boolean) as string[],
      brandFocus: [],
    })
  }

  for (const { storeId, records } of salesByStore) {
    const rec = records?.[0]
    if (!rec) continue
    const ms = Array.isArray(rec.monthlySales) ? rec.monthlySales as any[] : []
    const { deltaPct } = computeMoMRevenueDelta(ms)
    const entry = storeSignals.get(storeId) || {
      daysSinceLastVisit: 9999,
      unresolvedIssueCount: 0,
      unresolvedSamples: [],
      brandFocus: [] as string[]
    }
    entry.momDeltaPct = deltaPct
    // crude brand focus based on record brandId
    if ((rec as any).brandId) entry.brandFocus.push((rec as any).brandId)
    storeSignals.set(storeId, entry)
  }

  // Compute priority and reasons
  const storesToVisit: DostStoreSuggestion[] = executive.executiveStores.map(es => {
    const s = es.store
    const sig = storeSignals.get(es.storeId) || { daysSinceLastVisit: 9999, unresolvedIssueCount: 0, unresolvedSamples: [], brandFocus: [] as string[] }

    let priority: 'high' | 'medium' | 'low' = 'low'
    const reasons: string[] = []
    if (sig.daysSinceLastVisit >= 21) { priority = 'high'; reasons.push(`No visit in ${sig.daysSinceLastVisit} days`) }
    else if (sig.daysSinceLastVisit >= 14) { priority = priority === 'low' ? 'medium' : priority; reasons.push(`Long gap: ${sig.daysSinceLastVisit} days`) }

    if (typeof sig.momDeltaPct === 'number' && sig.momDeltaPct < -15) {
      priority = 'high'
      reasons.push(`Sales down ${sig.momDeltaPct.toFixed(1)}% MoM`)
    }

    if (sig.unresolvedIssueCount > 0) {
      priority = 'high'
      reasons.push(`${sig.unresolvedIssueCount} unresolved issue(s)`) 
    }

    const reason = reasons.join(' • ') || 'Routine check-in'

    return {
      storeId: s.id,
      storeName: s.storeName,
      city: s.city,
      brandFocus: Array.from(new Set(sig.brandFocus)).slice(0, 4),
      reason,
      priority
    }
  })
  // sort by priority and gap
  const priorityRank = { high: 3, medium: 2, low: 1 }
  storesToVisit.sort((a, b) => {
    if (priorityRank[b.priority] !== priorityRank[a.priority]) return priorityRank[b.priority] - priorityRank[a.priority]
    const aDays = storeSignals.get(a.storeId)?.daysSinceLastVisit ?? 0
    const bDays = storeSignals.get(b.storeId)?.daysSinceLastVisit ?? 0
    return bDays - aDays
  })

  // Discussion points from issues, remarks, announcements
  const discussionPoints: DostDiscussionPoint[] = []
  const storeMeta = new Map(executive.executiveStores.map(es => [es.storeId, { name: es.store.storeName }]))
  for (const { storeId, issues } of unresolvedIssuesByStore) {
    const sig = storeSignals.get(storeId)
    const storeName = storeMeta.get(storeId)?.name || undefined
    if (issues.length > 0) {
      discussionPoints.push({
        storeId,
        storeName,
        topic: 'Unresolved issues follow-up',
        reason: (issues.slice(0, 2).map(i => i.details).filter(Boolean).join(' | ')) || 'Open issues present',
        urgency: 'high'
      })
    }
    if (sig?.remarks) {
      discussionPoints.push({
        storeId,
        storeName,
        topic: 'Follow up on last visit remarks',
        reason: sig.remarks,
        urgency: 'medium'
      })
    }
  }

  const schemeAnnouncements = announcements.filter(a => /scheme|incentive|offer|diwali|festival/i.test(`${a.title} ${a.message}`))
  if (schemeAnnouncements.length) {
    discussionPoints.push({
      storeId: null,
      topic: 'Discuss current incentives/schemes',
      reason: schemeAnnouncements[0].title || 'Active scheme announced',
      urgency: 'medium'
    })
  }

  // Performance insights
  const missedStores = storesToVisit.filter(s => (storeSignals.get(s.storeId)?.daysSinceLastVisit ?? 0) >= 21)
  const drops = storesToVisit.filter(s => (storeSignals.get(s.storeId)?.momDeltaPct ?? 0) < -15)
  const performanceInsights: DostPerformanceInsight[] = []
  if (missedStores.length) {
    performanceInsights.push({
      metric: 'Visit coverage',
      finding: `${missedStores.length} store(s) have not been visited in 21+ days`,
      suggestion: 'Prioritize these stores in your next route plan',
      severity: 'high'
    })
  }
  if (drops.length) {
    performanceInsights.push({
      metric: 'MoM revenue',
      finding: `${drops.length} store(s) show >15% MoM revenue decline`,
      suggestion: 'Investigate root causes, align with store on push SKUs and schemes',
      severity: 'high'
    })
  }

  // 2. Build prompt for LLM
  const systemPrompt = `You are Dost, an AI assistant for field sales executives. You produce concise, actionable suggestions and short, grounded answers. Prefer data from the provided context; if something isn't in context, state that clearly and suggest the best next action to obtain it. Always return strictly valid JSON and nothing else.`

  const context = {
    executive: { id: executive.id, name: executive.name, region: executive.region },
    stores: executive.executiveStores.map(es => ({ id: es.store.id, name: es.store.storeName, city: es.store.city })),
    signals: Array.from(storeSignals.entries()).map(([storeId, s]) => ({
      storeId,
      daysSinceLastVisit: s.daysSinceLastVisit,
      unresolvedIssueCount: s.unresolvedIssueCount,
      momDeltaPct: s.momDeltaPct,
      remarks: s.remarks
    })),
    schemeAnnouncements: schemeAnnouncements.map(a => ({ title: a.title, createdAt: a.createdAt }))
  }

  const expectedSchemaBase: any = {
    storesToVisit: [{ storeId: 'string', storeName: 'string', city: 'string', brandFocus: ['string'], reason: 'string', priority: 'high|medium|low' }],
    discussionPoints: [{ storeId: 'string|null', topic: 'string', reason: 'string', urgency: 'high|medium|low' }],
    performanceInsights: [{ metric: 'string', finding: 'string', suggestion: 'string', severity: 'high|medium|low' }],
    generatedAt: 'ISO timestamp string'
  }
  if (opts?.question) {
    expectedSchemaBase.answer = { question: 'string', answer: 'string' }
  }

  const userPrompt = `${opts?.question ? `Executive question: ${opts.question}\n\n` : ''}Using the context below, produce a JSON object that matches this TypeScript-like schema (values only):\n${JSON.stringify(expectedSchemaBase)}\n\nContext: ${JSON.stringify(context)}\n\nRules:\n- Be specific and actionable.\n- Prioritize stores with large visit gaps or MoM drops or unresolved issues.\n- Limit storesToVisit to top 5.\n- If you provide an answer, ensure it is concise (<= 6 bullets or 120 words) and grounded in the provided context; if context is insufficient, say so and offer next best steps.\n- Output JSON only, no markdown.`

  // 3. Call LLM with graceful fallback
  let aiJson: DostSuggestions | null = null
  try {
    const raw = await generateJSON({ systemPrompt, userPrompt })
    aiJson = JSON.parse(raw)
  } catch (e) {
    // Fallback to heuristic-only suggestions (deterministic)
    aiJson = {
      storesToVisit: storesToVisit.slice(0, 5),
      discussionPoints: discussionPoints.slice(0, 6),
      performanceInsights,
      generatedAt: now.toISOString()
    }
  }

  // Build a deterministic answer from heuristics for common intents
  function buildHeuristicAnswer(question?: string): DostAnswer | undefined {
    if (!question) return undefined
    const q = question.toLowerCase().trim()

    const topStores = storesToVisit.slice(0, 5)
    const issues = discussionPoints.filter(d => d.topic.toLowerCase().includes('issue'))
    const perf = performanceInsights

    // 0) Small talk / greetings / help
    if (/^(hi|hello|hey|namaste|yo|good\s(morning|evening|afternoon))\b/.test(q)) {
      const name = executive.name?.split(' ')?.[0] || 'there'
      const tip = topStores.length ? `I can also suggest where to go next. For example: "Which store should I visit today?"` : `Ask me anything about your stores, visits, or sales.`
      return { question, answer: `Hello ${name}! 👋 How can I help today? ${tip}` }
    }
    if (/(thank\s?you|thanks|shukriya|dhanyavaad)/.test(q)) {
      return { question, answer: 'You’re welcome! Happy to help. If you need ideas, try: "Show my biggest sales gaps" or "Which stores are overdue for a visit?"' }
    }
    if (/(help|what can you do|capabilities|how to use)/.test(q)) {
      return { question, answer: 'I’m Dost. I analyze your assigned stores, visits, issues, and sales to: 1) Recommend next stores to visit, 2) List follow-ups on unresolved issues, 3) Highlight sales gaps/opportunities, 4) Answer specific questions like "Which 5 stores to visit now?" or "Any MoM drops?"' }
    }

    // 1) Route planning intent
    if (/(which|where).*(visit|store)|visit\s(plan|route)|next\sbest\sstore/.test(q)) {
      if (topStores.length === 0) {
        return { question, answer: 'No assigned stores found. Please check your store assignments.' }
      }
      const lines = topStores.map((s, i) => `${i + 1}. ${s.storeName}${s.city ? ` (${s.city})` : ''} — ${s.reason}`)
      return { question, answer: `Visit these next (priority order):\n${lines.join('\n')}` }
    }

    // 2) Issue follow-up intent
    if (/(issue|unresolved|follow[- ]?up|pending\s(task|issue))/.test(q)) {
      if (issues.length === 0) {
        return { question, answer: 'No unresolved issues found across your stores.' }
      }
      const lines = issues.slice(0, 6).map((d, i) => `${i + 1}. ${d.reason}${d.storeId ? ` [Store: ${d.storeId}]` : ''}`)
      return { question, answer: `Unresolved items to follow up:\n${lines.join('\n')}` }
    }

    // 3) Sales/performance insights
    if (/(sale|revenue|performance|gap|drop|m\s?o\s?m|month[- ]?over[- ]?month)/.test(q)) {
      if (perf.length === 0) {
        return { question, answer: 'No performance insights available yet. Try making some visits or ensure sales data is loaded.' }
      }
      const lines = perf.slice(0, 5).map((p, i) => `${i + 1}. ${p.metric}: ${p.finding} — ${p.suggestion}`)
      return { question, answer: `Key performance notes:\n${lines.join('\n')}` }
    }

    // 4) Default short, contextual summary
    const lines: string[] = []
    if (topStores.length) lines.push(`Top stores to visit: ${topStores.slice(0, 3).map(s => s.storeName).join(', ')}`)
    if (issues.length) lines.push(`${issues.length} unresolved issue(s) pending`)
    if (perf.length) lines.push(`${perf.length} performance insight(s) identified`)
    return { question, answer: lines.length ? lines.join('\n') : 'I do not yet have enough data. Try visiting stores or importing sales to generate insights.' }
  }

  // 4. Ensure structure and fill missing fields from heuristics
  const merged: DostSuggestions = {
    storesToVisit: (aiJson?.storesToVisit?.length ? aiJson.storesToVisit : storesToVisit.slice(0, 5)) as DostStoreSuggestion[],
    discussionPoints: (aiJson?.discussionPoints?.length ? aiJson.discussionPoints : discussionPoints.slice(0, 6)) as DostDiscussionPoint[],
    performanceInsights: (aiJson?.performanceInsights?.length ? aiJson.performanceInsights : performanceInsights) as DostPerformanceInsight[],
    generatedAt: aiJson?.generatedAt || now.toISOString(),
    answer: aiJson?.answer || buildHeuristicAnswer(opts?.question)
  }

  return merged
}
