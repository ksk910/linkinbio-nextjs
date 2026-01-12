import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

interface FileUploadProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
}

export default function FileUpload({ onChange, disabled }: FileUploadProps) {
  const t = useTranslations('profileEdit')
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
    }
    onChange(e)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="py-2 px-4 rounded border border-0 text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
      >
        {fileName ? fileName : t('selectImageFile')}
      </button>
      {disabled && <span className="text-sm text-gray-600">{t('uploading')}</span>}
    </div>
  )
}
