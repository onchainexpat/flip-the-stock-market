import { downloadAndStoreProfileImages } from '../utils/ImageStorage';
import profiles from '../app/profiles.json';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Verify environment variables are loaded
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function main() {
  console.log(`Starting download of ${profiles.length} profile images...`);
  const results = await downloadAndStoreProfileImages(profiles);
  console.log('Download complete with results:', results);
  process.exit(0);
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
