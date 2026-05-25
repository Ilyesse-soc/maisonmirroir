'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getProductById, type OptionChoice } from '@/lib/products'
import PayPalButton from '@/components/PayPalButton'
import { useCart } from '@/components/CartProvider'
import { SHIPPING_METHODS, getShippingMethodById } from '@/lib/shipping'
import {
  buttonGoldStyle,
  buttonOutlineGoldStyle,
  dividerStyle,
  fonts,
  inputLuxuryStyle,
  pageMaxWidth,
  theme,
} from '@/lib/uiStyles'

export default function ProductPage() {
  const params = useParams()
  const product = getProductById(params.id as string)
  const { addItem } = useCart()

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState('')
  const [selectedShippingId, setSelectedShippingId] = useState('')
  const [artworkFile, setArtworkFile] = useState<
    | {
        filename: string
        contentType: string
        base64: string
        size: number
      }
    | null
  >(null)
  const [address, setAddress] = useState({ firstName: '', lastName: '', email: '', phone: '', street: '', city: '', zip: '', country: 'France' })
  const [step, setStep] = useState<'customize' | 'address' | 'payment'>('customize')
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedImageIndex(0)
    setCustomValues({})
    setSelectedOptions({})
    setQuantity('')
    setSelectedShippingId('')
    setArtworkFile(null)
    setStep('customize')
    setError('')
  }, [params.id])

  if (!product)
    return (
      <div style={{ paddingTop: 128, textAlign: 'center', paddingBottom: 80, fontFamily: fonts.body }}>
        <p>Produit introuvable.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 16,
            color: theme.goldDark,
            textDecoration: 'underline',
          }}
        >
          Retour à l'accueil
        </Link>
      </div>
    )

  const handleCustomChange = (field: string, value: string) => {
    setCustomValues(prev => ({ ...prev, [field]: value }))
  }

  const handleAddressChange = (field: string, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }))
  }

  const clampQuantity = (value: number) => {
    if (!Number.isFinite(value)) return 1
    return Math.max(1, Math.trunc(value))
  }

  const parseQuantity = (raw: string): number | null => {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const value = Number(trimmed)
    if (!Number.isFinite(value)) return null
    return clampQuantity(value)
  }

  const normalizeChoices = (values: OptionChoice[]) =>
    values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))

  const getSelectedChoice = (key: string) => {
    const rawValues = product.options?.[key]
    const selected = selectedOptions[key]
    if (!rawValues || !selected) return null
    const choices = normalizeChoices(rawValues)
    return choices.find((c) => c.value === selected) ?? null
  }

  const computeUnitPrice = () => {
    let price = product.price
    const entries = Object.entries(product.options ?? {})
    for (const [key] of entries) {
      if (key === 'artworkFile') continue
      const choice = getSelectedChoice(key)
      if (!choice) continue
      if (typeof choice.priceOverride === 'number' && Number.isFinite(choice.priceOverride)) {
        price = choice.priceOverride
      } else if (typeof choice.priceDelta === 'number' && Number.isFinite(choice.priceDelta)) {
        price += choice.priceDelta
      }
    }
    if (!Number.isFinite(price) || price <= 0) price = product.price
    return price
  }

  const unitPrice = computeUnitPrice()
  const qty = parseQuantity(quantity)
  const selectedShipping = getShippingMethodById(selectedShippingId)
  const subtotal = qty ? unitPrice * qty : 0
  const shippingPrice = selectedShipping?.price ?? 0
  const total = qty ? subtotal + shippingPrice : 0
  const subtotalDisplayAmount = qty ? subtotal.toFixed(2) : '—'
  const displayAmount = qty ? total.toFixed(2) : '—'

  const optionLabels: Record<string, string> = {
    boxColor: 'Couleur des boîtes',
    roseColor: 'Couleur des roses',
    decoration: 'Décoration',
    handles: 'Poignets',
    ringBoxes: 'Boîtes alliances',
    size: 'Taille',
    textColor: 'Couleur du texte',
    ringHolder: 'Support bague',
    style: 'Style souhaité',
    model: 'Modèle',
    artworkFile: 'Logo / design',
  }

  const optionEntries = Object.entries(product.options ?? {}).filter(([, values]) => Array.isArray(values) && values.length > 0)
  const optionsComplete = optionEntries.every(([key]) => {
    if (key === 'artworkFile') return Boolean(artworkFile)
    return Boolean(selectedOptions[key])
  })

  const formattedOptions: Record<string, string> = optionEntries.reduce((acc, [key]) => {
    if (key === 'artworkFile') {
      if (artworkFile) acc[optionLabels[key] || key] = artworkFile.filename
      return acc
    }
    const choice = getSelectedChoice(key)
    if (choice) acc[optionLabels[key] || key] = choice.label
    return acc
  }, {} as Record<string, string>)

  const mergedCustomValues: Record<string, string> = {
    ...formattedOptions,
    ...customValues,
  }

  const handleAddToCart = () => {
    const q = parseQuantity(quantity)
    if (optionEntries.length > 0 && !optionsComplete) {
      setError('Veuillez sélectionner toutes les options de personnalisation.')
      return
    }
    if (!q) {
      setError('Veuillez indiquer une quantité valide (minimum 1).')
      return
    }

    const variantLabel = Object.values(formattedOptions).filter(Boolean).join(' • ')
    const currentImage = product.images[Math.min(Math.max(selectedImageIndex, 0), product.images.length - 1)]

    addItem({
      productId: product.id,
      name: product.name,
      category: product.category,
      categoryLabel: product.categoryLabel,
      image: currentImage,
      variantLabel: variantLabel || undefined,
      unitPrice,
      quantity: q,
      customValues: mergedCustomValues,
      attachments: artworkFile
        ? [
            {
              filename: artworkFile.filename,
              contentType: artworkFile.contentType,
              base64: artworkFile.base64,
            },
          ]
        : [],
    })
    setError('')
  }

  const validateStep = () => {
    if (step === 'customize') {
      if (optionEntries.length > 0 && !optionsComplete) {
        setError('Veuillez sélectionner toutes les options de personnalisation.')
        return
      }
      const q = parseQuantity(quantity)
      if (!q) {
        setError('Veuillez indiquer une quantité valide (minimum 1).')
        return
      }
      setError('')
      setStep('address')
      return
    }
    if (step === 'address') {
      if (!address.firstName || !address.lastName || !address.email || !address.phone || !address.street || !address.city || !address.zip) {
        setError('Veuillez remplir tous les champs obligatoires.')
        return
      }
      if (!selectedShipping) {
        setError('Veuillez choisir un mode de livraison pour continuer.')
        return
      }
      setError('')
      setStep('payment')
    }
  }

  const steps = ['customize', 'address', 'payment']
  const stepIndex = steps.indexOf(step)

  const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '').trim()
  const paypalConfigured = paypalClientId.length > 0

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: theme.marble }}>
      <div style={{ maxWidth: pageMaxWidth, margin: '0 auto', padding: '64px 24px' }}>
        {/* Breadcrumb */}
        <nav
          style={{
            fontSize: 12,
            fontFamily: fonts.body,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            marginBottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            color: theme.textMid,
          }}
        >
          <Link href="/" style={{ color: theme.textMid, textDecoration: 'none' }}>
            Accueil
          </Link>
          <span style={{ color: theme.gold }}>◈</span>
          <Link href={`/category/${product.category}`} style={{ color: theme.textMid, textDecoration: 'none' }}>
            {product.categoryLabel}
          </Link>
          <span style={{ color: theme.gold }}>◈</span>
          <span style={{ color: theme.textDark }}>{product.name}</span>
        </nav>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 56,
          }}
        >
          {/* LEFT: Image gallery */}
          <div>
            <div
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                background: 'white',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              <Image
                src={product.images[Math.min(Math.max(selectedImageIndex, 0), product.images.length - 1)]}
                alt={product.name}
                fill
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
            {product.images.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 12,
                  overflowX: 'auto',
                  paddingBottom: 4,
                }}
              >
                {product.images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      background: 'white',
                      overflow: 'hidden',
                      width: 88,
                      flex: '0 0 auto',
                      cursor: 'pointer',
                      border: `1px solid ${i === selectedImageIndex ? theme.gold : theme.creamDark}`,
                    }}
                    role="button"
                    aria-label={`Voir l'image ${i + 1}`}
                  >
                    <Image src={img} alt={`${product.name} ${i + 1}`} fill style={{ objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Features */}
            <div style={{ marginTop: 32, padding: 24, background: 'white', border: `1px solid ${theme.creamDark}` }}>
              <h4
                style={{
                  fontFamily: fonts.display,
                  fontSize: 14,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  marginBottom: 16,
                  color: theme.gold,
                }}
              >
                Caractéristiques
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>
                {product.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      fontSize: 12,
                      fontFamily: fonts.body,
                      letterSpacing: '0.04em',
                      color: theme.textMid,
                    }}
                  >
                    <span style={{ color: theme.gold }}>◇</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT: Form */}
          <div>
            <p
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginBottom: 8,
                color: theme.gold,
              }}
            >
              {product.categoryLabel}
            </p>
            <h1
              style={{
                fontFamily: fonts.display,
                fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                fontWeight: 300,
                marginBottom: 12,
                color: theme.textDark,
              }}
            >
              {product.name}
            </h1>
            {typeof product.originalPrice === 'number' && product.originalPrice > unitPrice ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                <span
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 14,
                    color: theme.textMid,
                    textDecoration: 'line-through',
                    letterSpacing: '0.06em',
                  }}
                >
                  {product.originalPrice.toFixed(2)} €
                </span>
                <span style={{ fontFamily: fonts.display, fontSize: 30, color: theme.gold }}>
                  {unitPrice.toFixed(2)} €
                </span>
                <span
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: theme.gold,
                    border: `1px solid ${theme.gold}`,
                    padding: '6px 10px',
                  }}
                >
                  -{Math.round((1 - unitPrice / product.originalPrice) * 100)}%
                </span>
              </div>
            ) : (
              <p style={{ fontFamily: fonts.display, fontSize: 26, marginBottom: 12, color: theme.gold }}>
                {unitPrice.toFixed(2)} €
              </p>
            )}

            <p style={{ fontFamily: fonts.body, fontSize: 12, letterSpacing: '0.06em', color: theme.textMid, marginBottom: 20 }}>
              Sous-total produits ({qty ?? '—'} × {unitPrice.toFixed(2)} €) : <strong style={{ color: theme.textDark }}>{qty ? `${subtotalDisplayAmount} €` : '—'}</strong>
            </p>
            <div style={{ ...dividerStyle(120), margin: '0 0 24px' }} />
            <p style={{ fontSize: 14, lineHeight: 1.9, fontFamily: fonts.body, letterSpacing: '0.04em', marginBottom: 32, color: theme.textMid }}>
              {product.description}
            </p>

            {/* Step progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
              {['Personnalisation', 'Livraison', 'Paiement'].map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      className="mm-step-circle"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontFamily: fonts.body,
                        background: i <= stepIndex ? theme.gold : 'transparent',
                        border: `1px solid ${i <= stepIndex ? theme.gold : '#d4b896'}`,
                        color: i <= stepIndex ? 'white' : theme.textMid,
                      }}
                    >
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span
                      style={{
                        marginTop: 4,
                        fontFamily: fonts.body,
                        letterSpacing: '0.04em',
                        color: i <= stepIndex ? theme.gold : theme.textMid,
                        fontSize: 11,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        margin: '0 4px',
                        background: i < stepIndex ? theme.gold : theme.goldLight,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* STEP 1: Customize */}
            {step === 'customize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: theme.textDark }}>
                  Personnalisez votre création
                </h3>

                {optionEntries.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {optionEntries.map(([key, values]) => (
                      <div key={key}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            letterSpacing: '0.20em',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                            fontFamily: fonts.body,
                            color: theme.textMid,
                          }}
                        >
                          {optionLabels[key] || key} *
                        </label>
                        {key === 'artworkFile' ? (
                          <div>
                            <input
                              className="mm-input"
                              style={inputLuxuryStyle}
                              type="file"
                              accept=".pdf,.png"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) {
                                  setArtworkFile(null)
                                  return
                                }
                                const allowed = ['application/pdf', 'image/png']
                                if (!allowed.includes(file.type)) {
                                  setError('Format non supporté. Formats acceptés : PDF ou PNG.')
                                  setArtworkFile(null)
                                  return
                                }
                                const maxSize = 2 * 1024 * 1024
                                if (file.size > maxSize) {
                                  setError('Fichier trop volumineux (max 2 Mo).')
                                  setArtworkFile(null)
                                  return
                                }
                                const buf = await file.arrayBuffer()
                                const bytes = new Uint8Array(buf)
                                let binary = ''
                                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
                                const base64 = btoa(binary)
                                setArtworkFile({
                                  filename: file.name,
                                  contentType: file.type,
                                  base64,
                                  size: file.size,
                                })
                                setError('')
                              }}
                            />
                            {artworkFile && (
                              <p style={{ marginTop: 8, fontSize: 12, fontFamily: fonts.body, color: theme.textMid, lineHeight: 1.6 }}>
                                Fichier sélectionné : <strong>{artworkFile.filename}</strong>
                              </p>
                            )}
                          </div>
                        ) : (
                          <select
                            className="mm-input"
                            style={inputLuxuryStyle}
                            value={selectedOptions[key] || ''}
                            onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [key]: e.target.value }))}
                          >
                            <option value="" disabled>
                              Choisir...
                            </option>
                            {normalizeChoices(values as OptionChoice[]).map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        letterSpacing: '0.20em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                        fontFamily: fonts.body,
                        color: theme.textMid,
                      }}
                    >
                      Quantité *
                    </label>
                    <input
                      className="mm-input"
                      type="number"
                      min={1}
                      step={1}
                      style={inputLuxuryStyle}
                      value={quantity}
                      placeholder=""
                      onChange={(e) => {
                        const raw = e.target.value
                        if (!raw) {
                          setQuantity('')
                          setError('')
                          return
                        }
                        const digitsOnly = raw.replace(/[^0-9]/g, '')
                        setQuantity(digitsOnly)
                        setError('')
                      }}
                      onBlur={() => {
                        const q = parseQuantity(quantity)
                        if (q) setQuantity(String(q))
                      }}
                    />
                    <p style={{ marginTop: 8, fontSize: 12, fontFamily: fonts.body, color: theme.textMid, lineHeight: 1.6 }}>
                      Prix unitaire : <strong>{unitPrice.toFixed(2)} €</strong> — Total : <strong>{qty ? `${displayAmount} €` : '—'}</strong>
                    </p>
                  </div>
                </div>

                {product.customFields.map((field) => (
                  <div key={field}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        letterSpacing: '0.20em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                        fontFamily: fonts.body,
                        color: theme.textMid,
                      }}
                    >
                      {field}
                    </label>
                    <input
                      type="text"
                      className="mm-input"
                      style={inputLuxuryStyle}
                      placeholder={`Votre ${field.toLowerCase()}...`}
                      value={customValues[field] || ''}
                      onChange={(e) => handleCustomChange(field, e.target.value)}
                    />
                  </div>
                ))}

                {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body }}>{error}</p>}
                <button className="btn-gold" onClick={validateStep} style={{ ...buttonGoldStyle({ fullWidth: true }), marginTop: 16 }}>
                  Continuer →
                </button>
                <button
                  onClick={handleAddToCart}
                  style={{
                    ...buttonOutlineGoldStyle({ fullWidth: true }),
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  Ajouter au panier
                </button>
              </div>
            )}

            {/* STEP 2: Address */}
            {step === 'address' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: theme.textDark }}>
                  Informations de livraison
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Prénom *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.firstName} onChange={e => handleAddressChange('firstName', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Nom *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.lastName} onChange={e => handleAddressChange('lastName', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Email *
                  </label>
                  <input className="mm-input" type="email" style={inputLuxuryStyle} value={address.email} onChange={e => handleAddressChange('email', e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Telephone *
                  </label>
                  <input className="mm-input" type="tel" style={inputLuxuryStyle} value={address.phone} onChange={e => handleAddressChange('phone', e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Adresse *
                  </label>
                  <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.street} onChange={e => handleAddressChange('street', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Ville *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.city} onChange={e => handleAddressChange('city', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                      Code postal *
                    </label>
                    <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.zip} onChange={e => handleAddressChange('zip', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8, fontFamily: fonts.body, color: theme.textMid }}>
                    Pays
                  </label>
                  <input className="mm-input" type="text" style={inputLuxuryStyle} value={address.country} onChange={e => handleAddressChange('country', e.target.value)} />
                </div>

                <div
                  style={{
                    marginTop: 8,
                    background: 'white',
                    border: `1px solid ${theme.creamDark}`,
                    padding: 16,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      marginBottom: 12,
                      fontFamily: fonts.display,
                      color: theme.textDark,
                      fontSize: 22,
                      fontWeight: 300,
                    }}
                  >
                    Choisissez votre mode de livraison
                  </p>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {SHIPPING_METHODS.map((method) => {
                      const checked = selectedShippingId === method.id
                      return (
                        <label
                          key={method.id}
                          style={{
                            border: `1px solid ${checked ? theme.gold : theme.creamDark}`,
                            background: checked ? '#fffaf0' : 'white',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                          }}
                        >
                          <input
                            type="radio"
                            name="shipping-method"
                            checked={checked}
                            onChange={() => {
                              setSelectedShippingId(method.id)
                              setError('')
                            }}
                            style={{ marginTop: 3 }}
                          />
                          <div style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontFamily: fonts.body, fontSize: 13, color: theme.textDark, letterSpacing: '0.04em' }}>
                              {method.shortLabel} - {method.price.toFixed(2)} €
                            </span>
                            <span style={{ fontFamily: fonts.body, fontSize: 11, color: theme.textMid, letterSpacing: '0.04em' }}>
                              Delai estime: {method.estimatedDelay}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body }}>{error}</p>}
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setStep('customize')} style={{ ...buttonOutlineGoldStyle({ fullWidth: true }), flex: 1, minWidth: 220 }}>
                    ← Retour
                  </button>
                  <button className="btn-gold" onClick={validateStep} style={{ ...buttonGoldStyle({ fullWidth: true }), flex: 1, minWidth: 220 }}>
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Payment */}
            {step === 'payment' && (
              <div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: '22px',
                    fontWeight: 300,
                    color: 'var(--text)',
                    marginBottom: '24px',
                  }}
                >
                  Récapitulatif & Paiement
                </h3>

                {/* ── ORDER CARD ── */}
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #f0e6cc',
                    marginBottom: '20px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #1a1408, #2c200f)',
                      padding: '16px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '13px',
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        color: '#e8d08a',
                      }}
                    >
                      Votre commande
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      Maison Miroir
                    </span>
                  </div>

                  {/* Product line */}
                  <div
                    style={{
                      padding: '18px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'Cormorant Garamond',serif",
                          fontSize: '16px',
                          fontWeight: 400,
                          color: 'var(--text)',
                          marginBottom: '4px',
                        }}
                      >
                        {product.name}
                      </p>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: 'var(--gold)',
                        }}
                      >
                        {product.categoryLabel}
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '18px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                          {subtotalDisplayAmount} €
                    </span>
                  </div>

                      <div
                        style={{
                          padding: '10px 22px',
                          borderBottom: '1px solid #faf4e8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Jost',sans-serif",
                            fontSize: '11px',
                            color: '#a08060',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Quantité
                        </span>
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: '14px',
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}
                        >
                          {qty ?? '—'}
                        </span>
                      </div>

                  {/* Personalization details */}
                  {Object.entries(customValues)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          padding: '10px 22px',
                          borderBottom: '1px solid #faf4e8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Jost',sans-serif",
                            fontSize: '11px',
                            color: '#a08060',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: '14px',
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}

                  {Object.entries(formattedOptions)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          padding: '10px 22px',
                          borderBottom: '1px solid #faf4e8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Jost',sans-serif",
                            fontSize: '11px',
                            color: '#a08060',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: '14px',
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}

                  {/* Delivery */}
                  <div
                    style={{
                      padding: '12px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '11px',
                        color: '#a08060',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Livraison
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '12px',
                        color: selectedShipping ? 'var(--text)' : '#b94e4e',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {selectedShipping ? `${selectedShipping.shortLabel} - ${selectedShipping.price.toFixed(2)} €` : 'Mode non selectionne'}
                    </span>
                  </div>

                  {/* Shipping delay */}
                  <div
                    style={{
                      padding: '12px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '11px',
                        color: '#a08060',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Delai de livraison estime
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '12px',
                        color: 'var(--mid)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {selectedShipping?.estimatedDelay || 'A choisir'}
                    </span>
                  </div>

                  {/* Subtotal */}
                  <div
                    style={{
                      padding: '12px 22px',
                      borderBottom: '1px solid #f5edd8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '11px',
                        color: '#a08060',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Sous-total produits
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '12px',
                        color: 'var(--text)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {subtotalDisplayAmount} €
                    </span>
                  </div>

                  {/* Total */}
                  <div
                    style={{
                      padding: '18px 22px',
                      background: 'linear-gradient(135deg, #fdf8ee, #faf2e0)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          letterSpacing: '0.3em',
                          textTransform: 'uppercase',
                          color: 'var(--mid)',
                          marginBottom: '2px',
                        }}
                      >
                        Total TTC
                      </p>
                      <p
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          color: '#b0966a',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Taxes incluses
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: '32px',
                        fontWeight: 400,
                        color: 'var(--gold)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {displayAmount} €
                    </span>
                  </div>
                </div>

                {/* ── SECURE BADGE ── */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 0',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: "'Jost',sans-serif",
                      fontSize: '11px',
                      color: 'var(--mid)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>🔒</span>
                    <span>Paiement 100% sécurisé</span>
                  </div>
                  {/* Payment icons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    {['Visa', 'Mastercard', 'PayPal', 'Amex'].map((brand) => (
                      <div
                        key={brand}
                        style={{
                          background: 'white',
                          border: '1px solid #e8d8b0',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          fontWeight: 500,
                          color: 'var(--mid)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {brand}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PAYPAL BUTTON ── */}
                <div
                  style={{
                    border: '1px solid #f0e6cc',
                    padding: '20px',
                    background: 'white',
                    marginBottom: '14px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond',serif",
                      fontSize: '15px',
                      fontWeight: 300,
                      color: 'var(--mid)',
                      textAlign: 'center',
                      marginBottom: '16px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Choisissez votre mode de paiement
                  </p>

                  {!paypalConfigured ? (
                    <p style={{ fontFamily: fonts.body, fontSize: 12, color: theme.textMid, lineHeight: 1.7, margin: 0, textAlign: 'center' }}>
                      Configuration requise : définis NEXT_PUBLIC_PAYPAL_CLIENT_ID dans .env.local.
                    </p>
                  ) : (
                    <PayPalButton
                      amount={total}
                      order={{
                        product: {
                          id: product.id,
                          name: product.name,
                          category: product.category,
                          categoryLabel: product.categoryLabel,
                          unitPrice,
                          quantity: qty ?? 1,
                        },
                        customValues: mergedCustomValues,
                        attachments: artworkFile
                          ? [
                              {
                                filename: artworkFile.filename,
                                contentType: artworkFile.contentType,
                                base64: artworkFile.base64,
                              },
                            ]
                          : [],
                        customer: address,
                        shipping: {
                          id: selectedShipping?.id || '',
                          label: selectedShipping?.label || '',
                          shortLabel: selectedShipping?.shortLabel || '',
                          carrier: selectedShipping?.carrier || '',
                          price: selectedShipping?.price || 0,
                          estimatedDelay: selectedShipping?.estimatedDelay || '',
                        },
                      }}
                    />
                  )}
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: 12, fontFamily: fonts.body, marginTop: 10, textAlign: 'center' }}>
                    {error}
                  </p>
                )}

                {/* ── BACK BUTTON ── */}
                <button className="btn-outline-gold" style={{ width: '100%', marginTop: '8px' }} onClick={() => setStep('address')}>
                  ← Modifier la commande
                </button>

                {/* ── REASSURANCE ── */}
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #fdf8ee, #faf2e0)',
                    border: '1px solid #f0e6cc',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {[
                    { icon: '✦', text: 'Pièce unique fabriquée à la main' },
                    { icon: '◈', text: 'Emballage cadeau luxe inclus' },
                    { icon: '◇', text: 'Gravure laser haute précision' },
                    { icon: '↩', text: 'Service client disponible 7j/7' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: 'var(--gold)', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
                      <span
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '10px',
                          color: 'var(--mid)',
                          lineHeight: '1.6',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
