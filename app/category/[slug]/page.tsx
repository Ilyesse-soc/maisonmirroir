import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProductsByCategory, categories } from '@/lib/products'
import { dividerStyle, fonts, pageMaxWidth, theme } from '@/lib/uiStyles'

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }))
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = categories.find((c) => c.slug === params.slug)
  if (!cat) notFound()

  const products = getProductsByCategory(params.slug)

  return (
    <div style={{ paddingTop: 80 }}>
      {/* Header */}
      <section
        style={{
          position: 'relative',
          padding: '112px 24px',
          textAlign: 'center',
          background: theme.marble,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Image src={cat.image} alt={cat.label} fill style={{ objectFit: 'cover', opacity: 0.15 }} />
        </div>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 672, margin: '0 auto' }}>
          <p style={{ fontFamily: fonts.display, fontSize: 12, letterSpacing: '0.40em', textTransform: 'uppercase', marginBottom: 16, color: theme.gold }}>
            Collection
          </p>
          <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 300, marginBottom: 16, color: theme.textDark }}>
            {cat.label}
          </h1>
          <div style={{ ...dividerStyle(60), margin: '20px auto' }} />
          <p style={{ fontSize: 14, letterSpacing: '0.04em', lineHeight: 1.8, fontFamily: fonts.body, color: theme.textMid }}>
            {cat.description}
          </p>
        </div>
      </section>

      {/* Products grid */}
      <section style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: pageMaxWidth, margin: '0 auto' }}>
          {products.length === 0 ? (
            <p style={{ textAlign: 'center', fontFamily: fonts.body, color: '#a8a29e' }}>
              Aucun produit disponible pour le moment.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 32,
              }}
            >
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', marginBottom: 20, background: '#fafaf9' }}>
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 300, marginBottom: 8, color: theme.textDark }}>
                      {product.name}
                    </h3>
                    {typeof product.originalPrice === 'number' && product.originalPrice > product.price ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            color: theme.textMid,
                            textDecoration: 'line-through',
                          }}
                        >
                          {product.originalPrice} €
                        </span>
                        <span style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 400, color: theme.gold }}>
                          {product.price} €
                        </span>
                        <span
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 10,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: theme.gold,
                            border: `1px solid ${theme.gold}`,
                            padding: '4px 8px',
                          }}
                        >
                          -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                        </span>
                      </div>
                    ) : (
                      <p style={{ fontFamily: fonts.body, fontSize: 14, color: theme.gold }}>
                        {product.price} €
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
