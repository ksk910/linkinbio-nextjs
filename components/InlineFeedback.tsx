type InlineFeedbackType = 'success' | 'error'

type InlineFeedbackProps = {
  type: InlineFeedbackType
  text: string
  className?: string
}

export default function InlineFeedback({ type, text, className = '' }: InlineFeedbackProps) {
  if (!text) return null

  const colorClass = type === 'success' ? 'text-green-600' : 'text-red-600'
  return <p className={`text-sm ${colorClass} ${className}`.trim()}>{text}</p>
}
