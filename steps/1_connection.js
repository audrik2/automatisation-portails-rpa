// steps/1_connection.js
import { config } from '../config.js';
import { humanType, humanClick, readingPause } from '../helpers/human.js';

export async function login(page) {
  console.log('🔐 Logging in...');

  await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
  await readingPause(page); // pause to "read" the login page

  await humanType(page, '[placeholder="Nom de l\'utilisateur"]', config.username);
  await humanType(page, '[placeholder="Mot de passe"]', config.password);
  await humanClick(page, page.getByRole('button', { name: 'Se connecter' }));

  await page.waitForURL('https://administratif.iperia.eu/', { timeout: config.timeout });

  console.log('✅ Connecté avec succès');
}