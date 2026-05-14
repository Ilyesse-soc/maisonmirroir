import Image from 'next/image'
import Link from 'next/link'
import { categories, products } from '@/lib/products'
import { buttonGoldStyle, dividerStyle, fonts, pageMaxWidth, theme } from '@/lib/uiStyles'

export default function CataloguePage() {
  const formatPrice = (n: number) => (Number.isFinite(n) ? n.toFixed(2).replace('.00', '') : String(n))

  return (
    <div style={{ paddingTop: 80, background: theme.marble }}>
      {/* Hero */}
      <section
        style={{
          position: 'relative',
          padding: '112px 24px 88px',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <Image src="/images/welcome-signature.jpg" alt="Catalogue Maison Miroir" fill style={{ objectFit: 'cover', opacity: 0.12 }} priority />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.88), rgba(255,255,255,0.96))' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 10, maxWidth: pageMaxWidth, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: fonts.display, fontSize: 12, letterSpacing: '0.40em', textTransform: 'uppercase', marginBottom: 16, color: theme.gold }}>
            Catalogue premium
          </p>
          <h1 style={{ fontFamily: fonts.display, fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', fontWeight: 300, marginBottom: 14, color: theme.textDark }}>
            Nos créations
          </h1>
          <div style={{ ...dividerStyle(72), margin: '22px auto' }} />
          <p style={{ maxWidth: 760, margin: '0 auto', fontSize: 14, lineHeight: 1.9, letterSpacing: '0.04em', fontFamily: fonts.body, color: theme.textMid }}>
            Découvrez l’ensemble de nos produits personnalisés — sacs, panneaux de bienvenue, gourmandises et cadeaux invités.
          </p>
        </div>
      </section>

      {/* Products sections */}
      <section style={{ padding: '48px 24px 88px', background: 'white' }}>
        <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 56 }}>
          {products.map((p) => {
            const category = categories.find((c) => c.slug === p.category)
            return (
              <div key={p.id} style={{ border: `1px solid ${theme.creamDark}`, background: 'white', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '18px 22px',
                    background: 'linear-gradient(135deg, #1a1408, #2c200f)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: fonts.body, fontSize: 10, letterSpacing: '0.30em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                      {category?.label ?? p.categoryLabel}
                    </span>
                    <span style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 300, color: 'white' }}>{p.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontFamily: fonts.display, fontSize: 18, color: theme.goldLight }}>
                      À partir de {formatPrice(p.price)} €
                    </span>
                    <span style={{ display: 'block', fontFamily: fonts.body, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                      Prix unitaire
                    </span>
                  </div>
                </div>

                <div style={{ padding: '22px 22px 26px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: 28,
                      alignItems: 'start',
                    }}
                  >
                    {/* Images */}
                    <div>
                      <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: '#fafaf9' }}>
                        <Image src={p.images[0]} alt={p.name} fill style={{ objectFit: 'cover' }} />
                      </div>
                      {p.images.length > 1 && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 12, overflowX: 'auto', paddingBottom: 6 }}>
                          {p.images.map((img) => (
                            <div key={img} style={{ position: 'relative', width: 92, flex: '0 0 auto', aspectRatio: '1 / 1', overflow: 'hidden', background: '#fafaf9', border: `1px solid ${theme.creamDark}` }}>
                              <Image src={img} alt={p.name} fill style={{ objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div>
                      <p style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 1.9, letterSpacing: '0.04em', color: theme.textMid, marginBottom: 18 }}>
                        {p.description}
                      </p>

                      {p.features.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <p style={{ fontFamily: fonts.display, fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: theme.gold, marginBottom: 10 }}>
                            Détails
                          </p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {p.features.map((f) => (
                              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: fonts.body, fontSize: 12, letterSpacing: '0.04em', color: theme.textMid, lineHeight: 1.7 }}>
                                <span style={{ color: theme.gold }}>◇</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Link href={`/product/${p.id}`} className="btn-gold" style={buttonGoldStyle({ fontSize: 12 })}>
                        Commander
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
