import { useState, useEffect } from 'react';
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
  const [columns, setColumns] = useState(8); // Default to mobile columns

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

  // Handle popup position based on scroll and viewport
  const handleMouseEnter = (profile: Profile, event: React.MouseEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    setPopupPosition(spaceAbove > spaceBelow ? 'top' : 'bottom');
    setHoveredProfile(profile);
  };

  // Filter out profiles with empty usernames or image URLs
  const validProfiles = profiles
    .filter(profile => profile.username && profile.image_url)
    .slice(0, 120); // Get up to 120 valid profiles
  
  // Calculate how many complete rows we can show
  const completeRows = Math.floor(validProfiles.length / columns);
  const profilesToShow = Math.min(
    completeRows * columns,
    Math.max(100, Math.floor(validProfiles.length / columns) * columns) // Ensure at least 100 profiles if available
  );

  // Get only the profiles that will fill complete rows
  const filteredProfiles = validProfiles.slice(0, profilesToShow);

  return (
    <div className="container mx-auto px-1">
      <div className="grid grid-cols-8 xs:grid-cols-9 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-16 gap-[2px] sm:gap-1">
        {filteredProfiles.map((profile, index) => (
          <div 
            key={index}
            className="relative cursor-pointer w-[32px] h-[32px] sm:w-[35px] sm:h-[35px] md:w-[38px] md:h-[38px] mx-auto"
            onMouseEnter={(e) => handleMouseEnter(profile, e)}
            onMouseLeave={() => setHoveredProfile(null)}
          >
            <div className="relative aspect-square w-full h-full">
              {profile.image_url ? (
                <Image
                  src={profile.image_url}
                  alt={profile.username}
                  fill
                  sizes="(max-width: 640px) 32px, (max-width: 768px) 35px, 38px"
                  className="rounded-full object-cover hover:opacity-60 transition-opacity border border-white/10 hover:border-white/30"
                  quality={75}
                  priority={index < 20}
                />
              ) : (
                <div className="w-full h-full bg-[#131827] rounded-full flex items-center justify-center border border-white/10">
                  <span className="text-gray-400 text-[8px]">No Image</span>
                </div>
              )}
            </div>

            {/* Hover Popup */}
            {hoveredProfile === profile && (
              <div 
                className="absolute z-[9999] w-72 bg-[#1B2236] bg-opacity-95 backdrop-blur-md text-white rounded-lg p-3 shadow-xl border border-white/10"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  [popupPosition === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  {profile.image_url && (
                    <div className="relative w-[48px] h-[48px] flex-shrink-0">
                      <Image
                        src={profile.image_url}
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
                      @{profile.username.replace('/', '')}
                    </a>
                    <span className="text-sm">💹🧲</span>
                  </div>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {profile.description.replace(/\\n/g, '\n').replace(/\"/g, '')}
                </p>

                {/* Arrow pointing to the profile picture */}
                <div 
                  className={`
                    absolute w-2 h-2 bg-[#1B2236] transform rotate-45 left-1/2 -translate-x-1/2
                    ${popupPosition === 'top' ? '-bottom-1 border-b border-r' : '-top-1 border-t border-l'}
                    border-white/10
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