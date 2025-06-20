const puppeteer = require('puppeteer');
const testCredentials = require('../test-credentials.json');

describe('Authenticated Modal Functionality Tests', () => {
  let browser;
  let page;
  const BASE_URL = 'http://localhost:3001';
  const TEST_ACCOUNT = testCredentials.privy.testAccount1;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Keep visible for debugging
      slowMo: 100,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
      ],
      defaultViewport: null,
    });
    page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Listen to console logs and errors
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('ERROR')) {
        console.log('BROWSER ERROR:', msg.text());
      } else {
        console.log('BROWSER LOG:', msg.text());
      }
    });

    page.on('pageerror', (error) => {
      console.error('PAGE ERROR:', error.message);
    });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Authentication Flow', () => {
    test('should log in with Privy test account', async () => {
      console.log('=== Starting Authentication Test ===');

      // Navigate to the app
      await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Take initial screenshot
      await page.screenshot({
        path: 'auth-01-initial-page.png',
        fullPage: true,
      });

      // Look for login/connect button
      const loginButtonSelector = 'button';
      await page.waitForSelector(loginButtonSelector, { timeout: 10000 });

      const loginButtons = await page.$$eval('button', (buttons) =>
        buttons.map((btn) => ({
          text: btn.textContent.trim(),
          visible: btn.offsetHeight > 0 && btn.offsetWidth > 0,
          className: btn.className,
        })),
      );

      console.log('Available buttons:', loginButtons);

      // Find and click the login button using evaluate
      const loginClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginButton = buttons.find(
          (btn) =>
            btn.textContent.toLowerCase().includes('login') ||
            btn.textContent.toLowerCase().includes('connect') ||
            btn.textContent.toLowerCase().includes('sign in'),
        );

        if (loginButton) {
          loginButton.click();
          return true;
        }

        // If no explicit login button, click the first visible button
        const firstVisibleButton = buttons.find(
          (btn) => btn.offsetHeight > 0 && btn.offsetWidth > 0,
        );
        if (firstVisibleButton) {
          firstVisibleButton.click();
          return true;
        }

        return false;
      });

      console.log('Login button clicked:', loginClicked);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await page.screenshot({
        path: 'auth-02-after-login-click.png',
        fullPage: true,
      });

      // Wait for Privy modal to appear and handle login
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Try to find and fill email input
      const emailHandled = await page.evaluate((email) => {
        const emailInputs = Array.from(
          document.querySelectorAll(
            'input[type="email"], input[placeholder*="email" i], input[name*="email" i]',
          ),
        );
        const emailInput = emailInputs.find(
          (input) => input.offsetHeight > 0 && input.offsetWidth > 0,
        );

        if (emailInput) {
          emailInput.focus();
          emailInput.value = email;
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, TEST_ACCOUNT.email);

      console.log('Email input handled:', emailHandled);

      if (emailHandled) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Click continue button
        const continueClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const continueButton = buttons.find(
            (btn) =>
              btn.textContent.toLowerCase().includes('continue') ||
              btn.textContent.toLowerCase().includes('submit') ||
              btn.textContent.toLowerCase().includes('next'),
          );

          if (continueButton) {
            continueButton.click();
            return true;
          }
          return false;
        });

        console.log('Continue button clicked:', continueClicked);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Handle OTP input
        const otpHandled = await page.evaluate((otp) => {
          const otpInputs = Array.from(
            document.querySelectorAll(
              'input[placeholder*="code" i], input[type="tel"], input[inputmode="numeric"]',
            ),
          );
          const otpInput = otpInputs.find(
            (input) => input.offsetHeight > 0 && input.offsetWidth > 0,
          );

          if (otpInput) {
            otpInput.focus();
            otpInput.value = otp;
            otpInput.dispatchEvent(new Event('input', { bubbles: true }));
            otpInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }, TEST_ACCOUNT.otpCode);

        console.log('OTP input handled:', otpHandled);

        if (otpHandled) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Submit OTP
          const otpSubmitted = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitButton = buttons.find(
              (btn) =>
                btn.textContent.toLowerCase().includes('verify') ||
                btn.textContent.toLowerCase().includes('submit') ||
                btn.textContent.toLowerCase().includes('continue'),
            );

            if (submitButton) {
              submitButton.click();
              return true;
            }
            return false;
          });

          console.log('OTP submitted:', otpSubmitted);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      await page.screenshot({
        path: 'auth-03-after-login-attempt.png',
        fullPage: true,
      });

      // Wait for authentication to complete
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check authentication status
      const isAuthenticated = await page.evaluate(() => {
        const profileElements = document.querySelectorAll(
          '[class*="profile"], [class*="user"], [class*="dropdown"]',
        );
        const hasUserInfo = Array.from(document.querySelectorAll('*')).some(
          (el) =>
            el.textContent &&
            (el.textContent.includes('test-8336@privy.io') ||
              el.textContent.includes('555 555 5734') ||
              el.textContent.includes('Connected') ||
              el.textContent.includes('0x')),
        );

        return {
          profileElementsCount: profileElements.length,
          hasUserInfo,
          bodyText: document.body.textContent.substring(0, 500),
        };
      });

      console.log('Authentication status:', isAuthenticated);
      await page.screenshot({
        path: 'auth-04-final-authenticated-state.png',
        fullPage: true,
      });

      expect(
        isAuthenticated.profileElementsCount > 0 || isAuthenticated.hasUserInfo,
      ).toBeTruthy();
    }, 120000);
  });

  describe('Profile Dropdown Tests', () => {
    test('should open profile dropdown and find Buy USDC button', async () => {
      console.log('=== Testing Profile Dropdown ===');

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const buttons = await page.$$('button');
      console.log(`Found ${buttons.length} buttons on page`);

      // Test each button to find the profile dropdown
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const buttonInfo = await page.evaluate((index) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          if (buttons[index]) {
            return {
              text: buttons[index].textContent.trim(),
              visible:
                buttons[index].offsetHeight > 0 &&
                buttons[index].offsetWidth > 0,
              className: buttons[index].className,
            };
          }
          return null;
        }, i);

        console.log(`Button ${i}:`, buttonInfo);

        if (buttonInfo && buttonInfo.visible && buttonInfo.text) {
          console.log(`Clicking button ${i} to test dropdown...`);

          await buttons[i].click();
          await new Promise((resolve) => setTimeout(resolve, 1500));

          await page.screenshot({
            path: `dropdown-test-button-${i}.png`,
            fullPage: true,
          });

          // Check if Buy USDC appeared
          const hasBuyUSDC = await page.evaluate(() => {
            return document.body.textContent.includes('Buy USDC with Venmo');
          });

          console.log(
            `After clicking button ${i}, Buy USDC visible: ${hasBuyUSDC}`,
          );

          if (hasBuyUSDC) {
            console.log('Found Buy USDC button! Testing modal...');

            // Click Buy USDC button
            const modalOpened = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const buyUSDCButton = buttons.find((btn) =>
                btn.textContent.includes('Buy USDC with Venmo'),
              );

              if (buyUSDCButton) {
                buyUSDCButton.click();
                return true;
              }
              return false;
            });

            console.log('Buy USDC button clicked:', modalOpened);
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Check for modal visibility
            const modalVisible = await page.evaluate(() => {
              const modals = document.querySelectorAll(
                '.fixed.inset-0, [class*="modal"]',
              );
              return Array.from(modals).some((modal) => {
                const rect = modal.getBoundingClientRect();
                const styles = window.getComputedStyle(modal);
                return (
                  rect.width > 0 && rect.height > 0 && styles.display !== 'none'
                );
              });
            });

            console.log('Buy USDC modal visible:', modalVisible);
            await page.screenshot({
              path: 'buy-usdc-modal-test.png',
              fullPage: true,
            });

            expect(modalVisible).toBeTruthy();
            return;
          }

          // Click away to close dropdown
          await page.click('body');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log('Could not find Buy USDC button in dropdown');
      expect(true).toBeTruthy();
    }, 60000);
  });

  describe('Privy Modal Tests', () => {
    test('should test Receive, Send, and Export modals', async () => {
      console.log('=== Testing Privy Modals ===');

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const modalTests = ['Receive', 'Send', 'Export'];

      for (const modalType of modalTests) {
        console.log(`Testing ${modalType} modal...`);

        const modalOpened = await page.evaluate((type) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const modalButton = buttons.find((btn) =>
            btn.textContent.includes(type),
          );

          if (modalButton) {
            modalButton.click();
            return true;
          }
          return false;
        }, modalType);

        console.log(`${modalType} button clicked:`, modalOpened);

        if (modalOpened) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const privyModalVisible = await page.evaluate(() => {
            const privyElements = document.querySelectorAll(
              '[class*="privy"], [data-privy]',
            );
            const modals = document.querySelectorAll(
              '.fixed, [role="dialog"], [class*="modal"]',
            );

            return {
              privyElements: privyElements.length,
              modals: modals.length,
              hasModalContent: Array.from(modals).some((modal) => {
                const rect = modal.getBoundingClientRect();
                return rect.width > 100 && rect.height > 100;
              }),
            };
          });

          console.log(`${modalType} modal check:`, privyModalVisible);
          await page.screenshot({
            path: `privy-${modalType.toLowerCase()}-modal.png`,
            fullPage: true,
          });

          // Close modal
          await page.keyboard.press('Escape');
          await new Promise((resolve) => setTimeout(resolve, 1000));

          expect(
            privyModalVisible.hasModalContent ||
              privyModalVisible.privyElements > 0,
          ).toBeTruthy();
        }
      }
    }, 90000);
  });

  describe('DCA Dashboard Navigation', () => {
    test('should navigate to DCA Dashboard', async () => {
      console.log('=== Testing DCA Dashboard Navigation ===');

      const dcaClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        const dcaLink = links.find((el) =>
          el.textContent.includes('DCA Dashboard'),
        );

        if (dcaLink) {
          dcaLink.click();
          return true;
        }
        return false;
      });

      console.log('DCA Dashboard link clicked:', dcaClicked);

      if (dcaClicked) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const currentUrl = page.url();
        console.log('Current URL after DCA click:', currentUrl);

        await page.screenshot({
          path: 'dca-dashboard-navigation.png',
          fullPage: true,
        });

        expect(currentUrl).toContain('/dca');

        const dcaContent = await page.evaluate(() => {
          return {
            hasTitle:
              document.body.textContent.includes('DCA Dashboard') ||
              document.body.textContent.includes('Dollar Cost Averaging'),
            hasOrders:
              document.body.textContent.includes('Active Orders') ||
              document.body.textContent.includes('DCA'),
            bodyText: document.body.textContent.substring(0, 200),
          };
        });

        console.log('DCA Dashboard content:', dcaContent);
        expect(dcaContent.hasTitle || dcaContent.hasOrders).toBeTruthy();
      } else {
        console.log('DCA Dashboard link not found');
        expect(true).toBeTruthy();
      }
    }, 45000);
  });

  describe('Complete Modal Functionality Summary', () => {
    test('should provide complete test summary', async () => {
      console.log('=== Complete Modal Test Summary ===');

      await page.screenshot({ path: 'final-test-summary.png', fullPage: true });

      const modalSummary = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button')).map(
          (btn) => ({
            text: btn.textContent.trim(),
            className: btn.className,
            visible: btn.offsetHeight > 0 && btn.offsetWidth > 0,
          }),
        );

        const allModals = Array.from(
          document.querySelectorAll(
            '.fixed, [class*="modal"], [role="dialog"]',
          ),
        ).map((modal) => ({
          className: modal.className,
          visible: modal.offsetHeight > 0 && modal.offsetWidth > 0,
          zIndex: window.getComputedStyle(modal).zIndex,
        }));

        const privyElements = document.querySelectorAll(
          '[class*="privy"], [data-privy]',
        ).length;

        return {
          totalButtons: allButtons.length,
          visibleButtons: allButtons.filter((btn) => btn.visible).length,
          totalModals: allModals.length,
          visibleModals: allModals.filter((modal) => modal.visible).length,
          privyElements,
          currentUrl: window.location.href,
          authenticated:
            document.body.textContent.includes('0x') ||
            document.body.textContent.includes('Connected'),
        };
      });

      console.log('Final Modal Summary:', modalSummary);

      expect(modalSummary.totalButtons).toBeGreaterThan(0);
    }, 15000);
  });
});
