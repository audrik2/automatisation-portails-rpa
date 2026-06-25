// helpers/human.js

/**
 * IMPORTANT — humanType only works with plain CSS selectors:
 *   ✅ humanType(page, '[placeholder="value"]', text)
 *   ✅ humanType(page, '#field-id', text)
 *   ❌ humanType(page, '[role="textbox"][name="value"]', text)  ← invalid
 *
 * For role-based or label-based fields, use this pattern instead:
 *   await humanClick(page, page.getByRole('textbox', { name: 'value' }));
 *   await page.getByRole('textbox', { name: 'value' }).fill(payload['key']);
 */

/**
 * Random delay between min and max milliseconds
 */
export async function randomDelay(page, min = 300, max = 900) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(ms);
}

/**
 * Occasionally simulate a longer hesitation (human distraction)
 * 20% chance of a 2-5 second pause, otherwise 200-800ms
 */
export async function randomDelayWithHesitation(page) {
  const hesitate = Math.random() < 0.2;
  const ms = hesitate
    ? Math.floor(Math.random() * 3000) + 2000
    : Math.floor(Math.random() * 600) + 200;
  await page.waitForTimeout(ms);
}

/**
 * Type text character by character with variable speed
 * Simulates a human typing with occasional hesitations
 */
export async function humanType(page, selector, text) {
  await page.locator(selector).click();
  for (const char of text) {
    await page.keyboard.type(char);
    const delay = Math.floor(Math.random() * 140) + 80;
    await page.waitForTimeout(delay);
  }
  await randomDelay(page, 300, 600);
}

/**
 * Click with a short pause before and after
 */
export async function humanClick(page, locator) {
  await randomDelay(page, 200, 600);
  await locator.click();
  await randomDelay(page, 300, 700);
}

/**
 * Pause between major steps
 * Simulates a human reading the screen before moving on
 */
export async function readingPause(page) {
  await randomDelay(page, 800, 2000);
}

/**
 * Maps short civility codes from payload to full French display values
 */
export function normalizeCivility(value) {
  const map = {
    'mme': 'Madame',
    'm': 'Monsieur',
    'mr': 'Monsieur',
    'mlle': 'Mademoiselle',
  };
  return map[value?.toLowerCase()] || value;
}