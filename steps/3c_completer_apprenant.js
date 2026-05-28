// steps/3c_completer_apprenant.js
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepCompleterApprenant(page) {
  console.log('▶️  Step 3c: Compléter informations apprenant...');

  // Select education level
  await humanClick(page, page.getByRole('button', { name: 'Ouvrir le menu pour Niveau d' }));
  await readingPause(page);
  await humanClick(page, page.getByText('Inconnu'));
  await readingPause(page);

  // First continue — validates the education level selection
  await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Second continue — validates the full apprenant information form
  await humanClick(page, page.getByLabel('Information apprenant').getByRole('button', { name: 'Continuer' }));
  await page.waitForLoadState('networkidle');

  console.log('✅ Step 3c complete');
}