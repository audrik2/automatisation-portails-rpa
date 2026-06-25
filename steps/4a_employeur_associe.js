// steps/4a_employeur_associe.js
import { humanClick, readingPause } from '../helpers/human.js';
import { stepRechercherEmployeurNom } from './4b_rechercher_employeur_nom.js';

export async function stepEmployeurAssocie(page) {
  console.log('▶️  Step 4a: Vérification employeur associé...');

  // Make sure the page has fully settled after step 3 before checking
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Wait up to 8s for the button to appear instead of checking instantly
  const selectBtn = page.getByRole('button', { name: 'Sélectionner' }).first();
  const hasAssociatedEmployeur = await selectBtn
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (hasAssociatedEmployeur) {
    console.log('✅ Employeur associé trouvé, sélection en cours...');
    await humanClick(page, selectBtn);
    await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');

    console.log('✅ Step 4a complete');

  } else {
    console.log('⚠️  Aucun employeur associé trouvé');
    console.log('▶️  Tentative de recherche par nom...');
    await stepRechercherEmployeurNom(page);
  }
}