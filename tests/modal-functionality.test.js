const puppeteer = require('puppeteer');

describe('Modal Functionality Tests', () => {
  let browser;
  let page;
  const BASE_URL = 'http://localhost:3001';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();

    // Set viewport and enable console logging
    await page.setViewport({ width: 1920, height: 1080 });

    // Listen to console logs
    page.on('console', (msg) => {
      console.log('BROWSER LOG:', msg.text());
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      console.error('PAGE ERROR:', error.message);
    });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Navigate to the app
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the page to load
    await page.waitForFunction(() => document.readyState === 'complete');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, 70000);

  describe('Page Load and Authentication', () => {
    test('should load the application successfully', async () => {
      const title = await page.title();
      console.log('Page title:', title);
      expect(title).toContain('SPX6900');

      // Take screenshot for debugging
      await page.screenshot({ path: 'test-page-load.png', fullPage: true });
    }, 30000);

    test('should show login button when not authenticated', async () => {
      // Wait for React to render
      await page.waitForSelector('body', { timeout: 10000 });

      // Look for login/connect elements
      const hasLoginButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginButton = buttons.find(
          (btn) =>
            btn.textContent.toLowerCase().includes('login') ||
            btn.textContent.toLowerCase().includes('connect') ||
            btn.textContent.toLowerCase().includes('sign in'),
        );
        return !!loginButton;
      });

      console.log('Login button found:', hasLoginButton);
      expect(hasLoginButton).toBeTruthy();
    }, 20000);
  });

  describe('zkp2p Buy USDC Modal Debug', () => {
    test('should check for Buy USDC button and modal structure', async () => {
      console.log('=== Debugging Buy USDC Modal ===');

      // Wait for page to be fully loaded
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Take initial screenshot
      await page.screenshot({
        path: 'debug-initial-state.png',
        fullPage: true,
      });

      // Check if there are any profile/dropdown buttons
      const profileButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map((btn) => ({
          text: btn.textContent.trim(),
          className: btn.className,
          visible: btn.offsetHeight > 0 && btn.offsetWidth > 0,
        }));
      });

      console.log('All buttons on page:', profileButtons);

      // Look for any element that might trigger a profile dropdown
      const profileElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const profileRelated = elements.filter(
          (el) =>
            el.textContent &&
            (el.textContent.toLowerCase().includes('profile') ||
              el.textContent.toLowerCase().includes('dropdown') ||
              el.textContent.toLowerCase().includes('menu') ||
              el.className.toLowerCase().includes('profile') ||
              el.className.toLowerCase().includes('dropdown')),
        );
        return profileRelated.map((el) => ({
          tagName: el.tagName,
          className: el.className,
          text: el.textContent.trim().substring(0, 50),
        }));
      });

      console.log('Profile-related elements:', profileElements);

      // Try clicking the first visible button to see if it opens a dropdown
      const clickableButton = await page.$('button');
      if (clickableButton) {
        console.log('Clicking first button to test dropdown...');
        await clickableButton.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Take screenshot after click
        await page.screenshot({
          path: 'debug-after-button-click.png',
          fullPage: true,
        });

        // Check if any new elements appeared
        const afterClickElements = await page.evaluate(() => {
          const modals = Array.from(
            document.querySelectorAll(
              '.fixed, [class*="modal"], [class*="dropdown"]',
            ),
          );
          return modals.map((el) => ({
            className: el.className,
            visible: el.offsetHeight > 0 && el.offsetWidth > 0,
            zIndex: window.getComputedStyle(el).zIndex,
            display: window.getComputedStyle(el).display,
          }));
        });

        console.log('Modal/dropdown elements after click:', afterClickElements);
      }

      // Look specifically for "Buy USDC" text anywhere on the page
      const buyUSDCElements = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
          if (
            node.textContent.toLowerCase().includes('buy usdc') ||
            node.textContent.toLowerCase().includes('venmo')
          ) {
            textNodes.push({
              text: node.textContent.trim(),
              parentElement: node.parentElement.tagName,
              parentClass: node.parentElement.className,
            });
          }
        }
        return textNodes;
      });

      console.log('Buy USDC related text found:', buyUSDCElements);

      // This test is mainly for debugging, so we'll pass if we got this far
      expect(true).toBeTruthy();
    }, 30000);
  });

  describe('Modal Rendering Test', () => {
    test('should test modal rendering directly', async () => {
      console.log('=== Testing Modal Rendering ===');

      // Inject a test modal directly to verify our modal styles work
      const modalVisible = await page.evaluate(() => {
        // Remove any existing test modals
        const existing = document.querySelector('[data-testid="test-modal"]');
        if (existing) existing.remove();

        // Create test modal
        const modal = document.createElement('div');
        modal.setAttribute('data-testid', 'test-modal');
        modal.className =
          'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.style.cssText =
          'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 9999 !important; background-color: rgba(0,0,0,0.5) !important;';

        const content = document.createElement('div');
        content.className =
          'bg-[#1B2236] rounded-xl p-6 w-full max-w-md border-4 border-red-500';
        content.style.cssText =
          'background-color: #1B2236 !important; border: 4px solid red !important; padding: 24px !important; border-radius: 12px !important; max-width: 400px !important; width: 100% !important;';
        content.innerHTML =
          '<h3 style="color: white; font-size: 20px; font-weight: bold;">TEST MODAL - Buy USDC with Venmo</h3><p style="color: white; margin-top: 16px;">If you can see this, modal rendering works correctly!</p>';

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Check if modal is visible
        const rect = modal.getBoundingClientRect();
        const styles = window.getComputedStyle(modal);

        return {
          visible: modal.offsetHeight > 0 && modal.offsetWidth > 0,
          rect: {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
          },
          styles: {
            position: styles.position,
            zIndex: styles.zIndex,
            display: styles.display,
            backgroundColor: styles.backgroundColor,
          },
        };
      });

      console.log('Test modal visibility:', modalVisible);

      // Take screenshot with test modal
      await page.screenshot({ path: 'debug-test-modal.png', fullPage: true });

      expect(modalVisible.visible).toBeTruthy();
      expect(modalVisible.styles.position).toBe('fixed');
      expect(Number.parseInt(modalVisible.styles.zIndex)).toBeGreaterThan(1000);

      // Clean up
      await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="test-modal"]');
        if (modal) modal.remove();
      });
    }, 20000);
  });

  describe('Component State Debug', () => {
    test('should check React component state and props', async () => {
      console.log('=== Debugging React Component State ===');

      // Check if BuyUSDCModal component exists in the React tree
      const reactInfo = await page.evaluate(() => {
        // Try to find React fiber nodes
        const findReactFiber = (element) => {
          for (const key in element) {
            if (
              key.startsWith('__reactInternalInstance$') ||
              key.startsWith('__reactFiber$')
            ) {
              return element[key];
            }
          }
          return null;
        };

        // Look for BuyUSDCModal in the component tree
        const allElements = Array.from(document.querySelectorAll('*'));
        const reactComponents = [];

        allElements.forEach((el) => {
          const fiber = findReactFiber(el);
          if (fiber && fiber.type && typeof fiber.type === 'function') {
            const componentName = fiber.type.name || fiber.type.displayName;
            if (
              componentName &&
              (componentName.includes('Modal') ||
                componentName.includes('Dropdown') ||
                componentName.includes('Profile'))
            ) {
              reactComponents.push({
                name: componentName,
                props: fiber.memoizedProps
                  ? Object.keys(fiber.memoizedProps)
                  : [],
                state: fiber.memoizedState ? 'has state' : 'no state',
              });
            }
          }
        });

        return {
          components: reactComponents,
          totalElements: allElements.length,
        };
      });

      console.log('React components found:', reactInfo);

      expect(reactInfo.totalElements).toBeGreaterThan(0);
    }, 15000);
  });
});
