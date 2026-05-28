// steps/6_importer_documents.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause, randomDelay } from '../helpers/human.js';

async function verifierErreurPage(page) {
  const erreur = await page.getByText('CLIENT_ERROR').isVisible().catch(() => false);
  if (erreur) {
    throw new Error('Erreur application CLIENT_ERROR détectée — le serveur a retourné une erreur inattendue');
  }
}

async function importerDocument(page, cheminFichier, nomFichier, label, isLast = false) {
  console.log(`▶️  Import: ${label}...`);

  // Always click the first available button — list reindexes after each import
  await humanClick(page, page.getByRole('button', { name: '+ Importer un document' }).first());

  // Wait for the modal to appear
  await page.getByRole('heading', { name: 'Importer un document' }).waitFor({ state: 'visible', timeout: 10000 });
  await readingPause(page);

  // Fill the file name field
  await humanClick(page, page.getByLabel('NOM DU FICHIER'));
  await page.getByLabel('NOM DU FICHIER').fill(nomFichier);
  await readingPause(page);

  // Click the drag-and-drop zone to trigger the file chooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('div').filter({
      hasText: /^Glissez-déposez un fichier ici, ou cliquez pour en sélectionner un$/
    }).first().click(),
  ]);

  // Upload the file
  await fileChooser.setFiles(cheminFichier);
  await readingPause(page);

  // Click Créer to confirm
  await humanClick(page, page.getByRole('button', { name: 'Créer' }));

  // Wait for upload to complete
  console.log(`⏳ Attente traitement upload: ${label}...`);
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await verifierErreurPage(page);

  if (!isLast) {
    // Wait for the next import button to be visible before continuing
    // This is more reliable than a fixed timer
    console.log(`⏳ Attente disponibilité prochain bouton...`);
    await page.getByRole('button', { name: '+ Importer un document' })
      .first()
      .waitFor({ state: 'visible', timeout: 60000 });
    // Small natural pause after button appears
    await randomDelay(page, 1500, 3000);
  }

  console.log(`✅ ${label} importé`);
}

export async function stepImporterDocuments(page) {
  const payload = getPayload();
  console.log('▶️  Step 6: Import des documents...');

  await importerDocument(
    page,
    payload['doc_bulletin_inscription'],
    'Bulletin d\'inscription',
    'Bulletin d\'inscription'
  );

  await importerDocument(
    page,
    payload['doc_bulletin_salaire'],
    'Bulletin de salaire',
    'Bulletin de salaire'
  );

  await importerDocument(
    page,
    payload['doc_piece_identite'],
    'Pièce d\'identité salarié',
    'Pièce d\'identité salarié'
  );

  await importerDocument(
    page,
    payload['doc_rib'],
    'RIB salarié',
    'RIB salarié',
    true  // ← last document, skip waiting for next button
  );

  console.log('✅ Step 6 complete — 4 documents importés');
}