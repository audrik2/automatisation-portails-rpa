// steps/4b_rechercher_employeur_nom.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';
import { stepRechercherEmployeurUrssaf } from './4c_rechercher_employeur_urssaf.js';

export async function stepRechercherEmployeurNom(page) {
  const payload = getPayload();
  console.log('▶️  Step 4b: Recherche employeur par nom -', payload['4b_last_name'], payload['4b_first_name']);

  // Search by name and first name
  await humanClick(page, page.getByRole('button', { name: '+ Recherche par nom / prénom' }));
  await readingPause(page);

  await humanClick(page, page.getByRole('textbox', { name: 'Nom', exact: true }));
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill(payload['4b_last_name']);
  await readingPause(page);

  await humanClick(page, page.getByRole('textbox', { name: 'Prénom', exact: true }));
  await page.getByRole('textbox', { name: 'Prénom', exact: true }).fill(payload['4b_first_name']);
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
    console.log('✅ Employeur trouvé par nom, sélection en cours...');
    await humanClick(page, selectBtn);
    await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');

    console.log('✅ Step 4b complete');

  } else {
    console.log('⚠️  Aucun employeur trouvé par nom pour:', payload['4b_last_name'], payload['4b_first_name']);
    console.log('▶️  Tentative de recherche par URSSAF...');
    await stepRechercherEmployeurUrssaf(page);
  }
}