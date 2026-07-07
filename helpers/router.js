// helpers/router.js
import { stepFormation } from '../steps/2_formation.js';
import { stepRechercherApprenantNom } from '../steps/3_rechercher_apprenant.js';
import { stepSelectionnerApprenant } from '../steps/3_selectionner_apprenant.js';
import { stepImporterDocumentsInscription } from '../steps/4_importer_documents_inscription.js';
import { stepImporterDocumentsFacturation } from '../steps/4_importer_documents_facturation.js';
import { stepEmployeurAssocie } from '../steps/4a_employeur_associe.js';
import { stepRemboursement } from '../steps/5_remboursement.js';

const STEP_MESSAGES = {
  '1_connection.js': {
    success: 'Succès : connexion à IPERIA',
    error: 'Erreur : impossible de se connecter à IPERIA',
  },
  '2_formation.js': {
    success: 'Succès : formation trouvée',
    error: 'Erreur : impossible de trouver la formation',
  },
  '3_rechercher_apprenant.js': {
    success: 'Succès : apprenant trouvé et inscrit',
    error: 'Erreur : impossible de trouver l\'apprenant',
  },
  '3_selectionner_apprenant.js': {
    success: 'Succès : apprenant sélectionné',
    error: 'Erreur : impossible de trouver l\'apprenant',
  },
  '4a_employeur_associe.js': {
    success: 'Succès : employeur associé sélectionné',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4b_rechercher_employeur_nom.js': {
    success: 'Succès : employeur trouvé par nom',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4c_rechercher_employeur_urssaf.js': {
    success: 'Succès : employeur trouvé par URSSAF',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4_importer_documents_inscription.js': {
    success: 'Succès : importer les documents d\'inscription',
    error: 'Erreur : impossible d\'importer les documents d\'inscription',
  },
  '4_importer_documents_facturation.js': {
    success: 'Succès : importer les documents de facturation',
    error: 'Erreur : impossible d\'importer les documents de facturation',
  },
  '5_remboursement.js': {
    success: 'Succès : Importer l\'apprenant',
    error: 'Erreur : impossible de compléter le remboursement',
  },
};

export function logStepResult(stepName, status, overrideMessage = null) {
  const messages = STEP_MESSAGES[stepName] || { success: 'Succès', error: 'Erreur' };
  const result = {
    step: stepName,
    status,
    status_code: status === 'success' ? 200 : 400,
    message: overrideMessage || messages[status],
  };
  console.log(`__STEP_RESULT__${JSON.stringify(result)}`);
}

export async function runSteps(page, syncType, runStep) {
  console.log(`▶️  Sync type: ${syncType}`);

  switch (syncType) {

    case 'inscrire_apprenant':
      await runStep('2_formation.js', () => stepFormation(page));
      await runStep('3_rechercher_apprenant.js', () => stepRechercherApprenantNom(page));
      await runStep('4a_employeur_associe.js', () => stepEmployeurAssocie(page));
      await runStep('5_remboursement.js', () => stepRemboursement(page));
      break;

    case 'documents_inscription':
      await runStep('2_formation.js', () => stepFormation(page));
      await runStep('3_selectionner_apprenant.js', () => stepSelectionnerApprenant(page));
      await runStep('4_importer_documents_inscription.js', () => stepImporterDocumentsInscription(page));
      break;

    case 'documents_facturation':
      await runStep('2_formation.js', () => stepFormation(page));
      await runStep('3_selectionner_apprenant.js', () => stepSelectionnerApprenant(page));
      await runStep('4_importer_documents_facturation.js', () => stepImporterDocumentsFacturation(page));
      break;

    default:
      throw new Error(`Unknown sync_type: ${syncType}. Check your payload.`);
  }

  console.log(`✅ Sync type "${syncType}" completed`);
}
