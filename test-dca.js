const puppeteer = require('puppeteer');

async function testDCA() {
  console.log('🚀 Starting Puppeteer test...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    console.log('📄 Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Take screenshot of initial page
    await page.screenshot({ path: 'page-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: page-initial.png');

    // Check page title
    const title = await page.title();
    console.log('📌 Page title:', title);

    // Check for main heading
    const heading = await page
      .$eval('h1', (el) => el.textContent)
      .catch(() => null);
    console.log('📝 Main heading:', heading);

    // Check for authentication elements
    const hasProfileDropdown =
      (await page.$('[class*="ProfileDropdown"]')) !== null;
    const hasConnectButton =
      (await page.$('button:has-text("Connect")')) !== null;
    const hasLoginButton = await page
      .$eval('*', () => {
        return !!Array.from(document.querySelectorAll('button')).find(
          (btn) =>
            btn.textContent?.includes('Login') ||
            btn.textContent?.includes('Connect') ||
            btn.textContent?.includes('Sign'),
        );
      })
      .catch(() => false);

    console.log('🔐 Has profile dropdown:', hasProfileDropdown);
    console.log('🔐 Has connect/login button:', hasLoginButton);

    // Check for DCA elements
    const hasDCAElements = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasAutoFBuy: text.includes('Auto-Buy'),
        hasDCA: text.includes('DCA'),
        hasDollarCost: text.includes('dollar cost'),
        hasFrequency: text.includes('frequency') || text.includes('Frequency'),
      };
    });

    console.log('💰 DCA Elements found:', hasDCAElements);

    // Check for swap elements
    const hasSwap = (await page.$('[class*="Swap"]')) !== null;
    console.log('💱 Has swap component:', hasSwap);

    // Get all visible text
    const visibleText = await page.evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, h3, button, p');
      return Array.from(elements)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .slice(0, 20);
    });

    console.log('\n📊 First 20 visible text elements:');
    visibleText.forEach((text, i) => console.log(`   ${i + 1}. ${text}`));

    // Check page structure
    const pageStructure = await page.evaluate(() => {
      return {
        hasMainContent: !!document.querySelector('main'),
        hasTradingSection: !!document.querySelector('[class*="Trading"]'),
        hasGrid: !!document.querySelector('.grid'),
        gridColumns: document.querySelectorAll('.grid > *').length,
        hasSideBySide: !!document.querySelector('.lg\\:grid-cols-2'),
      };
    });

    console.log('\n🏗️ Page structure:', pageStructure);

    // Try to find specific DCA component
    const dcaQuickSetup = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const hasImport = scripts.some((s) =>
        s.textContent?.includes('DCAQuickSetup'),
      );
      return hasImport;
    });

    console.log('🎯 DCAQuickSetup imported:', dcaQuickSetup);
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Test complete!');
  }
}

// Run the test
testDCA().catch(console.error);
