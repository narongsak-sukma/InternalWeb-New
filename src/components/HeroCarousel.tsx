import React, { useState, useEffect } from 'react';
import { BannerSlide } from '../types';
import { ChevronLeft, ChevronRight, ArrowRight, PhoneCall, Sparkles, Building } from 'lucide-react';

interface HeroCarouselProps {
  slides: BannerSlide[];
  onActionClick: (url: string) => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides, onActionClick }) => {
  const activeSlides = slides.filter((s) => s.isActive);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-play timer
  useEffect(() => {
    if (isPaused || activeSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused, activeSlides.length]);

  // Keep the index valid when the active slide list shrinks (CMS edits,
  // backend hydration) — otherwise activeSlides[currentIndex] is undefined.
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, activeSlides.length]);

  if (activeSlides.length === 0) return null;

  const current = activeSlides[Math.min(currentIndex, activeSlides.length - 1)];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  return (
    <div
      id="hero-carousel-container"
      className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#FFF8F0] via-[#FFFDF9] to-[#FFF3E8] text-stone-900 border border-orange-200/90 shadow-sm group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image with Warm Soft Wash Overlay */}
      <div className="relative h-64 sm:h-76 md:h-84 lg:h-92 w-full overflow-hidden bg-gradient-to-r from-[#FFF8F0] via-[#FFFDF9] to-[#FFF3E8]">
        {current.imageUrl ? (
          <img
            src={current.imageUrl}
            alt={current.title}
            className="absolute right-0 top-0 h-full w-full sm:w-3/5 object-cover object-center transition-all duration-700 ease-out transform scale-102 group-hover:scale-100"
          />
        ) : null}
        {/* Soft Warm Gradient Mask so Left Typography is 100% Crisp & High Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF8F0] via-[#FFF8F0]/95 via-45% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FFF8F0]/80 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Floating Corporate Identity Ribbon */}
      <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
        <div className="px-3.5 py-1 rounded-full bg-[#F97316] text-white text-[11px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-white" />
          <span>{current.badge}</span>
        </div>
        <span className="text-xs text-stone-600 font-semibold hidden sm:inline-block">
          KB J Capital Portal • Kashjoy
        </span>
      </div>

      {/* Content Body */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-8 md:p-10 max-w-xl">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tight leading-tight mb-2">
          {current.title}
        </h2>
        <p className="text-sm sm:text-base text-stone-600 font-normal leading-relaxed mb-6 line-clamp-2">
          {current.subtitle}
        </p>

        <div className="flex items-center gap-3">
          <button
            id="hero-carousel-cta"
            onClick={() => onActionClick(current.actionUrl)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-orange-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <span>{current.actionText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="text-xs text-stone-400 font-mono font-semibold">
            {currentIndex + 1} / {activeSlides.length}
          </span>
        </div>
      </div>

      {/* Slide Navigation Arrows */}
      <button
        onClick={handlePrev}
        aria-label="Previous Slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-stone-700 hover:text-[#F97316] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-orange-200/80 cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={handleNext}
        aria-label="Next Slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-stone-700 hover:text-[#F97316] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-orange-200/80 cursor-pointer"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5">
        {activeSlides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentIndex
                ? 'w-7 bg-[#F97316] shadow-xs'
                : 'w-2 bg-orange-200 hover:bg-orange-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
