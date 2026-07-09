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
    success: 'Succes : connexion a IPERIA',
    error: 'Erreur : impossible de se connecter a IPERIA',
  },
  '2_formation.js': {
    success: 'Succes : formation trouvee',
    error: 'Erreur : impossible de trouver la formation',
  },
  '3_rechercher_apprenant.js': {
    success: 'Succes : apprenant trouve et inscrit',
    error: 'Erreur : impossible de trouver l\'apprenant',
  },
  '3_selectionner_apprenant.js': {
    success: 'Succes : apprenant selectionne',
    error: 'Erreur : impossible de trouver l\'apprenant',
  },
  '4a_employeur_associe.js': {
    success: 'Succes : employeur associe selectionne',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4b_rechercher_employeur_nom.js': {
    success: 'Succes : employeur trouve par nom',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4c_rechercher_employeur_urssaf.js': {
    success: 'Succes : employeur trouve par URSSAF',
    error: 'Erreur : impossible de trouver l\'employeur',
  },
  '4_importer_documents_inscription.js': {
    success: 'Succes : importer les documents d\'inscription',
    error: 'Erreur : impossible d\'importer les documents d\'inscription',
  },
  '4_importer_documents_facturation.js': {
    success: 'Succes : importer les documents de facturation',
    error: 'Erreur : impossible d\'importer les documents de facturation',
  },
  '5_remboursement.js': {
    success: 'Succes : Importer l\'apprenant',
    error: 'Erreur : impossible de completer le remboursement',
  },
};

export function logStepResult(stepName, status, overrideMessage = null) {
  const messages = STEP_MESSAGES[stepName] || { success: 'Succes', error: 'Erreur' };
  const result = {
    step: stepName,
    status,
    status_code: status === 'success' ? 200 : 400,
    message: overrideMessage || messages[status],
  };
  console.log(`__STEP_RESULT__${JSON.stringify(result)}`);
}

export async function runSteps(page, syncType, runStep) {
  console.log(`Sync type: ${syncType}`);

  switch (syncType) {

    case 'inscrire_apprenant': {
      if (!await runStep('2_formation.js', () => stepFormation(page))) break;
      if (!await runStep('3_rechercher_apprenant.js', () => stepRechercherApprenantNom(page))) break;
      if (!await runStep('4a_employeur_associe.js', () => stepEmployeurAssocie(page))) break;
      await runStep('5_remboursement.js', () => stepRemboursement(page));
      break;
    }

    case 'documents_inscription': {
      if (!await runStep('2_formation.js', () => stepFormation(page))) break;
      if (!await runStep('3_selectionner_apprenant.js', () => stepSelectionnerApprenant(page))) break;
      await runStep('4_importer_documents_inscription.js', () => stepImporterDocumentsInscription(page));
      break;
    }

    case 'documents_facturation': {
      if (!await runStep('2_formation.js', () => stepFormation(page))) break;
      if (!await runStep('3_selectionner_apprenant.js', () => stepSelectionnerApprenant(page))) break;
      await runStep('4_importer_documents_facturation.js', () => stepImporterDocumentsFacturation(page));
      break;
    }

    default:
      throw new Error(`Unknown sync_type: ${syncType}. Check your payload.`);
  }

  console.log(`Sync type "${syncType}" completed`);
}