"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type GalleryMode = "home" | "card" | "detail";

type ProductImageGalleryProps = {
  productName: string;
  images: string[];
  mode: GalleryMode;
  interactive?: boolean;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  number?: string;
  triggerClassName?: string;
  priority?: boolean;
};

type Point = { x: number; y: number };
type PinchStart = { distance: number; scale: number };
type PanStart = { x: number; y: number; offsetX: number; offsetY: number };

const clampZoom = (value: number) => Math.min(4, Math.max(1, value));

export default function ProductImageGallery({
  productName,
  images,
  mode,
  interactive = true,
  selectedIndex,
  onSelectedIndexChange,
  number,
  triggerClassName = "",
  priority = false,
}: ProductImageGalleryProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchStartRef = useRef<PinchStart | null>(null);
  const panStartRef = useRef<PanStart | null>(null);
  const swipeStartRef = useRef<Point | null>(null);

  const activeIndex = Math.min(
    Math.max(selectedIndex ?? internalIndex, 0),
    images.length - 1,
  );
  const activeImage = images[activeIndex];

  const setActiveIndex = useCallback(
    (index: number) => {
      const next = (index + images.length) % images.length;
      if (onSelectedIndexChange) {
        onSelectedIndexChange(next);
      } else {
        setInternalIndex(next);
      }
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    },
    [images.length, onSelectedIndexChange],
  );

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const moveBy = useCallback(
    (amount: number) => setActiveIndex(activeIndex + amount),
    [activeIndex, setActiveIndex],
  );
  const closeLightboxRef = useRef(closeLightbox);
  const moveByRef = useRef(moveBy);

  useEffect(() => {
    closeLightboxRef.current = closeLightbox;
    moveByRef.current = moveBy;
  }, [closeLightbox, moveBy]);

  useEffect(() => {
    if (!isOpen) return;

    const pointers = pointersRef.current;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightboxRef.current();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveByRef.current(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveByRef.current(-1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => clampZoom(value + 0.5));
      } else if (event.key === "-") {
        event.preventDefault();
        setZoom((value) => clampZoom(value - 0.5));
      } else if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled)",
        );
        const first = focusable.item(0);
        const last = focusable.item(focusable.length - 1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
      pointers.clear();
      pinchStartRef.current = null;
      panStartRef.current = null;
      swipeStartRef.current = null;
    };
  }, [isOpen]);

  if (images.length === 0 || !activeImage) return null;

  const imageSizes =
    mode === "home"
      ? "(max-width: 760px) 92vw, 46vw"
      : "(max-width: 760px) 100vw, 50vw";

  const triggerClass =
    mode === "home"
      ? "home-product-image product-gallery-trigger"
      : mode === "detail"
        ? "product-gallery-detail-trigger product-gallery-trigger"
        : "product-gallery-card-trigger product-gallery-trigger";
  const staticClass =
    mode === "home"
      ? "home-product-image"
      : mode === "detail"
        ? "product-gallery-detail-trigger"
        : "product-gallery-card-trigger";

  if (!interactive) {
    if (mode === "detail") {
      return (
        <div className="product-detail-images">
          <div className={`${staticClass} product-gallery-static`}>
            <Image
              src={activeImage}
              alt={`${productName}, photo ${activeIndex + 1}`}
              fill
              sizes={imageSizes}
              priority={priority}
            />
          </div>
          {images.length > 1 && (
            <div className="product-gallery-thumbnails product-gallery-thumbnails--static">
              {images.map((image, index) => (
                <div className="product-gallery-thumbnail" key={image}>
                  <Image
                    src={image}
                    alt={`${productName}, photo ${index + 1}`}
                    fill
                    sizes="88px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`${staticClass} product-gallery-static ${triggerClassName}`.trim()}
      >
        <Image
          src={images[0]}
          alt={`${productName}, tote bag Maison Miroir`}
          fill
          sizes={imageSizes}
          priority={priority}
        />
        {number && (
          <span className="home-product-number" aria-hidden="true">
            {number}
          </span>
        )}
      </div>
    );
  }

  const openAt = (index: number) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const renderThumbnail = (image: string, index: number, lightbox = false) => (
    <button
      className={`product-gallery-thumbnail${index === activeIndex ? " is-active" : ""}`}
      type="button"
      key={`${image}-${index}`}
      aria-label={`Ouvrir la photo ${index + 1} de ${productName}`}
      aria-pressed={index === activeIndex}
      onClick={() => openAt(index)}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes={lightbox ? "76px" : "88px"}
      />
    </button>
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      const [first, second] = points;
      pinchStartRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        scale: zoom,
      };
      panStartRef.current = null;
      swipeStartRef.current = null;
    } else if (zoom > 1) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    } else if (event.pointerType === "touch") {
      swipeStartRef.current = { x: event.clientX, y: event.clientY };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2 && pinchStartRef.current) {
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pinchStartRef.current.distance > 0) {
        setZoom(
          clampZoom(
            pinchStartRef.current.scale *
              (distance / pinchStartRef.current.distance),
          ),
        );
      }
    } else if (zoom > 1 && panStartRef.current) {
      setOffset({
        x: panStartRef.current.offsetX + event.clientX - panStartRef.current.x,
        y: panStartRef.current.offsetY + event.clientY - panStartRef.current.y,
      });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.size === 1 && swipeStartRef.current) {
      const deltaX = event.clientX - swipeStartRef.current.x;
      const deltaY = event.clientY - swipeStartRef.current.y;
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
        moveBy(deltaX < 0 ? 1 : -1);
      }
    }
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      swipeStartRef.current = null;
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchStartRef.current = null;
    panStartRef.current = null;
    swipeStartRef.current = null;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((value) => clampZoom(value + (event.deltaY < 0 ? 0.25 : -0.25)));
  };

  return (
    <>
      {mode === "detail" ? (
        <div className="product-detail-images">
          <button
            className="product-gallery-detail-trigger product-gallery-trigger"
            type="button"
            aria-label={`Agrandir la photo ${activeIndex + 1} de ${productName}`}
            onClick={() => openAt(activeIndex)}
          >
            <Image
              src={activeImage}
              alt={`${productName}, photo ${activeIndex + 1}`}
              fill
              sizes={imageSizes}
              priority={priority}
            />
            <span className="product-gallery-open-label">Examiner les photos</span>
          </button>
          {images.length > 1 && (
            <div className="product-gallery-thumbnails">
              {images.map((image, index) => renderThumbnail(image, index))}
            </div>
          )}
        </div>
      ) : (
        <button
          className={`${triggerClass} ${triggerClassName}`.trim()}
          type="button"
          aria-label={`Voir les photos de ${productName}`}
          onClick={() => openAt(0)}
        >
          <Image
            src={images[0]}
            alt={`${productName}, tote bag Maison Miroir`}
            fill
            sizes={imageSizes}
            priority={priority}
          />
          {number && (
            <span className="home-product-number" aria-hidden="true">
              {number}
            </span>
          )}
          <span className="product-gallery-open-label">Voir les photos</span>
        </button>
      )}

      {isOpen && (
        <div
          className="product-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie photo de ${productName}`}
          tabIndex={-1}
          ref={dialogRef}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <button
            className="product-lightbox-close"
            type="button"
            aria-label="Fermer la galerie"
            onClick={closeLightbox}
            ref={closeButtonRef}
          >
            ×
          </button>
          {images.length > 1 && (
            <button
              className="product-lightbox-arrow product-lightbox-arrow--previous"
              type="button"
              aria-label="Photo précédente"
              onClick={() => moveBy(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
          )}
          <div
            className="product-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="product-lightbox-stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onWheel={onWheel}
              onDoubleClick={() => setZoom((value) => (value > 1 ? 1 : 2))}
            >
              <Image
                key={activeImage}
                src={activeImage}
                alt={`${productName}, photo ${activeIndex + 1} sur ${images.length}`}
                fill
                sizes="200vw"
                quality={95}
                priority
                draggable={false}
                style={{
                  objectFit: "contain",
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                }}
              />
            </div>
            <div className="product-lightbox-toolbar" aria-label="Commandes de zoom">
              <button
                type="button"
                aria-label="Réduire le zoom"
                onClick={() => setZoom((value) => clampZoom(value - 0.5))}
              >
                −
              </button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Agrandir le zoom"
                onClick={() => setZoom((value) => clampZoom(value + 0.5))}
              >
                +
              </button>
            </div>
            <p className="product-lightbox-counter" aria-live="polite">
              {activeIndex + 1} / {images.length}
            </p>
            {images.length > 1 && (
              <div className="product-lightbox-thumbnails">
                {images.map((image, index) =>
                  renderThumbnail(image, index, true),
                )}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <button
              className="product-lightbox-arrow product-lightbox-arrow--next"
              type="button"
              aria-label="Photo suivante"
              onClick={() => moveBy(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
