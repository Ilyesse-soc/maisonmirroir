import type { ShippingMethod } from '@/lib/shipping'

export type PaymentMethod = 'PAYPAL' | 'CARD'

export type OrderStatus = 'En attente' | 'Payee' | 'En preparation' | 'Expediee' | 'Livree' | 'Annulee'

export type CustomerInfo = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  zip: string
  country?: string
}

export type ProductInfo = {
  id: string
  name: string
  category: string
  categoryLabel?: string
  unitPrice: number
  quantity: number
  message?: string
}

export type ShippingSelection = Pick<ShippingMethod, 'id' | 'label' | 'shortLabel' | 'carrier' | 'price' | 'estimatedDelay' | 'trackingBaseUrl'>

export type OrderPayload = {
  product: ProductInfo
  items?: ProductInfo[]
  customValues?: Record<string, string>
  attachments?: Array<{
    filename: string
    contentType: string
    base64: string
  }>
  customer: CustomerInfo
  shippingMethodId: string
}

export type OrderRecord = {
  orderId: string
  orderDate: string
  paymentMethod: PaymentMethod
  paypalOrderId?: string
  customer: CustomerInfo
  items: ProductInfo[]
  customValues: Record<string, string>
  shipping: ShippingSelection
  subtotal: number
  total: number
  status: OrderStatus
  trackingNumber?: string
  trackingUrl?: string
}
