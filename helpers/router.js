// helpers/router.js
import { stepFormation } from '../steps/2_formation.js';

// inscrire_apprenant
import { stepRechercherApprenantNom } from '../steps/3_rechercher_apprenant.js';
import { stepEmployeurAssocie } from '../steps/4a_employeur_associe.js';
import { stepRemboursement } from '../steps/5_remboursement.js';

// documents_inscription / documents_facturation
import { stepSelectionnerApprenant } from '../steps/3_selectionner_apprenant.js';
import { stepImporterDocumentsInscription } from '../steps/4_importer_documents_inscription.js';
import { stepImporterDocumentsFacturation } from '../steps/4_importer_documents_facturation.js';

export async function runSteps(page, syncType) {
  console.log(`▶️  Sync type: ${syncType}`);

  switch (syncType) {

    case 'inscrire_apprenant':
      await stepFormation(page);
      await stepRechercherApprenantNom(page);
      // 4a checks for an already-associated employeur first,
      // falls back to 4b (nom) then 4c (URSSAF) internally if none found
      await stepEmployeurAssocie(page);
      await stepRemboursement(page);
      break;

    case 'documents_inscription':
      await stepFormation(page);
      await stepSelectionnerApprenant(page);
      await stepImporterDocumentsInscription(page);
      break;

    case 'documents_facturation':
      await stepFormation(page);
      await stepSelectionnerApprenant(page);
      await stepImporterDocumentsFacturation(page);
      break;

    default:
      throw new Error(`Unknown sync_type: ${syncType}. Check your payload.`);
  }

  console.log(`✅ Sync type "${syncType}" completed`);
}