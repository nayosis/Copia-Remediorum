import { creerApp } from "./app";
import { ouvrirBase, verrouillerDossier } from "./base";
import { installerSuperAdmin, ouvrirComptes } from "./comptes";
import { BASE_COMPTES, BASE_DONNEES, DOSSIER_DONNEES, DOSSIER_MIGRATIONS, FUSEAU, PORT, preparerDossiers } from "./config";
import { planifierSauvegardes } from "./sauvegardeAuto";
import { planifierNotifications } from "./push";
import { notificationsDuJour } from "./modele";
import { definirFuseau } from "../src/lib/dates";

definirFuseau(FUSEAU);
preparerDossiers();
verrouillerDossier(DOSSIER_DONNEES);
const { appliquees } = ouvrirBase(BASE_DONNEES, DOSSIER_MIGRATIONS);
if (appliquees.length) console.log(`Migrations appliquées : ${appliquees.join(", ")}`);

ouvrirComptes(BASE_COMPTES);
await installerSuperAdmin(process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_MOT_DE_PASSE);

creerApp().listen(PORT);
console.log(`Copia Remediorum : http://localhost:${PORT} (données : ${DOSSIER_DONNEES})`);

// Sauvegarde complète chaque nuit dans data/sauvegardes.
planifierSauvegardes();

// Notifications sur téléphone (Web Push), une fois par jour.
planifierNotifications(notificationsDuJour);
