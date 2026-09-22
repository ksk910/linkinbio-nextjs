import assert from 'node:assert/strict'
import test from 'node:test'
import analyticsHandler from '../../pages/api/profile/analytics'
import { signToken } from '../../lib/auth'
import { prisma } from '../../lib/prisma'
import { createMockReq, createMockRes } from './helpers'

function authHeader(userId: string) {
  return `Bearer ${signToken({ userId })}`
}

test('ANALYTICS POST records view and click events', async () => {
  const created: Array<{ profileId: string; type: string; linkId: string | null }> = []
  const originalFindUnique = prisma.profile.findUnique
  const originalCreate = prisma.analyticsEvent.create

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_demo', userId: 'user_analytics_demo' })
  ;(prisma.analyticsEvent.create as any) = async ({ data }: any) => {
    created.push(data)
    return { id: 'analytics_event_1', ...data }
  }

  try {
    const req = createMockReq({
      method: 'POST',
      body: { profileId: 'profile_analytics_demo', type: 'view' },
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(created, [{ profileId: 'profile_analytics_demo', type: 'view', linkId: null }])
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.create as any) = originalCreate
  }
})

test('ANALYTICS POST rate limits repeated events for the same profile and IP', async () => {
  const created: Array<{ profileId: string; type: string; linkId: string | null }> = []
  const originalFindUnique = prisma.profile.findUnique
  const originalCreate = prisma.analyticsEvent.create

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_rate_limit', userId: 'user_analytics_rate_limit' })
  ;(prisma.analyticsEvent.create as any) = async ({ data }: any) => {
    created.push(data)
    return { id: 'analytics_event_rate_limit', ...data }
  }

  try {
    const req1 = createMockReq({
      method: 'POST',
      body: { profileId: 'profile_analytics_rate_limit', type: 'view' },
      headers: { host: 'localhost:3000', 'x-forwarded-for': '203.0.113.10' },
    })
    const res1 = createMockRes()
    await analyticsHandler(req1, res1)

    const req2 = createMockReq({
      method: 'POST',
      body: { profileId: 'profile_analytics_rate_limit', type: 'click', linkId: 'link_1' },
      headers: { host: 'localhost:3000', 'x-forwarded-for': '203.0.113.10' },
    })
    const res2 = createMockRes()
    await analyticsHandler(req2, res2)

    assert.equal(res1.statusCode, 200)
    assert.equal(res2.statusCode, 429)
    assert.equal(created.length, 1)
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.create as any) = originalCreate
  }
})

test('ANALYTICS GET supports a 30-day trend range', async () => {
  const originalFindUnique = prisma.profile.findUnique
  const originalFindManyEvents = prisma.analyticsEvent.findMany
  const originalFindManyLinks = prisma.link.findMany

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_range', userId: 'user_analytics_range' })
  ;(prisma.analyticsEvent.findMany as any) = async () => [
    { id: 'c1', profileId: 'profile_analytics_range', type: 'view', linkId: null, createdAt: new Date() },
  ]
  ;(prisma.link.findMany as any) = async () => []

  try {
    const req = createMockReq({
      method: 'GET',
      query: { profileId: 'profile_analytics_range', days: '30' },
      headers: { host: 'localhost:3000', authorization: authHeader('user_analytics_range') },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.jsonBody.dailyTrend.length, 30)
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.findMany as any) = originalFindManyEvents
    ;(prisma.link.findMany as any) = originalFindManyLinks
  }
})

test('ANALYTICS GET returns top links breakdown', async () => {
  const originalFindUnique = prisma.profile.findUnique
  const originalFindManyEvents = prisma.analyticsEvent.findMany
  const originalFindManyLinks = prisma.link.findMany

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_links', userId: 'user_analytics_links' })
  ;(prisma.analyticsEvent.findMany as any) = async () => [
    { id: 'b1', profileId: 'profile_analytics_links', type: 'click', linkId: 'link_1', createdAt: new Date() },
    { id: 'b2', profileId: 'profile_analytics_links', type: 'click', linkId: 'link_2', createdAt: new Date() },
    { id: 'b3', profileId: 'profile_analytics_links', type: 'click', linkId: 'link_1', createdAt: new Date() },
    { id: 'b4', profileId: 'profile_analytics_links', type: 'view', linkId: null, createdAt: new Date() },
  ]
  ;(prisma.link.findMany as any) = async () => [
    { id: 'link_1', title: 'Instagram', profileId: 'profile_analytics_links' },
    { id: 'link_2', title: 'YouTube', profileId: 'profile_analytics_links' },
    { id: 'link_3', title: 'Hidden', profileId: 'profile_analytics_links' },
  ]

  try {
    const req = createMockReq({
      method: 'GET',
      query: { profileId: 'profile_analytics_links' },
      headers: { host: 'localhost:3000', authorization: authHeader('user_analytics_links') },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody.topLinks, [
      { id: 'link_1', title: 'Instagram', clickCount: 2 },
      { id: 'link_2', title: 'YouTube', clickCount: 1 },
    ])
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.findMany as any) = originalFindManyEvents
    ;(prisma.link.findMany as any) = originalFindManyLinks
  }
})

