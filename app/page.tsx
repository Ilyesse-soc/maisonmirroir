import Image from 'next/image'
import Link from 'next/link'
import { categories, products } from '@/lib/products'
import ProductCard from '@/components/ProductCard'
import {
  buttonGoldStyle,
  buttonOutlineGoldStyle,
  dividerStyle,
  fonts,
  pageMaxWidth,
  theme,
} from '@/lib/uiStyles'

export default function HomePage() {
  const featured = products.slice(0, 4)

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* ── HERO ── */}
      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <Image
            src="/images/tray-ring.jpg"
            alt="Maison Miroir"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.60), rgba(0,0,0,0.40), rgba(0,0,0,0.70))',
            }}
          />
          {/* Gold shimmer overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              background: 'radial-gradient(ellipse at 50% 50%, rgba(201,162,39,0.4) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Content */}
        <div
          className="mm-hero-content"
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            padding: '0 24px',
            maxWidth: 768,
            margin: '0 auto',
          }}
        >
          {/* Decorative line */}
          <div className="mm-hero-badge mm-fade mm-d1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{ height: 1, width: 64, background: 'linear-gradient(90deg, transparent, rgba(232,208,138,1))' }} />
            <span
              style={{
                color: theme.goldLight,
                fontSize: 12,
                letterSpacing: '0.40em',
                textTransform: 'uppercase',
                fontFamily: fonts.body,
              }}
            >
              Artisanat d'exception
            </span>
            <div style={{ height: 1, width: 64, background: 'linear-gradient(270deg, transparent, rgba(232,208,138,1))' }} />
          </div>

          <h1 className="mm-fade mm-d2" style={{ fontFamily: fonts.display, color: 'white', marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 'clamp(3rem, 7vw, 5rem)', fontWeight: 300, letterSpacing: '0.02em' }}>
              Maison
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: fonts.script,
                marginTop: 8,
                fontSize: 'clamp(3rem, 8vw, 6rem)',
                color: theme.goldLight,
                fontWeight: 400,
              }}
            >
              Miroir
            </span>
          </h1>

          <div className="divider mm-fade mm-d3" style={{ ...dividerStyle(60), margin: '24px auto' }} />

          <p
            className="mm-fade mm-d3"
            style={{
              color: 'rgba(255,255,255,0.80)',
              fontSize: 14,
              lineHeight: 1.8,
              letterSpacing: '0.04em',
              fontFamily: fonts.body,
              marginBottom: 40,
            }}
          >
            Maison Miroir vous aide à créer des détails uniques et raffinés pour les plus beaux moments de votre vie.
          </p>

          <div className="mm-hero-btns mm-fade mm-d4" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            <Link href="/category/plateaux" className="btn-gold" style={buttonGoldStyle()}>
              Découvrir les plateaux
            </Link>
            <Link
              href="/category/panneaux"
              style={{
                ...buttonOutlineGoldStyle(),
                color: 'white',
                border: '1px solid rgba(255,255,255,0.60)',
              }}
            >
              Voir les panneaux
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="mm-scroll-hint"
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.40)',
              fontSize: 12,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              fontFamily: fonts.body,
            }}
          >
            Défiler
          </span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(180deg, rgba(232,208,138,0.60), transparent)' }} />
        </div>
      </section>

      {/* ── BRAND MESSAGE ── */}
      <section className="mm-reveal" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 672, margin: '0 auto', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: fonts.display,
              fontSize: 12,
              letterSpacing: '0.40em',
              textTransform: 'uppercase',
              marginBottom: 24,
              color: theme.gold,
            }}
          >
            Notre savoir-faire
          </p>
          <h2
            style={{
              fontFamily: fonts.display,
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              fontWeight: 300,
              marginBottom: 24,
              color: theme.textDark,
            }}
          >
            Chaque pièce raconte<br />
            <em>votre histoire</em>
          </h2>
          <div style={{ ...dividerStyle(60), margin: '24px auto' }} />
          <p
            style={{
              fontSize: 14,
              lineHeight: 2,
              letterSpacing: '0.04em',
              fontFamily: fonts.body,
              color: theme.textMid,
            }}
          >
            De la gravure laser au choix des matières, nous concevons avec soin chaque plateau miroir et chaque panneau acrylique selon vos désirs. Basmala, prénoms, date et message personnalisé — votre cérémonie mérite des détails inoubliables.
          </p>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="mm-reveal" style={{ padding: '80px 24px', background: theme.marble }}>
        <div style={{ maxWidth: pageMaxWidth, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                letterSpacing: '0.40em',
                textTransform: 'uppercase',
                marginBottom: 16,
                color: theme.gold,
              }}
            >
              Collections
            </p>
            <h2
              style={{
                fontFamily: fonts.display,
                fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                fontWeight: 300,
                color: theme.textDark,
              }}
            >
              Nos produits
            </h2>
            <div style={{ ...dividerStyle(60), marginTop: 24 }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 32,
            }}
          >
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="mm-cat-card mm-reveal"
                style={{ display: 'block', position: 'relative', overflow: 'hidden', textDecoration: 'none' }}
              >
                <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden' }}>
                  <Image
                    src={cat.image}
                    alt={cat.label}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.40)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: 32,
                    }}
                  >
                    <div style={{ height: 1, width: 48, background: 'rgba(232,208,138,0.70)', marginBottom: 24 }} />
                    <h3
                      style={{
                        fontFamily: fonts.display,
                        fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                        color: 'white',
                        fontWeight: 300,
                        marginBottom: 12,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {cat.label}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, letterSpacing: '0.04em', fontFamily: fonts.body, marginBottom: 24 }}>
                      {cat.description}
                    </p>
                    <span
                      className="mm-cat-cta"
                      style={{
                        color: theme.goldLight,
                        fontSize: 12,
                        letterSpacing: '0.30em',
                        textTransform: 'uppercase',
                        fontFamily: fonts.body,
                        border: '1px solid rgba(232,208,138,0.50)',
                        padding: '10px 20px',
                      }}
                    >
                      Voir la collection
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section className="mm-reveal" style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: pageMaxWidth, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontFamily: fonts.display, fontSize: 12, letterSpacing: '0.40em', textTransform: 'uppercase', marginBottom: 16, color: theme.gold }}>
              Sélection
            </p>
            <h2 style={{ fontFamily: fonts.display, fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 300, color: theme.textDark }}>
              Nos créations
            </h2>
            <div style={{ ...dividerStyle(60), marginTop: 24 }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <section className="mm-reveal" style={{ padding: '64px 24px', background: theme.cream }}>
        <div
          style={{
            maxWidth: 896,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 40,
            textAlign: 'center',
          }}
        >
          {[
            { icon: '✦', title: 'Personnalisation totale', desc: 'Prénoms, date, verset ou phrase à votre choix' },
            { icon: '◈', title: 'Fabrication artisanale', desc: 'Chaque pièce est unique, créée avec soin' },
            { icon: '◇', title: 'Livraison sécurisée', desc: 'Emballage luxe et expédition soigneuse' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24, color: theme.gold }}>{icon}</span>
              <h4 style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 300, color: theme.textDark }}>{title}</h4>
              <div style={dividerStyle(60)} />
              <p style={{ fontSize: 12, letterSpacing: '0.04em', lineHeight: 1.8, fontFamily: fonts.body, color: theme.textMid }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
