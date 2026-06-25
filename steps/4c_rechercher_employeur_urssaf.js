// steps/4c_rechercher_employeur_urssaf.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepRechercherEmployeurUrssaf(page) {
  const payload = getPayload();
  console.log('▶️  Step 4c: Recherche employeur par URSSAF -', payload['4c_urssaf']);

  // Switch to URSSAF tab — button shows "+" when inactive, "-" when active
  await humanClick(page, page.getByRole('button', { name: '+ Recherche par N°Urssaf' }));
  await readingPause(page);

  await humanClick(page, page.getByRole('textbox', { name: 'N°Urssaf' }));
  await page.getByRole('textbox', { name: 'N°Urssaf' }).fill(payload['4c_urssaf']);
  await readingPause(page);

  await humanClick(page, page.getByLabel('Rechercher un employeur').getByRole('button', { name: 'Rechercher' }));

  // Wait for search to complete
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Check whether a result was found or not
  const selectBtn = page.getByRole('button', { name: 'Sélectionner' });
  const noResults = page.getByText('Aucun résultat à afficher');

  const outcome = await Promise.race([
    selectBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'found'),
    noResults.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'not_found'),
  ]);

  if (outcome === 'found') {
    console.log('✅ Employeur trouvé par URSSAF, sélection en cours...');
    await humanClick(page, selectBtn);
    await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');

    console.log('✅ Step 4c complete');

  } else {
    console.log('⚠️  Aucun employeur trouvé pour le N°Urssaf:', payload['4c_urssaf']);
    throw new Error(`Aucun employeur trouvé pour le N°Urssaf: ${payload['4c_urssaf']}`);
  }
}