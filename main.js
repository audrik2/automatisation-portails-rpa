// main.js
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { config } from './config.js';
import { getPayload } from './helpers/payload.js';
import { login } from './steps/1_connection.js';
import { runSteps } from './helpers/router.js';

const payload = getPayload();

const browser = await chromium.launch({
  headless: config.headless,
  slowMo: config.slowMo,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,900',
  ],
});

const tempPage = await browser.newPage();
const rawUserAgent = await tempPage.evaluate(() => navigator.userAgent);
await tempPage.close();
const realUserAgent = rawUserAgent.replace('HeadlessChrome', 'Chrome');

const context = await browser.newContext({
  userAgent: realUserAgent,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  hasTouch: false,
  extraHTTPHeaders: {
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
  },
  storageState: existsSync('./session.json') ? './session.json' : undefined,
});

const page = await context.newPage();
page.setDefaultTimeout(config.timeout);

await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
});

try {
  if (!payload['sync_type']) {
    throw new Error('Missing sync_type in payload. Cannot determine which steps to run.');
  }

  await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
  const isLoggedIn = await page.getByRole('button', { name: 'Oceane' }).isVisible()
    .catch(() => false);

  if (!isLoggedIn) {
    await login(page);
    await context.storageState({ path: './session.json' });
    console.log('💾 Session saved');
  } else {
    console.log('♻️  Session réutilisée — login ignoré');
  }

  await runSteps(page, payload['sync_type']);
  console.log('✅ All steps passed');

} catch (err) {
  try {
    await page.screenshot({ path: './screenshots/error.png', timeout: 5000 });
    console.log('📸 Screenshot saved to screenshots/error.png');
  } catch (screenshotErr) {
    console.warn('⚠️  Screenshot failed:', screenshotErr.message);
  }
  console.error('❌ Step failed:', err.message);
} finally {
  await browser.close();
}