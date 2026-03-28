import './globals.css'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { fonts, theme } from '@/lib/uiStyles'

export const metadata: Metadata = {
  title: 'Maison Miroir — Décoration de Mariage Luxe',
  description: 'Plateaux personnalisés et panneaux décoratifs pour votre mariage. Création sur mesure, gravure laser, finitions dorées.',
  keywords: 'mariage, décoration, plateau miroir, panneau acrylique, personnalisé, or, luxe',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      style={{
        scrollBehavior: 'smooth',
        ['--gold' as any]: theme.gold,
        ['--gold-light' as any]: theme.goldLight,
        ['--gold-dark' as any]: theme.goldDark,
        ['--cream' as any]: theme.cream,
        ['--cream-dark' as any]: theme.creamDark,
        ['--marble' as any]: theme.marble,
        ['--text-dark' as any]: theme.textDark,
        ['--text-mid' as any]: theme.textMid,
        ['--text' as any]: theme.textDark,
        ['--mid' as any]: theme.textMid,
      }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Great+Vibes&family=Jost:wght@300;400;500&display=swap"
        />
      </head>
      <body
        style={{
          margin: 0,
          backgroundColor: theme.marble,
          color: theme.textDark,
          fontFamily: fonts.body,
          fontWeight: 300,
          letterSpacing: '0.02em',
        }}
      >
        <Navbar />
        <main style={{ minHeight: '100vh' }}>{children}</main>
        <Footer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
  document.addEventListener('DOMContentLoaded', function() {
    // Scroll reveal
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.mm-reveal').forEach(function(el) {
      observer.observe(el);
    });

    // Navbar scroll
    const nav = document.getElementById('mm-navbar');
    if (nav) {
      window.addEventListener('scroll', function() {
        nav.classList.toggle('scrolled', window.scrollY > 50);
      });
    }
  });
`,
          }}
        />
      </body>
    </html>
  )
}
