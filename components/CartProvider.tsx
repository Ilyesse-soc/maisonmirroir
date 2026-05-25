'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { CART_SHIPPING_KEY, CART_STORAGE_KEY, type CartItem, type CartSnapshot, getCartItemCount, getCartShippingPrice, mergeCartItems } from '@/lib/cart'
import { SHIPPING_METHODS, getShippingMethodById } from '@/lib/shipping'

type AddCartItemInput = Omit<CartItem, 'key'>

type CartContextValue = {
  items: CartItem[]
  shippingMethodId: string
  itemCount: number
  isReady: boolean
  isDrawerOpen: boolean
  flashMessage: string
  selectedShippingPrice: number
  addItem: (item: AddCartItemInput) => void
  removeItem: (key: string) => void
  updateItemQuantity: (key: string, quantity: number) => void
  clearCart: () => void
  setShippingMethodId: (shippingMethodId: string) => void
  openDrawer: () => void
  closeDrawer: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [shippingMethodId, setShippingMethodIdState] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [flashMessage, setFlashMessage] = useState('')

  useEffect(() => {
    try {
      const rawCart = window.localStorage.getItem(CART_STORAGE_KEY)
      if (rawCart) {
        const parsed = JSON.parse(rawCart) as Partial<CartSnapshot>
        if (Array.isArray(parsed.items)) {
          setItems(
            parsed.items
              .filter((item): item is CartItem => Boolean(item && item.key && item.productId && item.name))
              .map((item) => ({
                ...item,
                quantity: Math.max(1, Math.trunc(item.quantity || 1)),
              })),
          )
        }
        if (typeof parsed.shippingMethodId === 'string') {
          const shipping = getShippingMethodById(parsed.shippingMethodId)
          if (shipping) setShippingMethodIdState(shipping.id)
        }
      }

      if (!shippingMethodId) {
        const storedShipping = window.localStorage.getItem(CART_SHIPPING_KEY)
        if (storedShipping) {
          const shipping = getShippingMethodById(storedShipping)
          if (shipping) setShippingMethodIdState(shipping.id)
        }
      }
    } catch {
      // ignore corrupted storage
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!isReady) return
    try {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ items, shippingMethodId } satisfies CartSnapshot),
      )
      if (shippingMethodId) {
        window.localStorage.setItem(CART_SHIPPING_KEY, shippingMethodId)
      }
    } catch {
      // ignore storage failures
    }
  }, [items, shippingMethodId, isReady])

  useEffect(() => {
    if (!flashMessage) return undefined
    const timer = window.setTimeout(() => setFlashMessage(''), 2200)
    return () => window.clearTimeout(timer)
  }, [flashMessage])

  useEffect(() => {
    if (!shippingMethodId && SHIPPING_METHODS[0]) {
      setShippingMethodIdState(SHIPPING_METHODS[0].id)
    }
  }, [shippingMethodId])

  const addItem = (item: AddCartItemInput) => {
    setItems((currentItems) => mergeCartItems(currentItems, item))
    setFlashMessage('Produit ajouté au panier')
    setIsDrawerOpen(true)
  }

  const removeItem = (key: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.key !== key))
  }

  const updateItemQuantity = (key: string, quantity: number) => {
    const normalizedQuantity = Math.max(1, Math.trunc(quantity))
    setItems((currentItems) =>
      currentItems
        .map((item) => (item.key === key ? { ...item, quantity: normalizedQuantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const setShippingMethodId = (nextShippingMethodId: string) => {
    const shipping = getShippingMethodById(nextShippingMethodId)
    if (!shipping) return
    setShippingMethodIdState(shipping.id)
  }

  const value = useMemo<CartContextValue>(() => {
    const selectedShippingPrice = getCartShippingPrice(shippingMethodId)

    return {
      items,
      shippingMethodId,
      itemCount: getCartItemCount(items),
      isReady,
      isDrawerOpen,
      flashMessage,
      selectedShippingPrice,
      addItem,
      removeItem,
      updateItemQuantity,
      clearCart,
      setShippingMethodId,
      openDrawer: () => setIsDrawerOpen(true),
      closeDrawer: () => setIsDrawerOpen(false),
    }
  }, [items, shippingMethodId, isReady, isDrawerOpen, flashMessage])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
