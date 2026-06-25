// steps/3_selectionner_apprenant.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepSelectionnerApprenant(page) {
  const payload = getPayload();
  console.log('▶️  Step 3: Sélection apprenant:', payload['3_first_name'], payload['3_last_name']);

  // Open the menu
  await humanClick(page, page.getByRole('button', { name: 'Menu', exact: true }));
  await readingPause(page);

  // Navigate to Apprenants — regex ignores the dynamic count
  await humanClick(page, page.getByRole('link', { name: /Apprenants/ }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Select the apprenant by name from payload
  await humanClick(page, page.getByRole('link', { name: `Voir ${payload['3_civility']} ${payload['3_first_name']} ${payload['3_last_name']}` }));
  await page.waitForLoadState('networkidle');

  console.log('✅ Step 3 complete');
}