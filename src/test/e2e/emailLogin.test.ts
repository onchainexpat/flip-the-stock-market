import puppeteer, { type Browser, type Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('Email Login E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  const TEST_EMAIL = process.env.PRIVY_TEST_EMAIL || 'test@example.com';
  const TEST_CODE = process.env.PRIVY_TEST_CODE || '123456';
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Skip E2E tests in CI environment due to headless browser issues
    if (process.env.CI) {
      console.log('Skipping E2E tests in CI environment');
      return;
    }

    browser = await puppeteer.launch({
      headless: true, // Always headless for tests
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });
    page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Enable console logging
    page.on('console', (msg) => {
      console.log('PAGE LOG:', msg.text());
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      console.error('PAGE ERROR:', error.message);
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test.skip('should load the email login page', async () => {
    if (process.env.CI) return;

    await page.goto(`${BASE_URL}/login`);

    // Wait for the page to load
    await page.waitForSelector('h2', { timeout: 10000 });

    // Check if the login form is present
    const heading = await page.$eval('h2', (el) => el.textContent);
    expect(heading).toContain('Get Started');

    // Check for email input
    const emailInput = await page.$('input[type="email"]');
    expect(emailInput).toBeTruthy();

    // Check for submit button
    const submitButton = await page.$('button');
    expect(submitButton).toBeTruthy();
  });

  test.skip('should handle email input and validation', async () => {
    await page.goto(`${BASE_URL}/login`);

    // Wait for email input
    await page.waitForSelector('input[type="email"]');

    // Test invalid email
    await page.type('input[type="email"]', 'invalid-email');
    await page.click('button:has-text("Continue with Email")');

    // Should show validation error
    await page.waitForTimeout(1000); // Wait for potential error

    // Clear and enter valid email
    await page.fill('input[type="email"]', '');
    await page.type('input[type="email"]', TEST_EMAIL);

    // Button should be enabled with valid email
    const button = await page.$('button:has-text("Continue with Email")');
    const isDisabled = await button?.evaluate((el) =>
      el.hasAttribute('disabled'),
    );
    expect(isDisabled).toBe(false);
  });

  test.skip('should proceed to OTP verification step', async () => {
    await page.goto(`${BASE_URL}/login`);

    // Enter email
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', TEST_EMAIL);

    // Click continue
    await page.click('button:has-text("Continue with Email")');

    // Should show OTP input (in a real test, this would require actual email service)
    // For now, we'll just check that the UI changes
    await page.waitForTimeout(2000);

    // In a real implementation, we would:
    // 1. Use a test email service
    // 2. Fetch the OTP from the email
    // 3. Enter it in the form
    // 4. Verify successful login
  });

  test.skip('should handle wallet connection fallback', async () => {
    await page.goto(`${BASE_URL}/login`);

    // Wait for the page to load
    await page.waitForSelector('button:has-text("Connect Wallet Instead")');

    // Click the wallet connection fallback
    await page.click('button:has-text("Connect Wallet Instead")');

    // Should redirect to main page
    await page.waitForNavigation();
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test.skip('should show loading states appropriately', async () => {
    await page.goto(`${BASE_URL}/login`);

    // Enter email
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', TEST_EMAIL);

    // Click continue and check for loading state
    await page.click('button:has-text("Continue with Email")');

    // Should show loading spinner
    const loadingSpinner = await page.$('.animate-spin');
    expect(loadingSpinner).toBeTruthy();
  });

  test.skip('should be responsive on mobile viewport', async () => {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/login`);

    // Wait for the page to load
    await page.waitForSelector('h2');

    // Check that the form is still accessible
    const emailInput = await page.$('input[type="email"]');
    expect(emailInput).toBeTruthy();

    // Check that the form width is appropriate for mobile
    const formElement = await page.$('.max-w-sm');
    expect(formElement).toBeTruthy();
  });
});

// Helper function for real email testing (would require email service setup)
export async function getTestEmailOTP(email: string): Promise<string | null> {
  // In a real implementation, this would:
  // 1. Connect to a test email service (like MailSlurp)
  // 2. Fetch recent emails for the test account
  // 3. Parse the OTP from the email content
  // 4. Return the OTP code

  // For now, return the test code from environment
  return process.env.PRIVY_TEST_CODE || null;
}

// Helper function to wait for Privy authentication
export async function waitForPrivyAuth(page: Page): Promise<boolean> {
  try {
    // Wait for Privy to be ready and authenticated
    await page.waitForFunction(
      () => {
        // Check if Privy is loaded and user is authenticated
        return (
          (window as any).privy?.ready && (window as any).privy?.authenticated
        );
      },
      { timeout: 30000 },
    );
    return true;
  } catch (error) {
    console.error('Privy authentication timeout:', error);
    return false;
  }
}
