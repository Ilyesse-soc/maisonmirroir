import { NextResponse } from 'next/server'
import { readOrders } from '@/lib/orderStore'

export async function GET() {
  try {
    const orders = await readOrders()
    return NextResponse.json({ orders })
  } catch {
    return NextResponse.json({ error: 'Impossible de charger les commandes' }, { status: 500 })
  }
}
