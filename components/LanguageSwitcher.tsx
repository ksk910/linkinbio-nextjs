import { useRouter } from 'next/router'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { pathname, asPath, query, locale } = router

  const changeLanguage = (newLocale: string) => {
    router.push({ pathname, query }, asPath, { locale: newLocale })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => changeLanguage('ja')}
        className={`px-2 py-1 text-sm rounded ${
          locale === 'ja' 
            ? 'bg-gray-800 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        日本語
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 text-sm rounded ${
          locale === 'en' 
            ? 'bg-gray-800 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        English
      </button>
    </div>
  )
}
