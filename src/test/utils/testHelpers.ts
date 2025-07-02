import type { Page } from 'puppeteer';

export const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  email: process.env.PRIVY_TEST_EMAIL || 'test@example.com',
  otpCode: process.env.PRIVY_TEST_CODE || '123456',
} as const;

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a page and wait for it to load
   */
  async navigateAndWait(path = ''): Promise<void> {
    const url = `${TEST_CONFIG.baseUrl}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle2' });
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(
    selector: string,
    timeout = TEST_CONFIG.timeout,
  ): Promise<void> {
    await this.page.waitForSelector(selector, { visible: true, timeout });
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const element = await this.page.$(selector);
    return element !== null;
  }

  /**
   * Get element text content
   */
  async getElementText(selector: string): Promise<string | null> {
    const element = await this.page.$(selector);
    if (!element) return null;
    return await element.evaluate((el) => el.textContent);
  }

  /**
   * Fill form field
   */
  async fillField(selector: string, value: string): Promise<void> {
    await this.page.waitForSelector(selector);
    await this.page.fill(selector, value);
  }

  /**
   * Click element and wait for navigation if expected
   */
  async clickAndWait(
    selector: string,
    waitForNavigation = false,
  ): Promise<void> {
    if (waitForNavigation) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        this.page.click(selector),
      ]);
    } else {
      await this.page.click(selector);
    }
  }

  /**
   * Wait for Privy to be ready
   */
  async waitForPrivyReady(): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        () => {
          const privy = (window as any).privy;
          return privy && privy.ready;
        },
        { timeout: TEST_CONFIG.timeout },
      );
      return true;
    } catch (error) {
      console.error('Privy not ready within timeout:', error);
      return false;
    }
  }

  /**
   * Wait for user to be authenticated
   */
  async waitForAuthentication(): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        () => {
          const privy = (window as any).privy;
          return privy && privy.authenticated;
        },
        { timeout: TEST_CONFIG.timeout },
      );
      return true;
    } catch (error) {
      console.error('Authentication not completed within timeout:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const privy = (window as any).privy;
      return privy && privy.authenticated;
    });
  }

  /**
   * Get current wallet address
   */
  async getWalletAddress(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const privy = (window as any).privy;
      return privy?.user?.wallet?.address || null;
    });
  }

  /**
   * Take screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `./screenshots/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /**
   * Wait for a specific timeout
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Check if element is disabled
   */
  async isElementDisabled(selector: string): Promise<boolean> {
    const element = await this.page.$(selector);
    if (!element) return true;
    return await element.evaluate((el) => el.hasAttribute('disabled'));
  }

  /**
   * Simulate email login flow (mock)
   */
  async simulateEmailLogin(
    email: string = TEST_CONFIG.email,
  ): Promise<boolean> {
    try {
      // Navigate to login page
      await this.navigateAndWait('/login');

      // Wait for email input
      await this.waitForElement('input[type="email"]');

      // Enter email
      await this.fillField('input[type="email"]', email);

      // Click continue
      await this.clickAndWait('button:has-text("Continue with Email")');

      // In a real test, we would handle OTP verification here
      // For now, just wait and check if we proceed to next step
      await this.wait(2000);

      return true;
    } catch (error) {
      console.error('Email login simulation failed:', error);
      return false;
    }
  }

  /**
   * Mock successful authentication
   */
  async mockAuthentication(): Promise<void> {
    await this.page.evaluate(() => {
      // Mock Privy authentication state
      (window as any).privy = {
        ready: true,
        authenticated: true,
        user: {
          id: 'test-user-id',
          email: { address: 'test@example.com' },
          wallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
        },
      };
    });
  }
}

/**
 * Create a new test helper instance
 */
export function createTestHelpers(page: Page): TestHelpers {
  return new TestHelpers(page);
}

/**
 * Setup common page configurations for tests
 */
export async function setupTestPage(page: Page): Promise<void> {
  // Set viewport
  await page.setViewport({ width: 1280, height: 720 });

  // Enable console logging
  page.on('console', (msg) => {
    if (process.env.DEBUG_TESTS) {
      console.log('PAGE:', msg.text());
    }
  });

  // Handle page errors
  page.on('pageerror', (error) => {
    console.error('PAGE ERROR:', error.message);
  });

  // Handle request failures
  page.on('requestfailed', (request) => {
    if (process.env.DEBUG_TESTS) {
      console.log('REQUEST FAILED:', request.url());
    }
  });
}

/**
 * Environment-specific configuration
 */
export const isCI = !!process.env.CI;
export const isHeadless = process.env.HEADLESS !== 'false';
export const isDebug = !!process.env.DEBUG_TESTS;
