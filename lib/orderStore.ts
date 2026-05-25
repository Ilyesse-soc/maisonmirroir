import { promises as fs } from 'fs'
import path from 'path'
import type { OrderRecord } from '@/lib/orderTypes'

const LOCAL_ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json')
const TMP_ORDERS_FILE = path.join('/tmp', 'maison-miroir', 'orders.json')

let cachedOrdersFilePath: string | null = null

function resolvePreferredOrdersFilePath() {
  const explicitPath = (process.env.ORDERS_FILE_PATH || '').trim()
  if (explicitPath) return explicitPath
  if (process.env.VERCEL) return TMP_ORDERS_FILE
  return LOCAL_ORDERS_FILE
}

async function tryEnsureOrdersFile(filePath: string) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, '[]', 'utf-8')
  }
}

async function getOrdersFilePath() {
  if (cachedOrdersFilePath) return cachedOrdersFilePath

  const preferred = resolvePreferredOrdersFilePath()
  try {
    await tryEnsureOrdersFile(preferred)
    cachedOrdersFilePath = preferred
    if (preferred === TMP_ORDERS_FILE) {
      console.warn('[orderStore] using ephemeral /tmp storage on Vercel')
    }
    return cachedOrdersFilePath
  } catch (error) {
    if (preferred !== TMP_ORDERS_FILE) {
      await tryEnsureOrdersFile(TMP_ORDERS_FILE)
      cachedOrdersFilePath = TMP_ORDERS_FILE
      console.warn('[orderStore] fallback to /tmp storage due to preferred path failure', {
        preferred,
      })
      return cachedOrdersFilePath
    }
    throw error
  }
}

async function ensureOrdersFile() {
  await getOrdersFilePath()
}

export async function readOrders(): Promise<OrderRecord[]> {
  await ensureOrdersFile()
  const filePath = await getOrdersFilePath()
  const raw = await fs.readFile(filePath, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as OrderRecord[]
  } catch {
    return []
  }
}

export async function writeOrders(orders: OrderRecord[]) {
  await ensureOrdersFile()
  const filePath = await getOrdersFilePath()
  await fs.writeFile(filePath, JSON.stringify(orders, null, 2), 'utf-8')
}

export async function saveOrder(order: OrderRecord) {
  const orders = await readOrders()
  orders.unshift(order)
  await writeOrders(orders)
  return order
}

export async function updateOrder(orderId: string, patch: Partial<OrderRecord>) {
  const orders = await readOrders()
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index < 0) return null
  const updated = { ...orders[index], ...patch }
  orders[index] = updated
  await writeOrders(orders)
  return updated
}
