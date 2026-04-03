import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getProductsByCategory, categories } from '@/lib/products'
import ProductCard from '@/components/ProductCard'
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
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
