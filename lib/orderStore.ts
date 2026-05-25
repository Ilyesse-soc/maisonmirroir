import { promises as fs } from 'fs'
import path from 'path'
import type { OrderRecord } from '@/lib/orderTypes'

const DATA_DIR = path.join(process.cwd(), 'data')
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json')

async function ensureOrdersFile() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(ORDERS_FILE)
  } catch {
    await fs.writeFile(ORDERS_FILE, '[]', 'utf-8')
  }
}

export async function readOrders(): Promise<OrderRecord[]> {
  await ensureOrdersFile()
  const raw = await fs.readFile(ORDERS_FILE, 'utf-8')
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
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8')
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
