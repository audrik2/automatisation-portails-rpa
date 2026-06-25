// steps/4a_employeur_associe.js
import { humanClick, readingPause } from '../helpers/human.js';
import { stepRechercherEmployeurNom } from './4b_rechercher_employeur_nom.js';

export async function stepEmployeurAssocie(page) {
  console.log('▶️  Step 4a: Vérification employeur associé...');

  // Check if an employeur is already associated with the apprenant
  const selectBtn = page.getByRole('button', { name: 'Sélectionner' });
  const hasAssociatedEmployeur = await selectBtn.isVisible().catch(() => false);

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