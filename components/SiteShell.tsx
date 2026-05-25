'use client'

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import { CartProvider } from '@/components/CartProvider'

export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Navbar />
      <main style={{ minHeight: '100vh' }}>{children}</main>
      <Footer />
      <CartDrawer />
    </CartProvider>
  )
}
