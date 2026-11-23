"use client";

import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";

type Film = {
  title: string;
  subtitle: string;
  src: string;
  poster: string;
  videoLabel?: string;
  indicatorLabel?: string;
};

const films: Film[] = [
  {
    title: "Paradise Way",
    subtitle: "Just a girl training for Jannah",
    src: "/collection/IMG_7244.mov",
    poster: "/collection/paradise-way-film-poster.webp",
  },
  {
    title: "Modest Era",
    subtitle: "Modesty is the mood",
    src: "/collection/IMG_7199.mov",
    poster: "/collection/modest-era-film-poster.webp",
  },
  {
    title: "Modest Era",
    subtitle: "Modesty is the mood",
    src: "/collection/IMG_7197.mov",
    poster: "/collection/modest-era-film-poster.webp",
    videoLabel: "Film complémentaire du tote bag Modest Era",
    indicatorLabel: "Afficher le deuxième film de Modest Era",
  },
];

export default function HomeVideoCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const touchStartX = useRef<number | null>(null);

  const showSlide = (index: number) => {
    setActiveIndex((index + films.length) % films.length);
    setPaused(false);
    setPlaybackBlocked(false);
    setMediaUnavailable(false);
  };

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (index !== activeIndex) {
        video?.pause();
      }
    });

    const activeVideo = videoRefs.current[activeIndex];
    if (!activeVideo || paused) {
      return;
    }

    const playback = activeVideo.play();
    void playback.catch(() => {
      setPaused(true);
      setPlaybackBlocked(true);
    });

    return () => activeVideo.pause();
  }, [activeIndex, paused]);

  const togglePlayback = () => {
    const activeVideo = videoRefs.current[activeIndex];
    if (!activeVideo) {
      return;
    }

    if (activeVideo.paused) {
      const playback = activeVideo.play();
      void playback.catch(() => {
        setPaused(true);
        setPlaybackBlocked(true);
      });
      setPaused(false);
      setPlaybackBlocked(false);
      return;
    }

    activeVideo.pause();
    setPaused(true);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches.item(0)?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    const touch = event.changedTouches.item(0);
    touchStartX.current = null;
    if (startX === null || !touch) {
      return;
    }

    const distance = touch.clientX - startX;
    if (Math.abs(distance) > 48) {
      showSlide(activeIndex + (distance < 0 ? 1 : -1));
    }
  };

  return (
    <section
      className="storefront-showcase"
      aria-label="Films de la première collection MAISON MIROIR"
    >
      <div
        className="storefront-showcase-frame"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {films.map((film, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              className={`storefront-showcase-slide${isActive ? " is-active" : ""}`}
              key={film.src}
              aria-hidden={!isActive}
            >
              <video
                ref={(video) => {
                  videoRefs.current[index] = video;
                }}
                autoPlay={isActive && !paused}
                muted
                playsInline
                preload={isActive ? "metadata" : "none"}
                poster={film.poster}
                aria-label={film.videoLabel ?? `Film du tote bag ${film.title}`}
                onEnded={() => showSlide(activeIndex + 1)}
                onError={() => setMediaUnavailable(true)}
                onPlay={() => {
                  setPlaybackBlocked(false);
                  setPaused(false);
                }}
              >
                <source src={film.src} />
                Votre navigateur ne prend pas en charge la lecture vidéo.
              </video>
            </div>
          );
        })}
        <div className="storefront-showcase-shade" aria-hidden="true" />
        <div className="storefront-showcase-overlay">
          <div className="storefront-showcase-copy" aria-live="polite">
            <h1 className="storefront-showcase-title">MAISON MIROIR</h1>
            <p className="storefront-showcase-subtitle">
              {films[activeIndex].title} - {films[activeIndex].subtitle}
            </p>
          </div>
          <div className="storefront-showcase-controls">
            <button
              type="button"
              className="storefront-showcase-control storefront-showcase-play"
              aria-label={paused ? "Reprendre la vidéo" : "Mettre la vidéo en pause"}
              onClick={togglePlayback}
            >
              {paused ? "Lecture" : "Pause"}
            </button>
            <button
              type="button"
              className="storefront-showcase-control"
              aria-label="Film précédent"
              onClick={() => showSlide(activeIndex - 1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="storefront-showcase-control"
              aria-label="Film suivant"
              onClick={() => showSlide(activeIndex + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
      <div className="storefront-showcase-footer">
        <div className="storefront-showcase-indicators" aria-label="Choisir un film">
          {films.map((film, index) => (
            <button
              className={`storefront-showcase-indicator${index === activeIndex ? " is-active" : ""}`}
              type="button"
              key={film.src}
              aria-label={film.indicatorLabel ?? `Afficher le film ${film.title}`}
              aria-pressed={index === activeIndex}
              onClick={() => showSlide(index)}
            />
          ))}
        </div>
        {(mediaUnavailable || playbackBlocked) && (
          <p aria-live="polite">
            {mediaUnavailable
              ? "Cette vidéo est temporairement indisponible."
              : "La lecture automatique est bloquée. Lance la vidéo avec le bouton Lecture."}
          </p>
        )}
      </div>
    </section>
  );
}
