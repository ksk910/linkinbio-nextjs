import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { profileId, type, linkId } = req.body || {}

    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'profile_id_required' })
    }
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'type_required' })
    }
    if (type !== 'view' && type !== 'click') {
      return res.status(400).json({ error: 'type_invalid' })
    }
    if (linkId !== undefined && typeof linkId !== 'string') {
      return res.status(400).json({ error: 'link_id_invalid' })
    }

    const profile = await prisma.profile.findUnique({ where: { id: profileId } })
    if (!profile) {
      return res.status(404).json({ error: 'profile_not_found' })
    }

    const rateLimitKey = `analytics:${profileId}:${getClientIp(req.headers)}`
    const rateLimit = checkRateLimit({ key: rateLimitKey, limit: 1, windowMs: 60_000 })
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSec))
      return res.status(429).json({ error: 'rate_limited' })
    }

    await prisma.analyticsEvent.create({
      data: {
        profileId,
        type,
        linkId: linkId || null,
      },
    })

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    const { profileId, days } = req.query
    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'profile_id_required' })
    }

    const parsedDays = typeof days === 'string' ? Number(days) : 7
    const trendDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7

    const profile = await prisma.profile.findUnique({ where: { id: profileId } })
    if (!profile) {
      return res.status(404).json({ error: 'profile_not_found' })
    }

    const events = await prisma.analyticsEvent.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const links = await prisma.link.findMany({
      where: { profileId },
      select: { id: true, title: true },
      orderBy: { order: 'asc' },
    })

    const viewCount = events.filter((event) => event.type === 'view').length
    const clickCount = events.filter((event) => event.type === 'click').length

    const clickCounts = events.reduce<Record<string, number>>((acc, event) => {
      if (event.type === 'click' && event.linkId) {
        acc[event.linkId] = (acc[event.linkId] || 0) + 1
      }
      return acc
    }, {})

    const topLinks = links
      .map((link) => ({
        id: link.id,
        title: link.title,
        clickCount: clickCounts[link.id] || 0,
      }))
      .filter((link) => link.clickCount > 0)
      .sort((a, b) => b.clickCount - a.clickCount || a.title.localeCompare(b.title))
      .slice(0, 5)

    const dailyTrend = Array.from({ length: trendDays }, (_, index) => {
      const day = new Date()
      day.setDate(day.getDate() - (trendDays - 1 - index))
      const key = day.toISOString().split('T')[0]
      const dayEvents = events.filter((event) => event.createdAt && event.createdAt.toISOString().split('T')[0] === key)
      const views = dayEvents.filter((event) => event.type === 'view').length
      const clicks = dayEvents.filter((event) => event.type === 'click').length
      return {
        date: key,
        views,
        clicks,
        total: views + clicks,
      }
    })

    const latest = dailyTrend[dailyTrend.length - 1]
    const previous = dailyTrend[dailyTrend.length - 2]
    const totalGrowth = latest && previous ? latest.total - previous.total : 0
    const currentPeriodTotal = latest?.total ?? 0
    const previousPeriodTotal = previous?.total ?? 0
    let insightState: 'positive' | 'neutral' | 'negative' = 'neutral'
    let insightSummary = 'Steady performance'
    let actionKey = 'analyticsActionNeutral'

    if (latest && previous) {
      if (totalGrowth >= 2) {
        insightState = 'positive'
        insightSummary = 'Engagement is rising'
        actionKey = 'analyticsActionPositive'
      } else if (totalGrowth <= -2) {
        insightState = 'negative'
        insightSummary = 'Engagement is slowing'
        actionKey = 'analyticsActionNegative'
      }
    }

    return res.status(200).json({
      profileId,
      viewCount,
      clickCount,
      totalEvents: events.length,
      dailyTrend,
      topLinks,
      insight: {
        state: insightState,
        summary: insightSummary,
        delta: totalGrowth,
        currentPeriodTotal,
        previousPeriodTotal,
        actionKey,
      },
    })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
