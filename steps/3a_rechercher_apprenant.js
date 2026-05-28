// steps/3a_rechercher_apprenant.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, humanType, readingPause } from '../helpers/human.js';
import { stepCreerApprenant } from './3b_creer_apprenant.js';
import { stepCompleterApprenant } from './3c_completer_apprenant.js';

export async function stepRechercherApprenant(page) {
  const payload = getPayload();
  console.log('▶️  Step 3a: Recherche apprenant - Branche:', payload['3a_branche'], '| Passeport:', payload['3a_passeport']);

  // Open the action menu and navigate to Apprenants
  await humanClick(page, page.getByRole('button', { name: 'Menu', exact: true }));
  await humanClick(page, page.getByRole('link', { name: /Apprenants/ }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Start inscription flow
  await humanClick(page, page.getByRole('link', { name: '+ Inscrire' }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Select branch from payload
  await humanClick(page, page.getByText(payload['3a_branche'], { exact: true }));
  await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Search by passport number from payload
  await humanClick(page, page.getByRole('button', { name: '+ Recherche par passeport' }));
  await humanClick(page, page.getByRole('textbox', { name: 'Passeport', exact: true }));
  await page.getByRole('textbox', { name: 'Passeport', exact: true }).fill(payload['3a_passeport']);
  await humanClick(page, page.getByLabel('Rechercher un apprenant').getByRole('button', { name: 'Rechercher' }));

  // Wait for search to complete
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Check whether a result was found or not
  const selectBtn = page.getByRole('button', { name: 'Sélectionner' });
  const noResults = page.getByText('Aucun résultat');

  const outcome = await Promise.race([
    selectBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'found'),
    noResults.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'not_found'),
  ]);

  if (outcome === 'found') {
    // Apprenant exists — select then complete their information
    console.log('✅ Apprenant trouvé, sélection en cours...');
    await humanClick(page, selectBtn);
    await page.waitForLoadState('networkidle');
    await stepCompleterApprenant(page);

  } else {
    // Apprenant does not exist — create them first
    console.log('⚠️  Aucun apprenant trouvé pour le passeport:', payload['3a_passeport']);
    console.log('▶️  Redirection vers la création d\'un nouvel apprenant...');
    await stepCreerApprenant(page);
  }
}