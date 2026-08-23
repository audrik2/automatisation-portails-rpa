// main.js
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { config } from './config.js';
import { getPayload } from './helpers/payload.js';
import { login } from './steps/1_connection.js';
import { runSteps, logStepResult } from './helpers/router.js';

const SESSION_PATH = './session.json';

// ─────────────────────────────────────────────────────────────
// Session : lecture defensive + ecriture atomique.
// Utile meme en sequentiel : si le process est tue en plein
// storageState() (timeout de 600s cote server.js), le fichier
// reste tronque et TOUS les runs suivants planteraient au
// demarrage, avant meme d'atteindre le premier step.
// ─────────────────────────────────────────────────────────────
function loadSession() {
  if (!existsSync(SESSION_PATH)) return undefined;
  try {
    JSON.parse(readFileSync(SESSION_PATH, 'utf8'));
    return SESSION_PATH;
  } catch (err) {
    console.warn(`⚠️  session.json illisible (${err.message}) — suppression, nouveau login`);
    try { unlinkSync(SESSION_PATH); } catch {}
    return undefined;
  }
}

async function saveSession(context) {
  const tmp = `${SESSION_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(await context.storageState()));
  renameSync(tmp, SESSION_PATH); // rename() est atomique sur le meme filesystem
  console.log('💾 Session sauvegardée');
}

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

// ─────────────────────────────────────────────────────────────
// Filet de securite : server.js tue ce process par SIGTERM au
// bout de 120s (timeout de exec). Sans ce handler, le finally
// plus bas ne s'executerait pas et Chromium resterait en RAM.
// ─────────────────────────────────────────────────────────────
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    console.warn(`⚠️  ${signal} reçu — fermeture du navigateur`);
    try { await browser.close(); } catch {}
    process.exit(1);
  });
}

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
  storageState: loadSession(),
});

const page = await context.newPage();
page.setDefaultTimeout(config.timeout);

await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
});

// Wrap each step — log predefined French message on success or failure
async function runStep(name, fn) {
  try {
    await fn();
    logStepResult(name, 'success');
    return true;
  } catch (err) {
    // On remonte le message reel : sans ca, tout echec est indiagnosticable
    console.error(`❌ ${name} — ${err.message}`);
    logStepResult(name, 'error', err.message);
    return false;
  }
}

try {
  if (!payload['sync_type']) {
    throw new Error('Missing sync_type in payload. Cannot determine which steps to run.');
  }

  // 'networkidle' attend 500ms sans trafic reseau : instable sur une SPA.
  // On attend l'element qui compte a la place.
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });

  const isLoggedIn = await page.getByRole('button', { name: 'Oceane' })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!isLoggedIn) {
    const loginOk = await runStep('1_connection.js', () => login(page));
    if (!loginOk) {
      // Surtout pas process.exit() ici : le finally ne s'executerait pas
      // et Chromium resterait en memoire sur le VPS.
      process.exitCode = 1;
      throw new Error('Login failed');
    }
    await saveSession(context);
  } else {
    console.log('♻️  Session réutilisée');
    logStepResult('1_connection.js', 'success', 'Succès : session réutilisée');
  }

  await runSteps(page, payload['sync_type'], runStep);

} catch (err) {
  try {
    mkdirSync('./screenshots', { recursive: true });
    const shot = `./screenshots/error-${Date.now()}.png`;
    await page.screenshot({ path: shot, timeout: 5000, fullPage: true });
    console.log(`📸 Screenshot saved to ${shot}`);
  } catch (screenshotErr) {
    console.warn('⚠️  Screenshot failed:', screenshotErr.message);
  }
  console.error('❌ Step failed:', err.message);
  console.error('   URL au moment de l\'échec :', page.url());

} finally {
  await browser.close();
}
