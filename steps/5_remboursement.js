// steps/5_remboursement.js
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepRemboursement(page) {
  console.log('▶️  Step 5: Remboursement...');

  // Select the remboursement option
  await humanClick(page, page.getByRole('button', { name: 'Sélectionner' }));
  await readingPause(page);

  await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Confirm remboursement with Oui
  await humanClick(page, page.locator('label').filter({ hasText: 'Oui' }));
  await readingPause(page);

  // Select payment method
  await humanClick(page, page.getByText('Chèque'));
  await readingPause(page);

  // Finalize inscription
  await humanClick(page, page.getByRole('button', { name: 'Inscrire et continuer' }));
  await page.waitForLoadState('networkidle');

  console.log('✅ Step 5 complete');
}