export async function getMessages(locale: string) {
  try {
    return (await import(`../locales/${locale}/common.json`)).default
  } catch (error) {
    return (await import(`../locales/ja/common.json`)).default
  }
}
