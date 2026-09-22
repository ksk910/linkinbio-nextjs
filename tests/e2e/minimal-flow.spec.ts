import { test, expect } from '@playwright/test'

async function signupLoginAndOpenLinks(page: any, unique: string) {
  const email = `e2e_${unique}@example.com`
  const password = `StrongPass!${unique}`
  const slug = `e2e-${unique}`

  page.on('dialog', async (dialog: any) => {
    await dialog.accept()
  })

  await page.goto('/signup')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/verify-email\?token=/)
  await page.waitForLoadState('networkidle')

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/profile\/links/)

  await page.evaluate(async ({ profileSlug, uniqueSuffix }) => {
    const token = localStorage.getItem('token')
    const resp = await fetch('/api/profile', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        displayName: `E2E User ${uniqueSuffix}`,
        slug: profileSlug,
        accountStatus: 'active',
      }),
    })
    if (!resp.ok) throw new Error(`profile_setup_failed_${resp.status}`)
  }, { profileSlug: slug, uniqueSuffix: unique })

  await page.goto('/profile/links')
}

async function addLinkFromForm(page: any, params: {
  title: string
  url: string
  imageUrl?: string
  hidden?: boolean
}) {
  const linkForm = page.locator('form').first()
  const formInputs = linkForm.locator('input')

  await formInputs.nth(0).fill(params.title)
  await linkForm.locator('select').first().selectOption('url')
  await formInputs.nth(1).fill(params.url)
  await formInputs.nth(2).fill(params.imageUrl || '')
  const hiddenToggle = linkForm.locator('input[type="checkbox"]').first()
  if (params.hidden) await hiddenToggle.check()
  else await hiddenToggle.uncheck()
  await linkForm.locator('button[type="submit"], button').first().click()
}

// 音楽タイプのリンクはリンク管理画面のフォームからはもう作成できない
// （プロフィール編集のブロック機能と紛らわしいため削除済み）。
// 既存データに対するフィルタ表示の確認用に、API経由で直接作成する。
async function createMusicLinkViaApi(page: any, params: { title: string; url: string }) {
  await page.evaluate(async (p: { title: string; url: string }) => {
    const token = localStorage.getItem('token')
    const resp = await fetch('/api/profile/link', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title: p.title, url: p.url, type: 'music', musicProvider: 'spotify' }),
    })
    if (!resp.ok) throw new Error(`music_link_create_failed_${resp.status}`)
  }, params)
}

test('minimal user flow: signup -> login -> add links -> view public profile', async ({ page }) => {
  const unique = Date.now().toString()
  const linkTitle = `E2E Link ${unique}`
  const linkUrl = 'https://example.com/e2e'
  const musicTitle = `E2E Music ${unique}`
  const musicUpdatedTitle = `E2E Music Updated ${unique}`
  const musicUrl = `https://open.spotify.com/track/${unique}`

  await signupLoginAndOpenLinks(page, unique)

  const linksList = page.getByTestId('links-list')
  const linkRows = linksList.getByTestId('link-row')
  const copyButton = page.getByRole('button', { name: /copy|コピー/i })
  await expect(copyButton).toBeVisible()
  await copyButton.click()

  await addLinkFromForm(page, {
    title: linkTitle,
    url: linkUrl,
    imageUrl: 'https://picsum.photos/seed/e2e-link/64/64',
  })
  await expect(linkRows).toHaveCount(1)
  await expect(linkRows.first().getByRole('button', { name: /copy|コピー/i })).toBeVisible()

  await createMusicLinkViaApi(page, { title: musicTitle, url: musicUrl })
  await page.reload()
  await expect(linkRows).toHaveCount(2)

  const musicRow = linkRows.filter({ has: page.locator(`input[value="${musicUrl}"]`) }).first()
  const musicTitleInput = musicRow.locator('input').first()
  await musicTitleInput.fill(musicUpdatedTitle)
  await musicTitleInput.blur()

  await page.reload()
  const publicLink = page.locator('a[href*="/p/"]').first()
  await expect(publicLink).toBeVisible()
  const href = await publicLink.getAttribute('href')
  expect(href).toBeTruthy()

  await page.goto(href as string)
  await expect(page.locator(`a[href="${linkUrl}"]`)).toBeVisible()
  await expect(page.getByText(musicUpdatedTitle)).toBeVisible()
  await expect(page.locator('svg').first()).toBeVisible()
})

test('links filter flow: all / hidden / music and drag state', async ({ page }) => {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const hiddenUrl = `https://example.com/hidden-${unique}`
  const musicUrl = `https://open.spotify.com/track/${unique}`

  await signupLoginAndOpenLinks(page, unique)

  const linksList = page.getByTestId('links-list')
  const linkRows = linksList.getByTestId('link-row')

  await addLinkFromForm(page, {
    title: `E2E Link ${unique}`,
    url: 'https://example.com/e2e-filter',
  })
  await expect(linkRows).toHaveCount(1)

  await createMusicLinkViaApi(page, { title: `E2E Music ${unique}`, url: musicUrl })
  await page.reload()
  await expect(linkRows).toHaveCount(2)

  await addLinkFromForm(page, {
    title: `E2E Hidden ${unique}`,
    url: hiddenUrl,
    hidden: true,
  })

  await expect(linkRows).toHaveCount(3)

  const filterSelect = page.getByTestId('links-filter')
  await filterSelect.selectOption('hidden')
  await expect(linkRows).toHaveCount(1)
  await expect(linksList.locator('[data-testid="link-row"] input[type="checkbox"]:checked')).toHaveCount(1)
  await expect(linkRows.first()).toHaveJSProperty('draggable', false)

  await linkRows.first().getByRole('button', { name: /削除|Delete/ }).click()
  await expect(linkRows.first().getByRole('button', { name: /削除を確定|Confirm delete/ })).toBeVisible()
  await linkRows.first().getByRole('button', { name: /キャンセル|Cancel/ }).click()
  await expect(linkRows.first().getByRole('button', { name: /削除|Delete/ })).toBeVisible()

  await linkRows.first().getByRole('button', { name: /削除|Delete/ }).click()
  await linkRows.first().getByRole('button', { name: /削除を確定|Confirm delete/ }).click()
  await expect(linkRows).toHaveCount(0)

  await filterSelect.selectOption('music')
  await expect(linkRows).toHaveCount(1)
  await expect(linkRows.first().locator(`input[value="${musicUrl}"]`)).toHaveCount(1)
  await expect(linkRows.first()).toHaveJSProperty('draggable', false)

  await filterSelect.selectOption('all')
  await expect(linkRows).toHaveCount(2)
  await expect(linkRows.first()).toHaveJSProperty('draggable', true)
})
