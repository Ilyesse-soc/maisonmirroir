import Link from 'next/link'
import { dividerStyle, fonts, theme } from '@/lib/uiStyles'

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: '#1c1917',
        color: '#d6d3d1',
        padding: '64px 24px',
        marginTop: 0,
      }}
    >
      <div style={{ maxWidth: 1152, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 48,
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: fonts.display,
                  fontSize: 18,
                  textTransform: 'uppercase',
                  letterSpacing: '0.25em',
                  color: theme.goldLight,
                }}
              >
                Maison
              </span>
              <span
                style={{
                  fontFamily: fonts.script,
                  fontSize: 26,
                  marginLeft: 8,
                  color: 'white',
                }}
              >
                Miroir
              </span>
            </div>
            <p
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 1.8,
                letterSpacing: '0.04em',
                color: '#a8a29e',
              }}
            >
              Des créations uniques pour les plus beaux jours de votre vie. Chaque pièce est fabriquée à la main avec amour et précision.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4
              style={{
                fontFamily: fonts.display,
                fontSize: 14,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                marginBottom: 20,
                color: theme.goldLight,
              }}
            >
              Collections
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { href: '/category/plateaux', label: 'Plateaux personnalisés' },
                { href: '/category/panneaux', label: 'Panneaux décoratifs' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    color: '#d6d3d1',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4
              style={{
                fontFamily: fonts.display,
                fontSize: 14,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                marginBottom: 20,
                color: theme.goldLight,
              }}
            >
              Contact
            </h4>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontFamily: fonts.body,
                fontSize: 12,
                letterSpacing: '0.04em',
                color: '#a8a29e',
              }}
            >
              <p>maison.miroirs@gmail.com</p>
              <p>Livraison France & International</p>
              <p>Délai de création : 7–14 jours</p>
            </div>
          </div>
        </div>

        <div style={{ ...dividerStyle(120), marginBottom: 32 }} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            fontFamily: fonts.body,
            fontSize: 12,
            letterSpacing: '0.20em',
            color: '#78716c',
          }}
        >
          <p>© 2026 Maison Miroir. Tous droits réservés.</p>
          <p style={{ color: 'var(--gold-light)', opacity: 0.6 }}>
            Créé avec amour ✦
          </p>
        </div>
      </div>
    </footer>
  )
}