test('ANALYTICS GET caps top links at five entries', async () => {
  const originalFindUnique = prisma.profile.findUnique
  const originalFindManyEvents = prisma.analyticsEvent.findMany
  const originalFindManyLinks = prisma.link.findMany

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_top5', userId: 'user_analytics_top5' })
  ;(prisma.analyticsEvent.findMany as any) = async () => [
    { id: 't1', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_1', createdAt: new Date() },
    { id: 't2', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_2', createdAt: new Date() },
    { id: 't3', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_3', createdAt: new Date() },
    { id: 't4', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_4', createdAt: new Date() },
    { id: 't5', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_5', createdAt: new Date() },
    { id: 't6', profileId: 'profile_analytics_top5', type: 'click', linkId: 'link_6', createdAt: new Date() },
  ]
  ;(prisma.link.findMany as any) = async () => [
    { id: 'link_1', title: 'Link 1', profileId: 'profile_analytics_top5' },
    { id: 'link_2', title: 'Link 2', profileId: 'profile_analytics_top5' },
    { id: 'link_3', title: 'Link 3', profileId: 'profile_analytics_top5' },
    { id: 'link_4', title: 'Link 4', profileId: 'profile_analytics_top5' },
    { id: 'link_5', title: 'Link 5', profileId: 'profile_analytics_top5' },
    { id: 'link_6', title: 'Link 6', profileId: 'profile_analytics_top5' },
  ]

  try {
    const req = createMockReq({
      method: 'GET',
      query: { profileId: 'profile_analytics_top5' },
      headers: { host: 'localhost:3000', authorization: authHeader('user_analytics_top5') },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.jsonBody.topLinks.length, 5)
    assert.deepEqual(res.jsonBody.topLinks.map((item: any) => item.id), ['link_1', 'link_2', 'link_3', 'link_4', 'link_5'])
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.findMany as any) = originalFindManyEvents
    ;(prisma.link.findMany as any) = originalFindManyLinks
  }
})

test('ANALYTICS GET defaults to a 7-day trend range', async () => {
  const originalFindUnique = prisma.profile.findUnique
  const originalFindMany = prisma.analyticsEvent.findMany
  const originalFindManyLinks = prisma.link.findMany

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_default_trend', userId: 'user_analytics_default_trend' })
  ;(prisma.analyticsEvent.findMany as any) = async () => [
    { id: 'd1', profileId: 'profile_analytics_default_trend', type: 'view', linkId: null, createdAt: new Date() },
  ]
  ;(prisma.link.findMany as any) = async () => []

  try {
    const req = createMockReq({
      method: 'GET',
      query: { profileId: 'profile_analytics_default_trend' },
      headers: { host: 'localhost:3000', authorization: authHeader('user_analytics_default_trend') },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.jsonBody.dailyTrend.length, 7)
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.findMany as any) = originalFindMany
    ;(prisma.link.findMany as any) = originalFindManyLinks
  }
})

test('ANALYTICS GET returns summary counts and insight summary', async () => {
  const originalFindUnique = prisma.profile.findUnique
  const originalFindMany = prisma.analyticsEvent.findMany

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_analytics_summary', userId: 'user_analytics_summary' })
  ;(prisma.analyticsEvent.findMany as any) = async () => [
    { id: 'a1', profileId: 'profile_analytics_summary', type: 'view', linkId: null, createdAt: today },
    { id: 'a2', profileId: 'profile_analytics_summary', type: 'view', linkId: null, createdAt: today },
    { id: 'a3', profileId: 'profile_analytics_summary', type: 'click', linkId: 'link_1', createdAt: yesterday },
  ]

  try {
    const req = createMockReq({
      method: 'GET',
      query: { profileId: 'profile_analytics_summary' },
      headers: { host: 'localhost:3000', authorization: authHeader('user_analytics_summary') },
    })
    const res = createMockRes()

    await analyticsHandler(req, res)

    const dateKey = (value: Date) => value.toISOString().split('T')[0]
    const expectedTrend = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(today.getDate() - 6 + index)
      const key = dateKey(day)
      const views = key === dateKey(today) ? 2 : 0
      const clicks = key === dateKey(yesterday) ? 1 : 0
      return { date: key, views, clicks, total: views + clicks }
    })

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, {
      profileId: 'profile_analytics_summary',
      viewCount: 2,
      clickCount: 1,
      totalEvents: 3,
      dailyTrend: expectedTrend,
      topLinks: [],
      insight: {
        state: 'neutral',
        summary: 'Steady performance',
        delta: 1,
        currentPeriodTotal: 2,
        previousPeriodTotal: 1,
        actionKey: 'analyticsActionNeutral',
      },
    })
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.analyticsEvent.findMany as any) = originalFindMany
  }
})
