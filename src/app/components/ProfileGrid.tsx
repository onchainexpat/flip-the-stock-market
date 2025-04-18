import { useState, useEffect, useRef } from 'react';
import profiles from '../profiles.json';
import Image from 'next/image';

interface Profile {
  platform: string;
  profile_url: string;
  image_url: string;
  username: string;
  description: string;
}

export default function ProfileGrid() {
  const [hoveredProfile, setHoveredProfile] = useState<Profile | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('top');
  const [popupAlignment, setPopupAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [columns, setColumns] = useState(8); // Default to mobile columns
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [loadedProfiles, setLoadedProfiles] = useState<Profile[]>([]);
  const hasLoadedRef = useRef(false);

  // Check if device is mobile and handle resize
  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      
      // Update columns based on breakpoints
      if (width >= 1280) setColumns(16);      // xl
      else if (width >= 1024) setColumns(14); // lg
      else if (width >= 768) setColumns(12);  // md
      else if (width >= 640) setColumns(10);  // sm
      else if (width >= 480) setColumns(9);   // xs
      else setColumns(8);                     // default
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const loadStoredImages = async () => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;

      const profilesToTry = profiles.slice(0, 120);
      const usernames = profilesToTry.map(p => p.username).filter(Boolean);

      try {
        // Fetch all images in one request
        const response = await fetch('/api/profile-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames })
        });

        if (!response.ok) return;

        const data = await response.json();
        const cache: Record<string, string> = {};
        const availableProfiles: Profile[] = [];

        // Process results
        for (const profile of profilesToTry) {
          if (profile.username && data[profile.username]) {
            const imageData = data[profile.username];
            cache[profile.username] = `data:${imageData.contentType};base64,${imageData.data}`;
            availableProfiles.push(profile);
          }
        }

        setImageCache(cache);
        setLoadedProfiles(availableProfiles);
      } catch (error) {
        console.error('Failed to load images:', error);
      }
    };

    loadStoredImages();
  }, []);

  // Handle popup position based on scroll, viewport, and grid position
  const handleMouseEnter = (profile: Profile, event: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    // Set vertical position based on available space
    setPopupPosition(spaceAbove > spaceBelow ? 'top' : 'bottom');

    // Calculate column position (0-based index)
    const columnIndex = index % columns;
    
    // For mobile view, adjust horizontal alignment based on column position
    if (isMobile) {
      // If in the first third of columns, align right
      if (columnIndex < columns / 3) {
        setPopupAlignment('right');
      }
      // If in the last third of columns, align left
      else if (columnIndex >= (2 * columns) / 3) {
        setPopupAlignment('left');
      }
      // If in the middle third of columns, center align
      else {
        setPopupAlignment('center');
      }
    } else {
      // For desktop, keep center alignment
      setPopupAlignment('center');
    }
    
    setHoveredProfile(profile);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredProfile(null);
    }, 2000); // 2000ms (2 seconds) delay before hiding
  };

  // Calculate how many complete rows we can show
  const completeRows = Math.floor(loadedProfiles.length / columns);
  const profilesToShow = Math.min(
    completeRows * columns,
    Math.max(100, Math.floor(loadedProfiles.length / columns) * columns) // Ensure at least 100 profiles if available
  );

  // Use loadedProfiles directly since it's already limited
  const filteredProfiles = loadedProfiles;

  // Helper function to get popup transform and position styles
  const getPopupStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 9999,
      [popupPosition === 'top' ? 'bottom' : 'top']: '100%',
    };

    switch (popupAlignment) {
      case 'left':
        return {
          ...baseStyles,
          right: '0',
          transform: 'none',
        };
      case 'right':
        return {
          ...baseStyles,
          left: '0',
          transform: 'none',
        };
      default: // center
        return {
          ...baseStyles,
          left: '50%',
          transform: 'translateX(-50%)',
        };
    }
  };

  return (
    <div className="container mx-auto px-1">
      <div className="grid grid-cols-8 xs:grid-cols-9 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-16 gap-[2px] sm:gap-1">
        {filteredProfiles.map((profile, index) => (
          <div 
            key={index}
            className="relative cursor-pointer w-[32px] h-[32px] sm:w-[35px] sm:h-[35px] md:w-[38px] md:h-[38px] mx-auto"
            onMouseEnter={(e) => handleMouseEnter(profile, e, index)}
            onMouseLeave={handleMouseLeave}
          >
            <div className="relative aspect-square w-full h-full">
              {imageCache[profile.username] && (
                <Image
                  src={imageCache[profile.username]}
                  alt={profile.username}
                  fill
                  sizes="(max-width: 640px) 32px, (max-width: 768px) 35px, 38px"
                  className="rounded-full object-cover hover:opacity-60 transition-opacity border border-white/10 hover:border-white/30"
                  quality={75}
                />
              )}
            </div>

            {/* Hover Popup */}
            {hoveredProfile === profile && (
              <div 
                className="w-72 bg-[#1B2236] bg-opacity-95 backdrop-blur-md text-white rounded-lg p-3 shadow-xl border border-white/10"
                style={getPopupStyles()}
                onMouseEnter={() => {
                  if (hideTimeoutRef.current) {
                    clearTimeout(hideTimeoutRef.current);
                  }
                }}
                onMouseLeave={handleMouseLeave}
              >
                <div className="flex items-center gap-3 mb-3">
                  {imageCache[profile.username] && (
                    <div className="relative w-[48px] h-[48px] flex-shrink-0">
                      <Image
                        src={imageCache[profile.username]}
                        alt={profile.username}
                        fill
                        sizes="48px"
                        className="rounded-full object-cover"
                        quality={75}
                        priority={true}
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <a 
                      href={profile.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-bold text-blue-400 hover:text-blue-300 hover:underline truncate block"
                    >
                      @{profile.username.replace('/', '')} 💹🧲
                    </a>
                  </div>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {profile.description.replace(/\\n/g, '\n').replace(/\"/g, '')}
                </p>

                {/* Arrow pointing to the profile picture - adjusted position */}
                <div 
                  className={`
                    absolute w-2 h-2 bg-[#1B2236] transform rotate-45
                    ${popupPosition === 'top' ? 'bottom-0 translate-y-1/2 border-b border-r' : 'top-0 -translate-y-1/2 border-t border-l'}
                    border-white/10
                    ${popupAlignment === 'left' ? 'right-4' : 
                      popupAlignment === 'right' ? 'left-4' : 
                      'left-1/2 -translate-x-1/2'}
                  `}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 