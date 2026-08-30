// helpers/router.js
import { stepFormation } from '../steps/2_formation.js';
import { stepRechercherApprenantNom } from '../steps/3_rechercher_apprenant.js';
import { stepSelectionnerApprenant } from '../steps/3_selectionner_apprenant.js';
import { stepImporterDocumentsInscription } from '../steps/4_importer_documents_inscription.js';
import { stepImporterDocumentsFacturation } from '../steps/4_importer_documents_facturation.js';
import { stepEmployeurAssocie } from '../steps/4a_employeur_associe.js';
import { stepRechercherEmployeurNom } from '../steps/4b_rechercher_employeur_nom.js';
import { stepRechercherEmployeurUrssaf } from '../steps/4c_rechercher_employeur_urssaf.js';
import { stepRemboursement } from '../steps/5_remboursement.js';

// Source de vérité : error_message.ods
// Les libellés sont destinés à l'utilisateur final. Toute trace technique
// passe par le champ `debug`, jamais par `message`.
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
    error: 'Erreur : impossible de trouver l\u2019apprenant',
  },
  '3_selectionner_apprenant.js': {
    success: 'Succès : apprenant sélectionné',
    error: 'Erreur : impossible de trouver l\u2019apprenant',
  },
  // 4a et 4b sont des étapes de repli : leur échec est normal et ne doit
  // jamais remonter à l'utilisateur (voir la chaîne dans inscrire_apprenant).
  '4a_employeur_associe.js': {
    success: 'Succès : employeur associé sélectionné',
    error: null,
  },
  '4b_rechercher_employeur_nom.js': {
    success: 'Succès : employeur trouvé par nom',
    error: null,
  },
  '4c_rechercher_employeur_urssaf.js': {
    success: 'Succès : employeur trouvé par URSSAF',
    error: 'Erreur : impossible de trouver l\u2019employeur',
  },
  '4_importer_documents_inscription.js': {
    success: 'Succès : importer les documents d\u2019inscription',
    error: 'Erreur : impossible d\u2019importer les documents d\u2019inscription',
  },
  '4_importer_documents_facturation.js': {
    success: 'Succès : importer les documents de facturation',
    error: 'Erreur : impossible d\u2019importer les documents de facturation',
  },
  '5_remboursement.js': {
    success: 'Succès : importer l\u2019apprenant',
    error: 'Erreur : impossible de compléter le remboursement',
  },
};

const DEFAULT_MESSAGES = {
  success: 'Succès',
  error: 'Erreur : le traitement a échoué',
};

/**
 * @param {string} stepName
 * @param {'success'|'error'|'skipped'} status
 * @param {string|null} debug  trace technique — logs et support uniquement,
 *                             jamais affichée à l'utilisateur
 */
export function logStepResult(stepName, status, debug = null) {
  const messages = STEP_MESSAGES[stepName] || DEFAULT_MESSAGES;
  const result = {
    step: stepName,
    status,
    status_code: status === 'error' ? 400 : 200,
    message: messages[status] ?? null,
  };
  if (debug) result.debug = debug;
  console.log(`__STEP_RESULT__${JSON.stringify(result)}`);
}

export async function runSteps(page, syncType, runStep) {
  console.log(`Sync type: ${syncType}`);

  switch (syncType) {

    case 'inscrire_apprenant': {
      if (!await runStep('2_formation.js', () => stepFormation(page))) break;
      if (!await runStep('3_rechercher_apprenant.js', () => stepRechercherApprenantNom(page))) break;

      // Chaîne de repli employeur : 4a → 4b → 4c.
      // Le court-circuit du || arrête la chaîne à la première réussite.
      // Seul 4c, dernier maillon, remonte une erreur à l'utilisateur.
      const employeurOk =
           await runStep('4a_employeur_associe.js', () => stepEmployeurAssocie(page), { silentFailure: true })
        || await runStep('4b_rechercher_employeur_nom.js', () => stepRechercherEmployeurNom(page), { silentFailure: true })
        || await runStep('4c_rechercher_employeur_urssaf.js', () => stepRechercherEmployeurUrssaf(page));
      if (!employeurOk) break;

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
