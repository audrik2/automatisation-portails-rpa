// steps/3b_creer_apprenant.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, humanType, readingPause } from '../helpers/human.js';

export async function stepCreerApprenant(page) {
  const payload = getPayload();
  console.log('▶️  Step 3b: Création d\'un nouvel apprenant:', payload['3b_last_name'], payload['3b_first_name']);

  // Your creation form steps go here once you have the codegen recording
  // Example structure:
  // await humanClick(page, page.getByRole('button', { name: '+ Créer un apprenant' }));
  // await readingPause(page);
  // await humanType(page, '[name="civilite"]', payload['3b_civility']);
  // await humanType(page, '[name="nom"]', payload['3b_last_name']);
  // await humanType(page, '[name="prenom"]', payload['3b_first_name']);
  // await humanType(page, '[name="date_naissance"]', payload['3b_birth_date']);
  // await humanType(page, '[name="adresse"]', payload['3b_address']);
  // await humanType(page, '[name="telephone"]', payload['3b_phone']);
  // await humanClick(page, page.getByRole('button', { name: 'Enregistrer' }));
  // await page.waitForLoadState('networkidle');

  console.log('✅ Step 3b complete');
}