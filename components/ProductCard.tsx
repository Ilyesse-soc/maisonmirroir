'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Product } from '@/lib/products'

type Props = {
  product: Product
}

function formatEUR(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ProductCard({ product }: Props) {
  const [isHovered, setIsHovered] = useState(false)

  const promo = useMemo(() => {
    const original = product.originalPrice
    const current = product.price
    if (typeof original !== 'number') return null
    if (!(original > 0 && current > 0)) return null
    if (current >= original) return null

    const percent = Math.round((1 - current / original) * 100)
    return {
      original,
      current,
      percent,
    }
  }, [product.originalPrice, product.price])

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="group relative"
    >
      <Link
        href={`/product/${product.id}`}
        className="block overflow-hidden rounded-2xl border border-[color:var(--cream-dark)] bg-white"
      >
        <div className="relative aspect-square overflow-hidden bg-[color:var(--cream)]">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/5 opacity-100 transition-opacity duration-300 group-hover:bg-black/10" />

          {/* Promo badge */}
          {promo && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-white/70 px-3 py-1 backdrop-blur">
              <span className="text-[10px] font-medium uppercase tracking-[0.20em] text-[color:var(--gold)]">
                Promo
              </span>
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[color:var(--text)]">
                -{promo.percent}%
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/30 via-black/10 to-transparent pb-5 pt-10">
            <span className="rounded-full border border-white/70 bg-white/10 px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white backdrop-blur-sm">
              Personnaliser
            </span>
          </div>
        </div>

        <div className="px-4 pb-5 pt-4 text-center">
          <p className="mb-1 text-[11px] uppercase tracking-[0.25em] text-[color:var(--gold)]">
            {product.categoryLabel}
          </p>
          <h3 className="mb-3 font-[inherit] text-[18px] font-light tracking-[0.02em] text-[color:var(--text)]">
            {product.name}
          </h3>

          {/* Prices */}
          {promo ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-[12px] tracking-[0.04em] text-[color:var(--mid)] line-through">
                {formatEUR(promo.original)}
              </span>
              <motion.span
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={
                  isHovered
                    ? { opacity: 1, y: 0, scale: 1.04 }
                    : { opacity: 1, y: 1, scale: 1 }
                }
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="text-[15px] font-semibold tracking-[0.04em] text-[color:var(--text)]"
              >
                {formatEUR(promo.current)}
              </motion.span>
            </div>
          ) : (
            <motion.span
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="text-[14px] tracking-[0.04em] text-[color:var(--mid)]"
            >
              À partir de {formatEUR(product.price)}
            </motion.span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
