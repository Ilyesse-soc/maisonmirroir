'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buttonGoldStyle, fonts, theme } from '@/lib/uiStyles'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (isDesktop) setMenuOpen(false)
  }, [isDesktop])

  return (
    <nav
      id="mm-navbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: scrolled ? '12px 0' : '20px 0',
        backgroundColor: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : undefined,
        boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.06)' : undefined,
      }}
    >
      <div
        style={{
          maxWidth: 1152,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              color: theme.gold,
              lineHeight: 1.1,
            }}
          >
            Maison
          </span>
          <span
            style={{
              fontFamily: fonts.script,
              fontSize: 28,
              marginTop: -4,
              color: theme.textDark,
              lineHeight: 1.1,
            }}
          >
            Miroir
          </span>
        </Link>

        {/* Desktop nav */}
        {isDesktop && (
          <div className="mm-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            {[
              { href: '/', label: 'Accueil' },
              { href: '/category/plateaux', label: 'Plateaux' },
              { href: '/category/panneaux', label: 'Panneaux' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12,
                  letterSpacing: '0.20em',
                  textTransform: 'uppercase',
                  color: theme.textMid,
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            ))}
            <Link href="/category/plateaux" className="btn-gold" style={buttonGoldStyle({ fontSize: 12 })}>
              Commander
            </Link>
          </div>
        )}

        {/* Mobile menu button */}
        {!isDesktop && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 24,
                height: 1,
                background: theme.goldDark,
                transform: menuOpen ? 'rotate(45deg) translateY(6px)' : undefined,
                transition: 'transform 180ms ease',
              }}
            />
            <span
              style={{
                width: 24,
                height: 1,
                background: theme.goldDark,
                opacity: menuOpen ? 0 : 1,
                transition: 'opacity 180ms ease',
              }}
            />
            <span
              style={{
                width: 24,
                height: 1,
                background: theme.goldDark,
                transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : undefined,
                transition: 'transform 180ms ease',
              }}
            />
          </button>
        )}
      </div>

      {/* Mobile menu */}
      {!isDesktop && menuOpen && (
        <div
          className="mm-nav-links"
          style={{
            backgroundColor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(12px)',
            borderTop: `1px solid ${theme.creamDark}`,
            padding: '24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {[
            { href: '/', label: 'Accueil' },
            { href: '/category/plateaux', label: 'Plateaux personnalisés' },
            { href: '/category/panneaux', label: 'Panneaux décoratifs' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                color: theme.textMid,
                textDecoration: 'none',
              }}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/category/plateaux"
            className="btn-gold"
            style={buttonGoldStyle({ fullWidth: true, fontSize: 12 })}
            onClick={() => setMenuOpen(false)}
          >
            Commander
          </Link>
        </div>
      )}
    </nav>
  )
}
