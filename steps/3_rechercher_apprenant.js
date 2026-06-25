// steps/3_rechercher_apprenant.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';

async function verifierRefusInscription(page) {
  const refus = await page.getByText('L\'inscription de cet apprenant à cette formation est refusée').isVisible().catch(() => false);
  if (refus) {
    throw new Error('Inscription refusée: L\'inscription de cet apprenant à cette formation est refusée');
  }
}

export async function stepRechercherApprenantNom(page) {
  const payload = getPayload();

  // Normalize branche to uppercase — payload may send lowercase (e.g. "spe" instead of "SPE")
  payload['3_branche'] = payload['3_branche']?.toUpperCase();

  console.log('▶️  Step 3: Recherche apprenant par nom -', payload['3_last_name'], payload['3_first_name'], '| Année naissance:', payload['3a_birth_year']);

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
  await humanClick(page, page.getByText(payload['3_branche'], { exact: true }));
  await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Search by name, first name and birth year from payload
  await humanClick(page, page.getByRole('textbox', { name: 'Nom', exact: true }));
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill(payload['3_last_name']);
  await readingPause(page);

  await humanClick(page, page.getByRole('textbox', { name: 'Prénom', exact: true }));
  await page.getByRole('textbox', { name: 'Prénom', exact: true }).fill(payload['3_first_name']);
  await readingPause(page);

  await humanClick(page, page.getByRole('textbox', { name: 'Année de naissance' }));
  await page.getByRole('textbox', { name: 'Année de naissance' }).fill(payload['3a_birth_year']);
  await readingPause(page);

  await humanClick(page, page.getByLabel('Rechercher un apprenant').getByRole('button', { name: 'Rechercher' }));

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
    // Apprenant exists — select then complete education level
    console.log('✅ Apprenant trouvé par nom, sélection en cours...');
    await humanClick(page, selectBtn);
    await page.waitForLoadState('networkidle');
    await readingPause(page);

    await humanClick(page, page.getByRole('button', { name: 'Ouvrir le menu pour Niveau d' }));
    await readingPause(page);
    await humanClick(page, page.getByText('Inconnu', { exact: true }));
    await readingPause(page);

    await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');

    // Wait for the server-side acceptance check (~10s) then verify refusal message
    console.log('⏳ Vérification acceptation/refus apprenant...');
    await page.waitForTimeout(10000);
    await verifierRefusInscription(page);
    await readingPause(page);

    await humanClick(page, page.getByLabel('Information apprenant').getByRole('button', { name: 'Continuer' }));
    await page.waitForLoadState('networkidle');

    console.log('✅ Step 3 complete');

  } else {
    // No result by name — switch to passeport tab WITHIN the same modal
    console.log('⚠️  Aucun apprenant trouvé par nom pour:', payload['3_last_name'], payload['3_first_name']);
    console.log('▶️  Tentative de recherche par passeport...');

    await humanClick(page, page.getByRole('button', { name: '+ Recherche par passeport' }));
    await readingPause(page);
    await humanClick(page, page.getByRole('textbox', { name: 'Passeport', exact: true }));
    await page.getByRole('textbox', { name: 'Passeport', exact: true }).fill(payload['3b_passeport']);
    await humanClick(page, page.getByLabel('Rechercher un apprenant').getByRole('button', { name: 'Rechercher' }));

    await page.waitForLoadState('networkidle');
    await readingPause(page);

    const outcomePasseport = await Promise.race([
      selectBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'found'),
      noResults.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'not_found'),
    ]);

    if (outcomePasseport === 'found') {
      console.log('✅ Apprenant trouvé par passeport, sélection en cours...');
      await humanClick(page, selectBtn);
      await page.waitForLoadState('networkidle');
      await readingPause(page);

      await humanClick(page, page.getByRole('button', { name: 'Ouvrir le menu pour Niveau d' }));
      await readingPause(page);
      await humanClick(page, page.getByText('Inconnu', { exact: true }));
      await readingPause(page);

      await humanClick(page, page.getByRole('button', { name: 'Continuer' }));
      await page.waitForLoadState('networkidle');

      // Wait for the server-side acceptance check (~10s) then verify refusal message
      console.log('⏳ Vérification acceptation/refus apprenant...');
      await page.waitForTimeout(10000);
      await verifierRefusInscription(page);
      await readingPause(page);

      await humanClick(page, page.getByLabel('Information apprenant').getByRole('button', { name: 'Continuer' }));
      await page.waitForLoadState('networkidle');

      console.log('✅ Step 3 complete (via passeport fallback)');

    } else {
      console.log('❌ Aucun apprenant trouvé pour le passeport:', payload['3b_passeport']);
      throw new Error(`Aucun apprenant trouvé (nom et passeport) pour: ${payload['3_last_name']} ${payload['3_first_name']} / passeport ${payload['3b_passeport']}`);
    }
  }
}