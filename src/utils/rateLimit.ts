export class RateLimiter {
  private requests: Map<string, number[]>;
  private maxRequests: number;
  private timeWindowMs: number;

  constructor(maxRequests = 5, timeWindowMs = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
  }

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.timeWindowMs,
    );

    // Check if rate limit is exceeded
    if (validTimestamps.length >= this.maxRequests) {
      return true;
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(ip, validTimestamps);

    // Cleanup old entries periodically
    if (Math.random() < 0.1) {
      // 10% chance to cleanup on each request
      this.cleanup();
    }

    return false;
  }

  private cleanup() {
    const now = Date.now();
    for (const [ip, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < this.timeWindowMs,
      );
      if (validTimestamps.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validTimestamps);
      }
    }
  }
}
