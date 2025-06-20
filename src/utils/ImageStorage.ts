import { Redis } from '@upstash/redis';
import * as cheerio from 'cheerio';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false,
});

interface ProfileImage {
  data: string; // base64 encoded image data
  contentType: string;
  lastUpdated: number;
}

// Helper function to extract image URL using Cheerio selectors
function findImageUrlOnPage(html: string, profileUrl: string): string | null {
  try {
    const $ = cheerio.load(html);

    // --- Strategy 1: Check meta tags (Keep as first attempt) ---
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && imageUrl.includes('profile_images')) {
      console.log(
        `[Debug] Found profile image URL via og:image on ${profileUrl}: ${imageUrl}`,
      );
      return imageUrl;
    }
    imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl && imageUrl.includes('profile_images')) {
      console.log(
        `[Debug] Found profile image URL via twitter:image on ${profileUrl}: ${imageUrl}`,
      );
      return imageUrl;
    }
    console.log(
      `[Debug] Meta tags did not yield profile image on ${profileUrl}.`,
    );

    // --- Strategy 2: Find first <img> tag with profile image source ---
    let imgTagUrl: string | undefined;
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      // Check if src exists and contains the profile image path pattern
      if (src && src.includes('pbs.twimg.com/profile_images/')) {
        console.log(
          `[Debug] Found image via <img> src attribute on ${profileUrl}: ${src}`,
        );
        imgTagUrl = src;
        return false; // Stop iterating once the first match is found
      }
    });

    if (imgTagUrl) {
      return imgTagUrl; // Return the found src
    } else {
      console.log(
        `[Debug] Could not find any <img> tag with src containing 'pbs.twimg.com/profile_images/' on ${profileUrl}.`,
      );
    }
    // --- End Strategy 2 ---

    // If no strategies worked
    console.warn(
      `[Debug] Failed to extract profile image URL from HTML of ${profileUrl}`,
    );
    // Optional: Log head snippet still, might be useful sometimes
    // const headContent = $('head').html();
    // console.log(`[Debug] Head content snippet for ${profileUrl}: ${headContent ? headContent.substring(0, 500) : 'Not found'}`);
    return null;
  } catch (parseError) {
    console.error(
      `[Debug] Cheerio failed to parse HTML for ${profileUrl}:`,
      parseError,
    );
    return null;
  }
}

// --- REVISED getCurrentTwitterImageUrl using Puppeteer ---
async function getCurrentTwitterImageUrl(
  profileUrl: string,
): Promise<string | null> {
  // Validate URL (lowercase check from before)
  const lowerCaseUrl = profileUrl ? profileUrl.toLowerCase() : '';
  if (
    !profileUrl ||
    (!lowerCaseUrl.includes('twitter.com/') && !lowerCaseUrl.includes('x.com/'))
  ) {
    console.log(
      `[Puppeteer Debug] Invalid or non-Twitter/X URL passed: ${profileUrl}`,
    );
    return null;
  }

  let browser: Browser | null = null; // Keep browser instance outside try block for finally
  console.log(`[Puppeteer Debug] Launching browser for ${profileUrl}...`);
  try {
    // Launch the browser
    browser = await puppeteer.launch({
      headless: true, // Run in background
      args: [
        // Arguments to help avoid detection
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"', // Realistic user agent
      ],
    });
    const page: Page = await browser.newPage();

    // Set viewport and user agent (optional but good practice)
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    );

    // Navigate to the main profile URL (often more reliable than /photo)
    console.log(`[Puppeteer Debug] Navigating to: ${profileUrl}`);
    await page.goto(profileUrl, {
      waitUntil: 'networkidle2', // Wait for network activity to settle
      timeout: 30000, // 30 second timeout for navigation
    });
    console.log(`[Puppeteer Debug] Navigation complete for: ${profileUrl}`);

    // --- Strategy: Find the profile image element ---
    // Selector needs verification - this targets an img potentially within the main profile header link
    // You might need to inspect the page again WITH JavaScript enabled to find the best selector.
    // Common patterns might involve `data-testid` attributes or aria-labels.
    const imageSelector = 'a[href$="/photo"] img[src*="profile_images"]'; // Example: img inside the link to the /photo page
    // Alternative selector if the above doesn't work: 'img[alt*="Profile photo"]' - inspect element needed!

    console.log(`[Puppeteer Debug] Waiting for selector: ${imageSelector}`);
    try {
      await page.waitForSelector(imageSelector, { timeout: 10000 }); // Wait up to 10s for the image

      // Extract the src attribute using page.$eval
      const imageUrl = await page.$eval(
        imageSelector,
        (img) => (img as HTMLImageElement).src,
      );

      if (imageUrl && imageUrl.includes('profile_images')) {
        console.log(
          `[Puppeteer Success] Found image URL via selector ${imageSelector}: ${imageUrl}`,
        );
        return imageUrl; // Found it!
      } else {
        console.warn(
          `[Puppeteer Debug] Selector '${imageSelector}' found, but src is invalid: ${imageUrl}`,
        );
        return null;
      }
    } catch (selectorError) {
      console.warn(
        `[Puppeteer Debug] Could not find selector '${imageSelector}' on ${profileUrl}. Trying alternative methods or failing.`,
      );
      // You could try other selectors here if the first one fails
      // const pageContent = await page.content(); // Get full HTML after JS run
      // console.log(`[Puppeteer Debug] Page content length after JS: ${pageContent.length}`);
      // Maybe try extracting from script tags if needed? More complex.
      return null; // Failed to find the image via selectors
    }
  } catch (error) {
    console.error(`[Puppeteer Error] Error processing ${profileUrl}:`, error);
    return null; // Return null on any puppeteer error
  } finally {
    // Ensure the browser is closed even if errors occur
    if (browser) {
      console.log(`[Puppeteer Debug] Closing browser for ${profileUrl}.`);
      await browser.close();
    }
  }
}

