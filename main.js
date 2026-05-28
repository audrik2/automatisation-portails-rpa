// main.js
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { config } from './config.js';
import { getPayload } from './helpers/payload.js';
import { login } from './steps/1_connection.js';
import { stepFormation } from './steps/2_formation.js';
import { stepRechercherApprenant } from './steps/3a_rechercher_apprenant.js';
import { stepRemboursement } from './steps/5_remboursement.js';
import { stepImporterDocuments } from './steps/6_importer_documents.js';
// 3b and 3c are called automatically by 3a — no import needed here

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

// Read the real Chromium version and strip "Headless" from the user agent
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

// Mask automation fingerprint on every page load
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
});

try {
  // Reuse session if still valid, otherwise log in fresh
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

  await stepFormation(page);
  await stepRechercherApprenant(page);
  await stepRemboursement(page);
  await stepImporterDocuments(page);
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