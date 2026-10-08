// steps/5_remboursement.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepRemboursement(page) {
  const payload = getPayload();
  console.log('Step 5: Remboursement -', payload['5_rib_titulaire']);

  // Confirmer le remboursement avec Oui
  await humanClick(page, page.getByText('Oui', { exact: true }));
  await readingPause(page);

  // Titulaire du compte — click puis fill
  await page.getByRole('textbox', { name: 'Titulaire*' }).click();
  await page.getByRole('textbox', { name: 'Titulaire*' }).fill(payload['5_rib_titulaire']);
  await readingPause(page);

  // IBAN — click, select all, puis fill
  await page.getByRole('textbox', { name: 'Saisissez un IBAN*' }).click();
  await page.getByRole('textbox', { name: 'Saisissez un IBAN*' }).press('ControlOrMeta+a');
  await page.getByRole('textbox', { name: 'Saisissez un IBAN*' }).fill(payload['5_rib_iban']);
  await readingPause(page);

  // BIC — click puis fill
  await page.getByRole('textbox', { name: 'Saisissez un BIC*' }).click();
  await page.getByRole('textbox', { name: 'Saisissez un BIC*' }).fill(payload['5_rib_bic']);
  await readingPause(page);

  // Finaliser l'inscription
  await humanClick(page, page.getByRole('button', { name: 'Inscrire et continuer' }));
  await page.waitForLoadState('networkidle');

  console.log('Step 5 complete');
}