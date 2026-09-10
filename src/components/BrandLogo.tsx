import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'dark',
  showSubtitle = true,
}) => {
  const isLight = variant === 'light';

  // Sizing variants
  const starSize = size === 'sm' ? 24 : size === 'lg' ? 36 : 30;
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* KB Iconic 5-pointed Yellow Star Emblem */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={starSize}
          height={starSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm transition-transform duration-300 hover:rotate-12"
        >
          {/* KB Star Shape */}
          <path
            d="M24 4L28.5 17.5H43L31.5 26L35.5 40L24 31.5L12.5 40L16.5 26L5 17.5H19.5L24 4Z"
            fill="#FFBC00"
          />
          <path
            d="M24 4L28.5 17.5L24 23L19.5 17.5L24 4Z"
            fill="#FFA000"
            opacity="0.4"
          />
          <path
            d="M43 17.5L31.5 26L24 23L28.5 17.5H43Z"
            fill="#FF8F00"
            opacity="0.3"
          />
          <path
            d="M35.5 40L24 31.5L24 23L31.5 26L35.5 40Z"
            fill="#FFA000"
            opacity="0.35"
          />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col leading-none">
        <div className="flex items-center tracking-tight font-bold">
          <span className={`${textSize} ${isLight ? 'text-white' : 'text-slate-900'} font-black mr-1.5`}>
            KB
          </span>
          <span className={`${textSize} text-amber-500 font-extrabold mr-1.5`}>
            J
          </span>
          <span className={`${textSize} ${isLight ? 'text-slate-200' : 'text-slate-700'} font-medium tracking-tight`}>
            Capital
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`text-[10px] tracking-wider uppercase font-semibold ${
              isLight ? 'text-amber-300/80' : 'text-amber-600'
            }`}
          >
            A Member of KB Financial Group & Jaymart
          </span>
        )}
      </div>
    </div>
  );
};