export async function downloadAndStoreProfileImages(profiles: any[]) {
  console.log('Starting profile image download...');
  const results = {
    success: 0,
    failed: 0,
    skipped: 0, // Skipped due to missing essential data ONLY
    fetch_failed: 0, // Failed specifically because live fetch failed for an X profile
    updated: 0, // Count how many existing entries were successfully updated
  };

  const FORCE_UPDATE = true; // <-- Keep true for testing

  for (const profile of profiles) {
    console.log(`\n--- Processing profile: ${profile.username} ---`);
    console.log(
      `  Platform: ${profile.platform}, Profile URL: ${profile.profile_url}, Image URL (JSON): ${profile.image_url}`,
    );

    if (!profile.username) {
      console.warn('Skipping profile due to missing username.');
      results.skipped++;
      continue;
    }

    const key = `profile_image:${profile.username}`;

    try {
      // --- MODIFIED CACHE CHECK ---
      let existingData = null; // Define it here for update counter later
      if (FORCE_UPDATE) {
        console.log(
          `  FORCE_UPDATE is true. Will attempt to fetch and update ${profile.username} even if it exists in cache.`,
        );
        // Fetch existing data only if FORCE_UPDATE is true AND you want the 'updated' counter
        existingData = await redis.get(key);
      } else {
        // ... cache check logic ...
        const checkExisting = await redis.get(key); // Rename var to avoid conflict
        if (checkExisting) {
          console.log(
            `  Skipping ${profile.username}, image already exists in cache (FORCE_UPDATE is false).`,
          );
          results.skipped++;
          continue;
        }
      }
      // --- END MODIFIED CACHE CHECK ---

      let baseImageUrl: string | null = null;
      const isXPlatform = profile.platform === 'X';
      const hasProfileUrl = !!profile.profile_url;

      console.log(
        `  Is X Platform: ${isXPlatform}, Has Profile URL: ${hasProfileUrl}`,
      );

      // --- Decision Logic for Image URL Source ---
      if (isXPlatform && hasProfileUrl) {
        console.log(
          `  Platform is X with profile URL. Attempting live fetch via getCurrentTwitterImageUrl...`,
        );
        baseImageUrl = await getCurrentTwitterImageUrl(profile.profile_url); // Calls the updated function
        console.log(`  Result from getCurrentTwitterImageUrl: ${baseImageUrl}`);

        if (!baseImageUrl) {
          console.warn(
            `  Live fetch failed for X user ${profile.username}. Skipping image download for this profile.`,
          );
          results.fetch_failed++;
          continue;
        }
      } else {
        // ... (fallback logic for non-X users remains the same) ...
        if (profile.image_url) {
          console.log(
            `  Not an X profile OR missing profile_url. Using image_url from JSON: ${profile.image_url}`,
          );
          baseImageUrl = profile.image_url;
        } else {
          console.warn(
            `  Cannot determine image URL for ${profile.username} (Not X/No profile_url, and no image_url in JSON). Skipping.`,
          );
          results.skipped++;
          continue;
        }
      }
      // --- End URL Determination ---

      // --- Apply _400x400 Logic ---
      let imageUrlToFetch = baseImageUrl; // Can still be null here
      let finalUrlIs400x400 = false; // Flag to know if we are attempting the 400x400 version

      // Check if imageUrlToFetch is non-null before proceeding
      if (
        imageUrlToFetch &&
        imageUrlToFetch.includes('pbs.twimg.com/profile_images/')
      ) {
        // Replace suffixes like _mini, _normal, _bigger with _400x400
        const potentialNewUrl = imageUrlToFetch.replace(
          /_(mini|normal|bigger|\\d+x\\d+)\\.(jpg|jpeg|png|gif)$/i,
          '_400x400.$2',
        );

        if (potentialNewUrl !== imageUrlToFetch) {
          imageUrlToFetch = potentialNewUrl;
          finalUrlIs400x400 = true; // Mark that we changed it
          console.log(
            `Attempting 400x400 version for ${profile.username}: ${imageUrlToFetch}`,
          );
        } else {
          // Log if no suffix was found or the pattern didn't match
          console.log(
            `No known size suffix found on ${profile.username}\'s image URL or pattern mismatch. Using as is: ${imageUrlToFetch}`,
          );
        }
      } else if (imageUrlToFetch) {
        // Added check for the else case too
        // Log if it's not a standard Twitter profile image URL
        console.log(
          `URL for ${profile.username} may not be a standard Twitter image URL or needs no resizing. Using as is: ${imageUrlToFetch}`,
        );
      } else {
        // Handle the case where imageUrlToFetch is still null after URL determination
        console.warn(
          `  Could not determine a valid imageUrlToFetch for ${profile.username}. Skipping download.`,
        );
        results.skipped++; // Or results.failed depending on desired behavior
        continue; // Skip to the next profile
      }
      // --- End _400x400 Logic ---

      // --- Download image ---
      // Now imageUrlToFetch is guaranteed to be a string if we reach here
      console.log(`[Download] Fetching final image: ${imageUrlToFetch}`);
      let response;
      try {
        response = await fetch(imageUrlToFetch, {
          // OK to use imageUrlToFetch here
          headers: {
            // Use consistent headers
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            Referer:
              profile.profile_url ||
              (isXPlatform ? 'https://x.com/' : undefined),
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000), // Timeout
        });
      } catch (error) {
        console.warn(
          `[Download] Failed fetch for ${profile.username} from ${imageUrlToFetch}. Error: ${error}`,
        );
        results.failed++;
        continue;
      }

      // --- REMOVED the specific fallback logic that tried original resolution first ---
      // Now we just check if the fetch (for the 400x400 or original) failed

      if (!response.ok) {
        // Optional: If the 400x400 attempt failed, could try the baseImageUrl as last resort
        if (
          response.status === 404 &&
          finalUrlIs400x400 &&
          baseImageUrl !== imageUrlToFetch
        ) {
          console.warn(
            `[Download] 400x400 failed for ${profile.username} (404). Trying base URL as last resort: ${baseImageUrl}`,
          );
          imageUrlToFetch = baseImageUrl; // Revert to the URL *before* 400x400 was applied
          try {
            // Check if the reverted imageUrlToFetch (baseImageUrl) is actually valid before fetching
            if (imageUrlToFetch) {
              response = await fetch(imageUrlToFetch, {
                // Fetch again
                headers: {
                  /* ... */
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(15000),
              });
              // If this *still* fails, the main check below will catch it
            } else {
              // If baseImageUrl was null, we can't retry
              console.warn(
                `[Download] Cannot retry fetch for ${profile.username} because baseImageUrl was null.`,
              );
            }
          } catch (error) {
            // Determine the URL attempted for the error message
            const urlAttempted =
              imageUrlToFetch ?? baseImageUrl ?? 'unknown URL';
            console.warn(
              `[Download] Last resort fetch failed for ${profile.username} from ${urlAttempted}. Error: ${error}`,
            );
            // Allow the outer check to handle the failure
          }
        }

        // Check final response status after potential fallback
        if (!response.ok) {
          const urlAttempted = imageUrlToFetch ?? baseImageUrl ?? 'unknown URL';
          console.warn(
            `[Download] Final HTTP error for ${profile.username} from ${urlAttempted}: ${response.status}, skipping...`,
          );
          results.failed++;
          continue;
        }
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      console.log(
        `[Download] Success for ${profile.username} (${contentType})`,
      );

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) {
        console.warn(
          `[Download] Received empty image buffer for ${profile.username} from ${imageUrlToFetch}, skipping...`,
        );
        results.failed++;
        continue;
      }
      const base64 = Buffer.from(buffer).toString('base64');

      const imageData: ProfileImage = {
        data: base64,
        contentType: contentType,
        lastUpdated: Date.now(),
      };
      await redis.set(key, JSON.stringify(imageData));

      // Decide if it was an update or a new entry
      if (FORCE_UPDATE && existingData) {
        // Check the variable defined in the cache check block
        results.updated++;
        console.log(`[Store] Updated image for ${profile.username} in Redis.`);
      } else {
        results.success++;
        console.log(
          `[Store] Stored new image for ${profile.username} in Redis.`,
        );
      }

      // Delay
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(
        `[Overall Error] Failed processing profile ${profile.username}:`,
        error,
      );
      results.failed++;
    }
  } // End for loop

  console.log('Profile image download complete:', results);
  return results;
}

export async function getStoredProfileImage(
  username: string,
): Promise<ProfileImage | null> {
  try {
    const response = await fetch(
      `/api/profile-image?username=${encodeURIComponent(username)}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get stored profile image:', error);
    return null;
  }
}
