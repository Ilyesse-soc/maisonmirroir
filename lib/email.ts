import { Resend } from 'resend'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function getEmailFrom() {
  const value = (process.env.EMAIL_FROM || process.env.OWNER_EMAIL || '').trim()
  return value
}

export function getAdminEmail() {
  const value = (process.env.EMAIL_ADMIN || process.env.OWNER_EMAIL || '').trim()
  return value
}

export function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new Resend(apiKey)
}

export function isEmailConfigReady() {
  return Boolean(getResendClient() && isNonEmptyString(getEmailFrom()) && isNonEmptyString(getAdminEmail()))
}

export async function sendEmailOrThrow(params: {
  from?: string
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: Array<{ filename: string; contentType: string; content: string }>
}) {
  const resend = getResendClient()
  const from = (params.from || getEmailFrom()).trim()
  if (!resend) throw new Error('RESEND_API_KEY is not configured')
  if (!from) throw new Error('EMAIL_FROM is not configured')

  return resend.emails.send({
    from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
    attachments: params.attachments,
  } as any)
}

export function normalizeEmailError(error: unknown) {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Unknown email error'
}
