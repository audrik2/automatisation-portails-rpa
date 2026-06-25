// steps/4_importer_documents_facturation.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause, randomDelay } from '../helpers/human.js';

async function verifierErreurPage(page) {
  const erreur = await page.getByText('CLIENT_ERROR').isVisible().catch(() => false);
  if (erreur) {
    throw new Error('Erreur application CLIENT_ERROR détectée — le serveur a retourné une erreur inattendue');
  }
}

async function importerDocument(page, boutonLocator, cheminFichier, nomFichier, label) {
  console.log(`▶️  Import: ${label}...`);

  // Click the specific document button identified by its fieldset position
  await humanClick(page, boutonLocator);

  // Wait for the modal to appear
  await page.getByRole('heading', { name: 'Importer un document' }).waitFor({ state: 'visible', timeout: 10000 });
  await readingPause(page);

  // Fill the file name field
  await humanClick(page, page.getByLabel('NOM DU FICHIER'));
  await page.getByLabel('NOM DU FICHIER').fill(nomFichier);
  await readingPause(page);

  // Try hidden input first — most reliable approach
  const hiddenInput = page.locator('input[type="file"]').first();
  const hasHiddenInput = await hiddenInput.count() > 0;

  if (hasHiddenInput) {
    await hiddenInput.setInputFiles(cheminFichier);
  } else {
    // Fallback — trigger file chooser by clicking the drag-and-drop zone
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('div').filter({
        hasText: /^Glissez-déposez un fichier ici, ou cliquez pour en sélectionner un$/
      }).first().click(),
    ]);
    await fileChooser.setFiles(cheminFichier);
  }

  await readingPause(page);

  // Click Créer to confirm
  await humanClick(page, page.getByRole('button', { name: 'Créer', exact: true }));

  // Wait for upload to complete
  console.log(`⏳ Attente traitement upload: ${label}...`);
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await verifierErreurPage(page);
  await randomDelay(page, 1500, 3000);

  console.log(`✅ ${label} importé`);
}

export async function stepImporterDocumentsFacturation(page) {
  const payload = getPayload();
  console.log('▶️  Step 4: Import des documents facturation...');

  // Navigate to Documents section first
  await humanClick(page, page.getByText('DOCUMENTS', { exact: true }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Bilan — fieldset 3, first document block
  await importerDocument(
    page,
    page.locator('fieldset:nth-child(3) > .Fieldset > div > .DocumentForm__documents > .DocumentForm__inputs > .Button').first(),
    payload['4_doc_bilan'],
    'Bilan',
    'Bilan'
  );

  // Emargement — fieldset 3, second document block
  await importerDocument(
    page,
    page.locator('fieldset:nth-child(3) > .Fieldset > div:nth-child(2) > .DocumentForm__documents > .DocumentForm__inputs > .Button'),
    payload['4_doc_emargement'],
    'Emargement',
    'Emargement'
  );

  console.log('✅ Step 4 complete — 2 documents facturation importés');
}