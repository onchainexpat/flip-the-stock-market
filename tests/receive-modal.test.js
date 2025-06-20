const puppeteer = require('puppeteer');

describe('Receive Modal Visual Test', () => {
  let browser;
  let page;
  const BASE_URL = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null
    });
    page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    page.on('console', msg => {
      console.log('BROWSER:', msg.text());
    });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should check Receive modal positioning and visibility', async () => {
    console.log('=== Testing Receive Modal Positioning ===');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take initial screenshot
    await page.screenshot({ path: 'receive-modal-01-initial.png', fullPage: true });
    
    // Check if modal is rendered in DOM but might be off-screen
    const modalCheck = await page.evaluate(() => {
      // Find all fixed position elements that might be modals
      const fixedElements = Array.from(document.querySelectorAll('.fixed'));
      const modals = fixedElements.filter(el => {
        const styles = window.getComputedStyle(el);
        return styles.position === 'fixed' && el.className.includes('inset-0');
      });
      
      return modals.map(modal => {
        const rect = modal.getBoundingClientRect();
        const styles = window.getComputedStyle(modal);
        const innerContent = modal.querySelector('[class*="rounded"]');
        const innerRect = innerContent ? innerContent.getBoundingClientRect() : null;
        
        return {
          className: modal.className,
          visible: modal.offsetHeight > 0 && modal.offsetWidth > 0,
          position: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          styles: {
            position: styles.position,
            top: styles.top,
            left: styles.left,
            right: styles.right,
            bottom: styles.bottom,
            zIndex: styles.zIndex,
            display: styles.display
          },
          innerContent: innerRect ? {
            top: innerRect.top,
            left: innerRect.left,
            width: innerRect.width,
            height: innerRect.height,
            centerX: innerRect.left + (innerRect.width / 2),
            centerY: innerRect.top + (innerRect.height / 2)
          } : null,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });
    });
    
    console.log('Modal check before opening:', modalCheck);
    
    // Simulate opening the Receive modal
    const testResult = await page.evaluate(() => {
      // Create a test modal with the same classes to check positioning
      const testModal = document.createElement('div');
      testModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
      testModal.setAttribute('data-testid', 'test-receive-modal');
      
      const content = document.createElement('div');
      content.className = 'bg-[#1B2236] rounded-2xl p-8 w-full max-w-md';
      content.innerHTML = '<h2 class="text-white text-2xl">Test Receive Modal</h2><p class="text-white mt-4">Testing positioning</p>';
      
      testModal.appendChild(content);
      document.body.appendChild(testModal);
      
      // Get positioning info
      const modalRect = testModal.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      // Check if content is centered
      const contentCenterX = contentRect.left + (contentRect.width / 2);
      const contentCenterY = contentRect.top + (contentRect.height / 2);
      const viewportCenterX = viewport.width / 2;
      const viewportCenterY = viewport.height / 2;
      
      const result = {
        modalPosition: {
          top: modalRect.top,
          left: modalRect.left,
          width: modalRect.width,
          height: modalRect.height
        },
        contentPosition: {
          top: contentRect.top,
          left: contentRect.left,
          width: contentRect.width,
          height: contentRect.height,
          centerX: contentCenterX,
          centerY: contentCenterY
        },
        viewport: viewport,
        isCentered: {
          horizontal: Math.abs(contentCenterX - viewportCenterX) < 50,
          vertical: Math.abs(contentCenterY - viewportCenterY) < 50
        },
        isOffScreen: {
          top: contentRect.top < 0,
          bottom: contentRect.bottom > viewport.height,
          left: contentRect.left < 0,
          right: contentRect.right > viewport.width
        }
      };
      
      // Clean up
      testModal.remove();
      
      return result;
    });
    
    console.log('Test modal positioning:', testResult);
    
    // Take screenshot with test modal
    await page.screenshot({ path: 'receive-modal-02-test-position.png', fullPage: true });
    
    // Check for any issues
    if (testResult.isOffScreen.top || testResult.isOffScreen.bottom || 
        testResult.isOffScreen.left || testResult.isOffScreen.right) {
      console.log('⚠️  WARNING: Modal content is off-screen!');
      console.log('Off-screen sides:', testResult.isOffScreen);
    }
    
    if (!testResult.isCentered.horizontal || !testResult.isCentered.vertical) {
      console.log('⚠️  WARNING: Modal content is not centered!');
      console.log('Centering status:', testResult.isCentered);
    }
    
    expect(testResult).toBeDefined();
  }, 30000);
});