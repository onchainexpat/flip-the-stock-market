import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false
})

interface ProfileImage {
  data: string;  // base64 encoded image data
  contentType: string;
  lastUpdated: number;
}

export async function downloadAndStoreProfileImages(profiles: any[]) {
  console.log('Starting profile image download...');
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  };

  for (const profile of profiles) {
    if (!profile.image_url || !profile.username) {
      results.skipped++;
      continue;
    }

    const key = `profile_image:${profile.username}`;

    try {
      // Check if image already exists in storage
      const existing = await redis.get(key);
      if (existing) {
        results.skipped++;
        continue;
      }

      // Download image with retry logic
      let response;
      try {
        response = await fetch(profile.image_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
      } catch (error) {
        console.warn(`Failed to fetch image for ${profile.username}, skipping...`);
        results.failed++;
        continue;
      }

      if (!response.ok) {
        console.warn(`HTTP error for ${profile.username}: ${response.status}, skipping...`);
        results.failed++;
        continue;
      }
      
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      // Store image data
      const imageData: ProfileImage = {
        data: base64,
        contentType: response.headers.get('content-type') || 'image/jpeg',
        lastUpdated: Date.now()
      };

      await redis.set(key, JSON.stringify(imageData));
      results.success++;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to process ${profile.username}:`, error);
      results.failed++;
    }
  }

  console.log('Profile image download complete:', results);
  return results;
}

export async function getStoredProfileImage(username: string): Promise<ProfileImage | null> {
  try {
    const response = await fetch(`/api/profile-image?username=${encodeURIComponent(username)}`)
    if (!response.ok) return null
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to get stored profile image:', error)
    return null
  }
}
