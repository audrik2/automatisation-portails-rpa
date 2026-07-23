// steps/2_formation.js
import { getPayload } from '../helpers/payload.js';
import { humanClick, readingPause } from '../helpers/human.js';

export async function stepFormation(page) {
  const payload = getPayload();
  console.log('Step 2: Navigation vers la formation:', payload['2_num_action']);

  // Open side menu and navigate to Formations
  await humanClick(page, page.getByRole('button').filter({ hasText: /^$/ }));
  await humanClick(page, page.getByText('Formations', { exact: true }));
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Select Parcours module
  await humanClick(page, page.getByRole('button', { name: 'Parcours module (PLAN)' }));
  await readingPause(page);

  // Search for the action number from the payload
  await humanClick(page, page.getByRole('textbox', { name: 'Rechercher...' }));
  await page.getByRole('textbox', { name: 'Rechercher...' }).fill(payload['2_num_action']);
  await humanClick(page, page.getByRole('main').getByRole('button').filter({ hasText: /^$/ }));

  // Wait for search results
  await page.waitForLoadState('networkidle');
  await readingPause(page);

  // Open the detail page — two possible selectors depending on context
  const voirDetail = page.getByRole('link', { name: ' Voir détail' });
  const voirFiche = page.getByRole('link', { name: 'Voir la fiche de ce parcours' });

  const outcome = await Promise.race([
    voirDetail.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'detail'),
    voirFiche.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'fiche'),
  ]);

  if (outcome === 'detail') {
    await humanClick(page, voirDetail);
  } else {
    await humanClick(page, voirFiche);
  }

  await page.waitForLoadState('networkidle');

  console.log('Step 2 complete');
}