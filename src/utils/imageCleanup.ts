import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';

export class ImageCleanup {
  private directory: string;
  private maxAgeMs: number;
  private isRunning: boolean;

  constructor(directory: string, maxAgeMs: number = 3600000) { // Default 1 hour
    this.directory = directory;
    this.maxAgeMs = maxAgeMs;
    this.isRunning = false;
  }

  async cleanup(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const files = await readdir(this.directory);
      const now = Date.now();

      for (const file of files) {
        // Skip .gitkeep
        if (file === '.gitkeep') continue;

        const filePath = join(this.directory, file);
        try {
          const stats = await stat(filePath);
          const fileAge = now - stats.mtimeMs;

          if (fileAge > this.maxAgeMs) {
            await unlink(filePath);
            console.log(`Deleted old image: ${file}`);
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      this.isRunning = false;
    }
  }

  startPeriodicCleanup(intervalMs: number = 900000) { // Default 15 minutes
    setInterval(() => {
      this.cleanup().catch(console.error);
    }, intervalMs);
  }
} 