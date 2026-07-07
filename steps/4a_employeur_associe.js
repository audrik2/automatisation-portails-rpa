// steps/4a_employeur_associe.js
import { humanClick, readingPause } from '../helpers/human.js';
import { stepRechercherEmployeurNom } from './4b_rechercher_employeur_nom.js';
import { logStepResult } from '../helpers/router.js';

export async function stepEmployeurAssocie(page) {
  console.log('▶️  Step 4a: Vérification employeur associé...');

  // Make sure the page has fully settled after step 3 before checking
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Wait up to 8s for the Sélectionner button to appear
  const selectBtn = page.getByRole('button', { name: 'Sélectionner' }).first();
  const hasAssociatedEmployeur = await selectBtn
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (hasAssociatedEmployeur) {
    // Employeur already associated — select and continue
    console.log('✅ Employeur associé trouvé, sélection en cours...');
    await humanClick(page, selectBtn);
    await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');
    console.log('✅ Step 4a complete');
    // runStep in router.js logs 4a success

  } else {
    // No associated employeur — log 4a error and try 4b
    console.log('⚠️  Aucun employeur associé trouvé');
    logStepResult('4a_employeur_associe.js', 'error');
    console.log('▶️  Tentative de recherche par nom (4b)...');

    // 4b returns true on success, false on failure (after trying 4c internally)
    const employeurFound = await stepRechercherEmployeurNom(page);

    if (!employeurFound) {
      // 4b and 4c both failed — throw so runStep catches and logs overall failure
      throw new Error('Aucun employeur trouvé — recherche par nom et URSSAF ont échoué');
    }
  }
}
