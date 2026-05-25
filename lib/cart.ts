import { getShippingMethodById } from '@/lib/shipping'

export type CartAttachment = {
  filename: string
  contentType: string
  base64: string
}

export type CartItem = {
  key: string
  productId: string
  name: string
  category: string
  categoryLabel?: string
  image?: string
  variantLabel?: string
  unitPrice: number
  quantity: number
  customValues?: Record<string, string>
  attachments?: CartAttachment[]
}

export type CartSnapshot = {
  items: CartItem[]
  shippingMethodId: string
}

export const CART_STORAGE_KEY = 'mm:cart:v1'
export const CART_SHIPPING_KEY = 'mm:cart:shipping:v1'

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function serializeEntries(value?: Record<string, string>) {
  if (!value) return ''
  return Object.entries(value)
    .filter(([, itemValue]) => Boolean(itemValue))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([itemKey, itemValue]) => `${itemKey}:${itemValue}`)
    .join('|')
}

function serializeAttachments(value?: CartAttachment[]) {
  if (!value?.length) return ''
  return value
    .map((attachment) => `${attachment.filename}:${attachment.contentType}:${attachment.base64.length}`)
    .join('|')
}

export function buildCartItemKey(item: Omit<CartItem, 'key' | 'quantity'>) {
  const signature = [
    item.productId,
    item.variantLabel || '',
    item.unitPrice.toFixed(2),
    serializeEntries(item.customValues),
    serializeAttachments(item.attachments),
  ].join('::')

  return `cart:${signature}`
}

export function clampCartQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.trunc(quantity))
}

export function getCartItemSubtotal(item: CartItem) {
  return item.unitPrice * item.quantity
}

export function getCartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + getCartItemSubtotal(item), 0)
}

export function getCartShippingPrice(shippingMethodId: string) {
  return getShippingMethodById(shippingMethodId)?.price ?? 0
}

export function getCartTotal(items: CartItem[], shippingMethodId: string) {
  return getCartSubtotal(items) + getCartShippingPrice(shippingMethodId)
}

export function getCartItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function mergeCartItems(existingItems: CartItem[], nextItem: Omit<CartItem, 'key'>) {
  const key = buildCartItemKey(nextItem)
  const quantity = clampCartQuantity(nextItem.quantity)
  const existingIndex = existingItems.findIndex((item) => item.key === key)

  if (existingIndex === -1) {
    return [...existingItems, { ...nextItem, key, quantity }]
  }

  return existingItems.map((item, index) =>
    index === existingIndex ? { ...item, quantity: clampCartQuantity(item.quantity + quantity) } : item,
  )
}
