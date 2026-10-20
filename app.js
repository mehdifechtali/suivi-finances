// =========================================================
// 1. NAVIGATION ENTRE LES PAGES (brique 2)
// =========================================================

const onglets = document.querySelectorAll(".onglet");
const pages = document.querySelectorAll(".page");

function afficherPage(nom) {
  pages.forEach(function (page) {
    page.hidden = page.id !== nom;
  });
  onglets.forEach(function (onglet) {
    onglet.classList.toggle("actif", onglet.dataset.page === nom);
  });
  window.scrollTo(0, 0);
}

onglets.forEach(function (onglet) {
  onglet.addEventListener("click", function () {
    afficherPage(onglet.dataset.page);
  });
});


// =========================================================
// 2. LES DONNÉES (brique 3)
// Toutes les recettes et dépenses sont rangées dans un seul
// tableau. Chaque élément ressemble à ceci :
// {
//   id: "1729420000000",     identifiant unique
//   type: "recette",         "recette" ou "depense"
//   libelle: "Salaire McDo",
//   montant: 950,
//   categorie: "Salaire",
//   date: "2026-10-05",      format AAAA-MM-JJ
//   frequence: "mensuel"     "ponctuel" ou "mensuel"
// }
// =========================================================

let mouvements = [];

// Les dettes (brique 5). Chaque dette ressemble à ceci :
// {
//   id: "1729420000000",
//   libelle: "Prêt étudiant",
//   restant: 4200,          capital restant dû au départ
//   mensualite: 150,
//   taux: 1.2,              taux annuel en %
//   debut: "2026-11-05"     date de la prochaine mensualité
// }
let dettes = [];

// Les projets (brique 6). Chaque projet ressemble à ceci :
// {
//   id: "1729420000000",
//   libelle: "Voiture",
//   cout: 9000,               prix total
//   epargne: 500,             déjà mis de côté
//   date: "2027-09",          mois visé (AAAA-MM)
//   financement: "credit",    "epargne" ou "credit"
//   apport: 2000,             (crédit) ce que je paie moi-même
//   taux: 4.5,                (crédit) taux annuel en %
//   duree: 48                 (crédit) durée en mois
// }
let projets = [];

// Les réglages de la prévision (brique 7).
let parametres = { soldeDepart: 0, horizon: 12 };


// =========================================================
// 2 bis. LA MÉMOIRE (brique 4)
// Le navigateur a un petit espace de stockage appelé
// "localStorage". On y range nos données sous forme de texte,
// avec un nom (la "clé") pour les retrouver.
// =========================================================

const CLE_STOCKAGE = "suivi-finances";

// Rassemble toutes les données dans un seul objet.
// (Utilisé pour la mémoire et pour l'export.)
function toutesLesDonnees() {
  return { version: 4, mouvements: mouvements, dettes: dettes, projets: projets, parametres: parametres };
}

// Écrit les données dans la mémoire du navigateur.
function enregistrer() {
  const donnees = toutesLesDonnees();
  try {
    // JSON.stringify transforme notre tableau en texte.
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (erreur) {
    // Arrive par exemple en navigation privée : l'app marche, mais sans mémoire.
    console.warn("Impossible d'enregistrer :", erreur);
  }
}

// Relit les données au démarrage de l'app.
function charger() {
  try {
    const texte = localStorage.getItem(CLE_STOCKAGE);
    if (texte) {
      // JSON.parse fait l'inverse : il retransforme le texte en tableau.
      const donnees = JSON.parse(texte);
      if (Array.isArray(donnees.mouvements)) {
        mouvements = donnees.mouvements;
      }
      // Les anciennes sauvegardes (version 1) n'ont pas encore de dettes.
      if (Array.isArray(donnees.dettes)) {
        dettes = donnees.dettes;
      }
      // Pareil pour les projets, apparus en version 3.
      if (Array.isArray(donnees.projets)) {
        projets = donnees.projets;
      }
      // Et les réglages de la prévision, apparus en version 4.
      if (donnees.parametres) {
        parametres = donnees.parametres;
      }
    }
  } catch (erreur) {
    console.warn("Impossible de relire les données :", erreur);
  }
}

// Demande au navigateur de ne pas effacer nos données s'il manque de place.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}


// =========================================================
// 3. DES PETITS OUTILS
// =========================================================

// Transforme 1234.5 en "1 234,50 €".
function formaterEuros(nombre) {
  return nombre.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Transforme "2026-10-05" en "5 oct. 2026".
function formaterDate(texte) {
  const date = new Date(texte + "T00:00:00");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// Renvoie "2026-10" pour la date du jour : l'année et le mois en cours.
function moisActuel() {
  const aujourdhui = new Date();
  const mois = String(aujourdhui.getMonth() + 1).padStart(2, "0");
  return aujourdhui.getFullYear() + "-" + mois;
}

// Est-ce que ce mouvement compte pour un mois donné (ex. "2026-10") ?
// - ponctuel : oui seulement si sa date tombe dans ce mois ;
// - mensuel : oui pour son mois de départ et tous les mois suivants.
function comptePourLeMois(mouvement, mois) {
  const moisDuMouvement = mouvement.date.slice(0, 7); // "2026-10-05" → "2026-10"
  if (mouvement.frequence === "mensuel") {
    return moisDuMouvement <= mois;
  }
  return moisDuMouvement === mois;
}

// Additionne les montants d'un type ("recette" ou "depense") pour un mois.
function totalDuMois(type, mois) {
  let total = 0;
  mouvements.forEach(function (m) {
    if (m.type === type && comptePourLeMois(m, mois)) {
      total = total + m.montant;
    }
  });
  return total;
}

// Ajoute (ou retire) des mois à "2026-10" : moisPlus("2026-10", 3) → "2027-01".
function moisPlus(mois, nombre) {
  const annee = Number(mois.slice(0, 4));
  const numero = Number(mois.slice(5, 7)) - 1 + nombre; // de 0 à 11, peut déborder
  const date = new Date(annee, numero, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

// Transforme "2026-10" en "oct. 2026".
function formaterMois(mois) {
  const date = new Date(mois + "-01T00:00:00");
  return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

// Arrondit au centime : 12.3456 → 12.35.
function arrondir(nombre) {
  return Math.round(nombre * 100) / 100;
}


// =========================================================
// 3 bis. LE CALCUL DES DETTES (brique 5)
// C'est le même calcul qu'une banque : chaque mois,
//   intérêts du mois = capital restant × taux annuel ÷ 12
//   part de capital  = mensualité − intérêts
//   nouveau restant  = restant − part de capital
// On répète jusqu'à ce que le restant arrive à zéro.
// =========================================================

// Renvoie la liste des mensualités d'une dette, mois par mois.
// Chaque ligne : { mois, paiement, interets, capital, restant }
function echeancier(dette) {
  const tauxMensuel = dette.taux / 100 / 12;
  let restant = dette.restant;
  let mois = dette.debut.slice(0, 7);
  const lignes = [];

  // Sécurité : si la mensualité ne couvre même pas les intérêts,
  // la dette ne se rembourse jamais. On s'arrête à 50 ans.
  while (restant > 0.005 && lignes.length < 600) {
    const interets = arrondir(restant * tauxMensuel);
    // La dernière mensualité est plus petite : juste ce qui reste.
    const paiement = Math.min(dette.mensualite, arrondir(restant + interets));
    const capital = arrondir(paiement - interets);
    restant = arrondir(restant - capital);

    lignes.push({ mois: mois, paiement: paiement, interets: interets, capital: capital, restant: restant });
    mois = moisPlus(mois, 1);
  }
  return lignes;
}

// La mensualité d'une dette ne couvre-t-elle pas les intérêts du premier mois ?
function detteSansFin(dette) {
  return dette.mensualite <= dette.restant * (dette.taux / 100 / 12);
}

// Combien reste-t-il à rembourser au début d'un mois donné ?
function restantAuDebutDu(dette, mois) {
  let restant = dette.restant;
  echeancier(dette).forEach(function (ligne) {
    if (ligne.mois < mois) restant = ligne.restant;
  });
  return restant;
}

// Total des mensualités de toutes les dettes pour un mois donné.
function mensualitesDuMois(mois) {
  let total = 0;
  dettes.forEach(function (dette) {
    echeancier(dette).forEach(function (ligne) {
      if (ligne.mois === mois) total = total + ligne.paiement;
    });
  });
  return total;
}


// =========================================================
// 3 ter. LE CALCUL DES PROJETS (brique 6)
// =========================================================

// Nombre de mois entre deux mois : ecartMois("2026-10", "2027-01") → 3.
function ecartMois(debut, fin) {
  const annees = Number(fin.slice(0, 4)) - Number(debut.slice(0, 4));
  const mois = Number(fin.slice(5, 7)) - Number(debut.slice(5, 7));
  return annees * 12 + mois;
}

// La mensualité d'un crédit, avec la formule utilisée par les banques :
//   mensualité = montant × t ÷ (1 − (1 + t) ^ −durée)
// où t est le taux mensuel. Sans intérêts, c'est simplement montant ÷ durée.
function mensualiteCredit(montant, tauxAnnuel, duree) {
  if (montant <= 0) return 0;
  const t = tauxAnnuel / 100 / 12;
  if (t === 0) return arrondir(montant / duree);
  return arrondir(montant * t / (1 - Math.pow(1 + t, -duree)));
}

// Tous les chiffres d'un projet, calculés à partir de ce qu'on a saisi.
function calculerProjet(projet) {
  const credit = projet.financement === "credit";

  // Ce que je dois réunir moi-même : tout le prix, ou seulement l'apport.
  const objectifEpargne = credit ? Math.min(projet.apport, projet.cout) : projet.cout;
  const resteAEpargner = Math.max(0, objectifEpargne - projet.epargne);

  // On épargne du mois actuel jusqu'au mois qui précède la date visée.
  // Si la date est ce mois-ci (ou déjà passée), il reste 1 mois : c'est urgent.
  const moisRestants = Math.max(1, ecartMois(moisActuel(), projet.date));
  const epargneMensuelle = arrondir(resteAEpargner / moisRestants);

  const emprunt = credit ? Math.max(0, projet.cout - projet.apport) : 0;

  return {
    objectifEpargne: objectifEpargne,
    resteAEpargner: resteAEpargner,
    moisRestants: moisRestants,
    epargneMensuelle: epargneMensuelle,
    urgent: ecartMois(moisActuel(), projet.date) <= 0 && resteAEpargner > 0,
    emprunt: emprunt,
    mensualite: credit ? mensualiteCredit(emprunt, projet.taux, projet.duree) : 0,
    coutCredit: credit ? arrondir(mensualiteCredit(emprunt, projet.taux, projet.duree) * projet.duree - emprunt) : 0
  };
}

// Total à mettre de côté pour tous les projets, pour un mois donné.
// Un projet demande de l'épargne pendant ses "moisRestants",
// à partir du mois actuel. Ex. 3 mois restants → ce mois-ci et les 2 suivants.
function epargneProjetsDuMois(mois) {
  let total = 0;
  projets.forEach(function (projet) {
    const calcul = calculerProjet(projet);
    const position = ecartMois(moisActuel(), mois); // 0 = ce mois-ci, 1 = le suivant…
    if (position >= 0 && position < calcul.moisRestants) {
      total = total + calcul.epargneMensuelle;
    }
  });
  return arrondir(total);
}

// Les mensualités des crédits PRÉVUS dans les projets (pas encore signés).
// Elles commencent le mois qui suit la date du projet.
function creditsPrevusDuMois(mois) {
  let total = 0;
  projets.forEach(function (projet) {
    if (projet.financement !== "credit") return;
    const debut = moisPlus(projet.date, 1);
    const position = ecartMois(debut, mois);
    if (position >= 0 && position < projet.duree) {
      total = total + calculerProjet(projet).mensualite;
    }
  });
  return arrondir(total);
}


// =========================================================
// 3 quater. LA PRÉVISION (brique 7)
// On part du solde de départ et on avance mois par mois.
// Le solde de fin d'un mois devient le solde de début du suivant.
// =========================================================

function calculerPrevision(soldeDepart, horizon) {
  const lignes = [];
  let solde = soldeDepart;

  for (let i = 0; i < horizon; i++) {
    const mois = moisPlus(moisActuel(), i);

    const recettes = totalDuMois("recette", mois);
    const depenses = totalDuMois("depense", mois);
    const remboursements = arrondir(mensualitesDuMois(mois) + creditsPrevusDuMois(mois));
    const epargne = epargneProjetsDuMois(mois);

    solde = arrondir(solde + recettes - depenses - remboursements - epargne);

    lignes.push({
      mois: mois,
      recettes: recettes,
      depenses: depenses,
      remboursements: remboursements,
      epargne: epargne,
      solde: solde
    });
  }
  return lignes;
}


// =========================================================
// 4. AJOUTER UN MOUVEMENT (quand on valide un formulaire)
// =========================================================

// Seulement les formulaires qui ont un data-type (recette ou dépense).
const formulaires = document.querySelectorAll(".formulaire[data-type]");

formulaires.forEach(function (formulaire) {
  // Date du jour proposée par défaut dans le champ Date.
  formulaire.elements.date.value = new Date().toISOString().slice(0, 10);

  formulaire.addEventListener("submit", function (evenement) {
    // Empêche la page de se recharger (comportement par défaut d'un formulaire).
    evenement.preventDefault();

    const champs = formulaire.elements;
    const nouveau = {
      id: String(Date.now()),
      type: formulaire.dataset.type,
      libelle: champs.libelle.value.trim(),
      montant: Number(champs.montant.value),
      categorie: champs.categorie.value,
      date: champs.date.value,
      frequence: champs.frequence.value
    };

    mouvements.push(nouveau);
    enregistrer();

    // On vide le libellé et le montant pour la saisie suivante,
    // et on remet le curseur dans le premier champ.
    champs.libelle.value = "";
    champs.montant.value = "";
    champs.libelle.focus();

    toutAfficher();
  });
});


// =========================================================
// 5. SUPPRIMER UN MOUVEMENT
// =========================================================

function supprimer(id) {
  // On garde tous les mouvements SAUF celui qui a cet id.
  mouvements = mouvements.filter(function (m) {
    return m.id !== id;
  });
  enregistrer();
  toutAfficher();
}


// =========================================================
// 6. AFFICHER (on redessine tout à chaque changement)
// =========================================================

// Remplit la liste d'un type ("recette" ou "depense").
function afficherListe(type) {
  const liste = document.getElementById("liste-" + type);
  liste.innerHTML = ""; // on vide la liste avant de la remplir

  // Les plus récents en premier.
  const lignes = mouvements
    .filter(function (m) { return m.type === type; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });

  lignes.forEach(function (m) {
    const li = document.createElement("li");
    li.className = "ligne";

    // La partie gauche : libellé + catégorie et date.
    const info = document.createElement("div");
    info.className = "ligne-info";

    const libelle = document.createElement("p");
    libelle.className = "ligne-libelle";
    libelle.textContent = m.libelle;
    if (m.frequence === "mensuel") {
      const pastille = document.createElement("span");
      pastille.className = "pastille";
      pastille.textContent = "Tous les mois";
      libelle.appendChild(pastille);
    }

    const details = document.createElement("p");
    details.className = "ligne-details";
    details.textContent = m.categorie + " · " + formaterDate(m.date);

    info.append(libelle, details);

    // Le montant, avec + ou − devant.
    const montant = document.createElement("span");
    const signe = type === "recette" ? "+ " : "− ";
    montant.className = "ligne-montant " + (type === "recette" ? "positif" : "negatif");
    montant.textContent = signe + formaterEuros(m.montant);

    // Le bouton de suppression.
    const bouton = document.createElement("button");
    bouton.className = "supprimer";
    bouton.type = "button";
    bouton.textContent = "×";
    bouton.setAttribute("aria-label", "Supprimer " + m.libelle);
    bouton.addEventListener("click", function () {
      supprimer(m.id);
    });

    li.append(info, montant, bouton);
    liste.appendChild(li);
  });

  // Le total du mois en cours, à droite du titre.
  document.getElementById("total-" + type).textContent =
    "Ce mois-ci : " + formaterEuros(totalDuMois(type, moisActuel()));
}

// Met à jour les tuiles de la page Aperçu.
function afficherApercu() {
  const mois = moisActuel();
  const recettes = totalDuMois("recette", mois);
  const mensualites = mensualitesDuMois(mois);
  // Les mensualités des dettes comptent comme des dépenses.
  const depenses = totalDuMois("depense", mois) + mensualites;
  const solde = recettes - depenses;

  // Le nom du mois en haut : "Octobre 2026".
  const nomDuMois = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  document.getElementById("mois-courant").textContent = nomDuMois;

  document.getElementById("apercu-recettes").textContent = formaterEuros(recettes);
  document.getElementById("apercu-depenses").textContent = formaterEuros(depenses);
  document.getElementById("apercu-depenses-note").textContent =
    mensualites > 0 ? "dont " + formaterEuros(mensualites) + " de remboursements" : "";

  // Le total restant dû sur toutes les dettes, au début de ce mois.
  let resteDettes = 0;
  dettes.forEach(function (dette) {
    resteDettes = resteDettes + restantAuDebutDu(dette, mois);
  });
  document.getElementById("apercu-dettes").textContent = formaterEuros(resteDettes);

  // L'épargne à prévoir ce mois-ci pour les projets.
  const epargneProjets = epargneProjetsDuMois(mois);
  document.getElementById("apercu-projets").textContent = formaterEuros(epargneProjets);
  document.getElementById("apercu-projets-note").textContent =
    projets.length > 0
      ? "Reste après épargne : " + formaterEuros(solde - epargneProjets)
      : "";

  const caseSolde = document.getElementById("apercu-solde");
  caseSolde.textContent = formaterEuros(solde);
  caseSolde.classList.toggle("positif", solde > 0);
  caseSolde.classList.toggle("negatif", solde < 0);

  // Le message d'attente disparaît dès qu'il y a une donnée.
  const aDesDonnees = mouvements.length > 0 || dettes.length > 0 || projets.length > 0;
  document.getElementById("apercu-vide").hidden = aDesDonnees;
  document.getElementById("apercu-blocs").hidden = !aDesDonnees;
  if (!aDesDonnees) return;

  // --- Bloc 1 : où va ton argent ce mois-ci (brique 8) ---
  // On additionne les dépenses du mois par catégorie.
  const parCategorie = {};
  mouvements.forEach(function (m) {
    if (m.type === "depense" && comptePourLeMois(m, mois)) {
      parCategorie[m.categorie] = (parCategorie[m.categorie] || 0) + m.montant;
    }
  });
  if (mensualites > 0) parCategorie["Remboursements"] = mensualites;

  // On trie de la plus grosse à la plus petite.
  const categories = Object.keys(parCategorie).sort(function (a, b) {
    return parCategorie[b] - parCategorie[a];
  });

  const repartition = document.getElementById("apercu-repartition");
  repartition.innerHTML = "";
  categories.forEach(function (nom) {
    const montant = parCategorie[nom];
    const part = depenses > 0 ? (montant / depenses) * 100 : 0;

    const li = creer("li");
    const ligne = creer("div", "repartition-ligne");
    ligne.append(
      creer("span", "", nom),
      creer("span", "", formaterEuros(montant) + " · " + Math.round(part) + " %")
    );
    const barre = creer("div", "barre");
    const remplie = creer("div", "barre-remplie depense");
    remplie.style.width = part + "%";
    barre.appendChild(remplie);

    li.append(ligne, barre);
    repartition.appendChild(li);
  });
  document.getElementById("apercu-repartition-vide").hidden = categories.length > 0;

  // --- Bloc 2 : la trajectoire (on réutilise la prévision) ---
  const lignes = calculerPrevision(parametres.soldeDepart, parametres.horizon);
  ecrireVerdict(lignes, "apercu-verdict");
  dessinerGraphique(lignes, "apercu-graphique");

  // --- Bloc 3 : les projets ---
  document.getElementById("apercu-bloc-projets").hidden = projets.length === 0;
  const listeProjets = document.getElementById("apercu-projets-liste");
  listeProjets.innerHTML = "";
  projets.forEach(function (projet) {
    const calcul = calculerProjet(projet);
    const part = calcul.objectifEpargne > 0 ? (projet.epargne / calcul.objectifEpargne) * 100 : 100;

    const li = creer("li");
    const ligne = creer("div", "repartition-ligne");
    ligne.append(
      creer("span", "", projet.libelle + " · " + formaterMois(projet.date)),
      creer("span", "", Math.round(Math.min(100, part)) + " %")
    );
    const barre = creer("div", "barre");
    const remplie = creer("div", "barre-remplie accent");
    remplie.style.width = Math.max(0, Math.min(100, part)) + "%";
    barre.appendChild(remplie);

    li.append(ligne, barre);
    listeProjets.appendChild(li);
  });
}

// Les boutons "Voir le détail" et "Gérer" de l'Aperçu ouvrent l'onglet indiqué.
document.querySelectorAll("[data-aller]").forEach(function (bouton) {
  bouton.addEventListener("click", function () {
    afficherPage(bouton.dataset.aller);
  });
});

function toutAfficher() {
  afficherListe("recette");
  afficherListe("depense");
  afficherDettes();
  afficherProjets();
  afficherPrevision();
  afficherApercu();
}


// =========================================================
// 6 bis. LES DETTES : AJOUTER, SUPPRIMER, AFFICHER (brique 5)
// =========================================================

const formulaireDette = document.getElementById("formulaire-dette");
const erreurDette = document.getElementById("dette-erreur");

// Par défaut, la prochaine mensualité est le 5 du mois prochain.
formulaireDette.elements.debut.value = moisPlus(moisActuel(), 1) + "-05";

formulaireDette.addEventListener("submit", function (evenement) {
  evenement.preventDefault();
  const champs = formulaireDette.elements;

  const nouvelle = {
    id: String(Date.now()),
    libelle: champs.libelle.value.trim(),
    restant: Number(champs.restant.value),
    mensualite: Number(champs.mensualite.value),
    taux: Number(champs.taux.value) || 0,
    debut: champs.debut.value
  };

  // On refuse une dette qui ne se rembourserait jamais.
  if (detteSansFin(nouvelle)) {
    const interets = nouvelle.restant * nouvelle.taux / 100 / 12;
    erreurDette.textContent =
      "Avec ce taux, les intérêts du premier mois sont de " + formaterEuros(interets) +
      ". La mensualité doit être plus élevée, sinon la dette ne diminue jamais.";
    return;
  }
  erreurDette.textContent = "";

  dettes.push(nouvelle);
  enregistrer();

  champs.libelle.value = "";
  champs.restant.value = "";
  champs.mensualite.value = "";
  champs.taux.value = "0";
  champs.libelle.focus();

  toutAfficher();
});

function supprimerDette(id) {
  dettes = dettes.filter(function (d) { return d.id !== id; });
  enregistrer();
  toutAfficher();
}

// Petit raccourci pour créer un élément HTML avec une classe et un texte.
function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) element.textContent = texte;
  return element;
}

function afficherDettes() {
  const conteneur = document.getElementById("liste-dettes");
  conteneur.innerHTML = "";
  const mois = moisActuel();
  let totalRestant = 0;

  dettes.forEach(function (dette) {
    const lignes = echeancier(dette);
    const restant = restantAuDebutDu(dette, mois);
    totalRestant = totalRestant + restant;

    // Les chiffres clés, calculés à partir de l'échéancier.
    const derniere = lignes[lignes.length - 1];
    const lignesRestantes = lignes.filter(function (l) { return l.mois >= mois; });
    let interetsRestants = 0;
    lignesRestantes.forEach(function (l) { interetsRestants = interetsRestants + l.interets; });
    const dejaRembourse = dette.restant - restant;
    const pourcentage = dette.restant > 0 ? (dejaRembourse / dette.restant) * 100 : 100;

    // --- La carte ---
    const carte = creer("article", "dette");

    // Le haut : titre + bouton supprimer.
    const haut = creer("div", "dette-haut");
    const titres = creer("div");
    titres.append(
      creer("p", "dette-titre", dette.libelle),
      creer("p", "dette-sous-titre",
        formaterEuros(dette.mensualite) + " par mois · taux " +
        dette.taux.toLocaleString("fr-FR") + " %")
    );
    const bouton = creer("button", "supprimer", "×");
    bouton.type = "button";
    bouton.setAttribute("aria-label", "Supprimer " + dette.libelle);
    bouton.addEventListener("click", function () { supprimerDette(dette.id); });
    haut.append(titres, bouton);

    // La barre de progression.
    const barre = creer("div", "barre");
    const remplie = creer("div", "barre-remplie");
    remplie.style.width = Math.max(0, Math.min(100, pourcentage)) + "%";
    barre.appendChild(remplie);

    // Les 4 chiffres clés.
    const chiffres = creer("dl", "dette-chiffres");
    function ajouterChiffre(etiquette, valeur) {
      const bloc = creer("div");
      bloc.append(creer("dt", "", etiquette), creer("dd", "", valeur));
      chiffres.appendChild(bloc);
    }
    ajouterChiffre("Reste à rembourser", formaterEuros(restant));
    ajouterChiffre("Mensualités restantes", String(lignesRestantes.length));
    ajouterChiffre("Fin du remboursement", derniere ? formaterMois(derniere.mois) : "—");
    ajouterChiffre("Intérêts restants", formaterEuros(interetsRestants));

    // L'échéancier complet, dépliable.
    const details = creer("details");
    details.appendChild(creer("summary", "", "Voir l'échéancier mois par mois"));
    const tableauConteneur = creer("div", "tableau-conteneur");
    const tableau = creer("table");
    tableau.innerHTML =
      "<thead><tr><th>Mois</th><th>Mensualité</th><th>Intérêts</th><th>Capital</th><th>Restant</th></tr></thead>";
    const corps = creer("tbody");
    lignes.forEach(function (l) {
      const tr = creer("tr");
      tr.append(
        creer("td", "", formaterMois(l.mois)),
        creer("td", "", formaterEuros(l.paiement)),
        creer("td", "", formaterEuros(l.interets)),
        creer("td", "", formaterEuros(l.capital)),
        creer("td", "", formaterEuros(l.restant))
      );
      corps.appendChild(tr);
    });
    tableau.appendChild(corps);
    tableauConteneur.appendChild(tableau);
    details.appendChild(tableauConteneur);

    carte.append(haut, barre, chiffres, details);
    conteneur.appendChild(carte);
  });

  document.getElementById("total-dettes").textContent =
    "Total : " + formaterEuros(totalRestant);
}


// =========================================================
// 6 ter. LES PROJETS : AJOUTER, METTRE À JOUR, AFFICHER (brique 6)
// =========================================================

const formulaireProjet = document.getElementById("formulaire-projet");
const erreurProjet = document.getElementById("projet-erreur");
const champsCredit = document.querySelectorAll(".champ-credit");

// Par défaut, le projet est prévu dans 6 mois.
formulaireProjet.elements.date.value = moisPlus(moisActuel(), 6);

// Affiche ou cache les champs du crédit selon le financement choisi.
formulaireProjet.elements.financement.addEventListener("change", function () {
  const credit = formulaireProjet.elements.financement.value === "credit";
  champsCredit.forEach(function (champ) { champ.hidden = !credit; });
});

formulaireProjet.addEventListener("submit", function (evenement) {
  evenement.preventDefault();
  const champs = formulaireProjet.elements;

  const nouveau = {
    id: String(Date.now()),
    libelle: champs.libelle.value.trim(),
    cout: Number(champs.cout.value),
    epargne: Number(champs.epargne.value) || 0,
    date: champs.date.value,
    financement: champs.financement.value,
    apport: Number(champs.apport.value) || 0,
    taux: Number(champs.taux.value) || 0,
    duree: Number(champs.duree.value) || 1
  };

  if (nouveau.financement === "credit" && nouveau.apport >= nouveau.cout) {
    erreurProjet.textContent =
      "L'apport couvre tout le prix : choisis plutôt « Épargne uniquement ».";
    return;
  }
  erreurProjet.textContent = "";

  projets.push(nouveau);
  enregistrer();

  champs.libelle.value = "";
  champs.cout.value = "";
  champs.epargne.value = "0";
  champs.libelle.focus();

  toutAfficher();
});

function supprimerProjet(id) {
  projets = projets.filter(function (p) { return p.id !== id; });
  enregistrer();
  toutAfficher();
}

// Change le montant déjà mis de côté pour un projet.
function mettreAJourEpargne(id, montant) {
  projets.forEach(function (p) {
    if (p.id === id) p.epargne = montant;
  });
  enregistrer();
  toutAfficher();
}

// Projet réalisé : un crédit devient une vraie dette, puis le projet disparaît.
function projetRealise(projet) {
  const calcul = calculerProjet(projet);
  let texte = "Marquer « " + projet.libelle + " » comme réalisé ?";
  if (projet.financement === "credit") {
    texte += " Le crédit de " + formaterEuros(calcul.emprunt) + " sera ajouté à tes dettes.";
  }
  if (!confirm(texte)) return;

  if (projet.financement === "credit") {
    dettes.push({
      id: String(Date.now()),
      libelle: "Crédit " + projet.libelle,
      restant: calcul.emprunt,
      mensualite: calcul.mensualite,
      taux: projet.taux,
      // Première mensualité : le 5 du mois qui suit le mois visé.
      debut: moisPlus(projet.date, 1) + "-05"
    });
  }
  supprimerProjet(projet.id);
}

function afficherProjets() {
  const conteneur = document.getElementById("liste-projets");
  conteneur.innerHTML = "";

  projets.forEach(function (projet) {
    const calcul = calculerProjet(projet);
    const credit = projet.financement === "credit";

    const carte = creer("article", "dette");

    // Le haut : titre, badge, bouton supprimer.
    const haut = creer("div", "dette-haut");
    const titres = creer("div");
    const titre = creer("p", "dette-titre", projet.libelle);
    titre.appendChild(creer("span", "badge", credit ? "Apport + crédit" : "Épargne"));
    if (calcul.urgent) titre.appendChild(creer("span", "badge urgent", "Date atteinte"));
    titres.append(
      titre,
      creer("p", "dette-sous-titre",
        formaterEuros(projet.cout) + " · prévu pour " + formaterMois(projet.date))
    );
    const bouton = creer("button", "supprimer", "×");
    bouton.type = "button";
    bouton.setAttribute("aria-label", "Supprimer " + projet.libelle);
    bouton.addEventListener("click", function () { supprimerProjet(projet.id); });
    haut.append(titres, bouton);

    // La barre : ce qui est déjà mis de côté par rapport à l'objectif.
    const pourcentage = calcul.objectifEpargne > 0
      ? (projet.epargne / calcul.objectifEpargne) * 100
      : 100;
    const barre = creer("div", "barre");
    const remplie = creer("div", "barre-remplie accent");
    remplie.style.width = Math.max(0, Math.min(100, pourcentage)) + "%";
    barre.appendChild(remplie);

    // Les chiffres clés.
    const chiffres = creer("dl", "dette-chiffres");
    function ajouterChiffre(etiquette, valeur) {
      const bloc = creer("div");
      bloc.append(creer("dt", "", etiquette), creer("dd", "", valeur));
      chiffres.appendChild(bloc);
    }
    ajouterChiffre(credit ? "Apport à réunir" : "Objectif", formaterEuros(calcul.objectifEpargne));
    ajouterChiffre("Reste à épargner", formaterEuros(calcul.resteAEpargner));
    ajouterChiffre("Par mois", formaterEuros(calcul.epargneMensuelle) +
      " (" + calcul.moisRestants + " mois)");
    if (credit) {
      ajouterChiffre("Montant emprunté", formaterEuros(calcul.emprunt));
      ajouterChiffre("Future mensualité", formaterEuros(calcul.mensualite) +
        " × " + projet.duree);
      ajouterChiffre("Coût du crédit", formaterEuros(calcul.coutCredit));
    }

    // Les actions : mettre à jour l'épargne, marquer comme réalisé.
    const actions = creer("div", "projet-actions");
    const champ = creer("div", "champ");
    const idChamp = "epargne-" + projet.id;
    const label = creer("label", "", "Déjà mis de côté (€)");
    label.htmlFor = idChamp;
    const saisie = creer("input");
    saisie.id = idChamp;
    saisie.type = "number";
    saisie.min = "0";
    saisie.step = "0.01";
    saisie.value = projet.epargne;
    // "change" se déclenche quand on quitte le champ ou qu'on valide.
    saisie.addEventListener("change", function () {
      mettreAJourEpargne(projet.id, Number(saisie.value) || 0);
    });
    champ.append(label, saisie);

    const boutonRealise = creer("button", "bouton bouton-secondaire bouton-petit", "Projet réalisé");
    boutonRealise.type = "button";
    boutonRealise.addEventListener("click", function () { projetRealise(projet); });

    actions.append(champ, boutonRealise);

    carte.append(haut, barre, chiffres, actions);
    conteneur.appendChild(carte);
  });

  document.getElementById("total-projets").textContent =
    formaterEuros(epargneProjetsDuMois(moisActuel())) + " par mois";
}


// =========================================================
// 6 quater. LA PRÉVISION : RÉGLAGES, VERDICT, GRAPHIQUE, TABLEAU (brique 7)
// =========================================================

const formulairePrevision = document.getElementById("formulaire-prevision");

// Dès qu'on change le solde ou l'horizon, on enregistre et on recalcule.
formulairePrevision.addEventListener("input", function () {
  parametres.soldeDepart = Number(formulairePrevision.elements.solde.value) || 0;
  parametres.horizon = Number(formulairePrevision.elements.horizon.value) || 12;
  enregistrer();
  afficherPrevision();
  afficherApercu(); // l'Aperçu affiche aussi la trajectoire
});
formulairePrevision.addEventListener("submit", function (e) { e.preventDefault(); });

function afficherPrevision() {
  // Les champs reprennent les réglages enregistrés.
  const champs = formulairePrevision.elements;
  if (document.activeElement !== champs.solde) champs.solde.value = parametres.soldeDepart;
  champs.horizon.value = String(parametres.horizon);
  document.getElementById("prevision-solde-label").textContent =
    "Solde du compte au 1er " +
    new Date().toLocaleDateString("fr-FR", { month: "long" }) + " (€)";

  const lignes = calculerPrevision(parametres.soldeDepart, parametres.horizon);

  // --- Le verdict ---
  ecrireVerdict(lignes, "prevision-verdict");

  // --- Le tableau ---
  const corps = document.getElementById("prevision-tableau");
  corps.innerHTML = "";
  lignes.forEach(function (l) {
    const tr = creer("tr");
    const caseSolde = creer("td", l.solde < 0 ? "negatif" : "", formaterEuros(l.solde));
    tr.append(
      creer("td", "", formaterMois(l.mois)),
      creer("td", "", formaterEuros(l.recettes)),
      creer("td", "", formaterEuros(l.depenses)),
      creer("td", "", formaterEuros(l.remboursements)),
      creer("td", "", formaterEuros(l.epargne)),
      caseSolde
    );
    corps.appendChild(tr);
  });

  // --- Le graphique ---
  dessinerGraphique(lignes, "prevision-graphique");
}

// Dessine une courbe en SVG (le format de dessin du web).
// Le principe : on transforme chaque montant en position (x, y) sur le dessin.
// Écrit le verdict de la prévision ("tout va bien" ou "alerte") à l'endroit voulu.
function ecrireVerdict(lignes, idCible) {
  const verdict = document.getElementById(idCible);
  const premierRouge = lignes.find(function (l) { return l.solde < 0; });
  const derniere = lignes[lignes.length - 1];
  if (premierRouge) {
    verdict.className = "verdict alerte";
    verdict.textContent =
      "Attention : en " + formaterMois(premierRouge.mois) + ", ton solde passe à " +
      formaterEuros(premierRouge.solde) + ". Réduis une dépense ou décale un projet avant ce mois-là.";
  } else {
    verdict.className = "verdict ok";
    verdict.textContent =
      "Aucun mois dans le rouge sur les " + lignes.length + " prochains mois. Solde prévu fin " +
      formaterMois(derniere.mois) + " : " + formaterEuros(derniere.solde) + ".";
  }
}

// idCible : l'endroit de la page où dessiner (la page Prévision ou l'Aperçu).
function dessinerGraphique(lignes, idCible) {
  const largeur = 640, hauteur = 240;
  const marge = { haut: 24, droite: 16, bas: 28, gauche: 64 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  // L'échelle verticale va du plus petit au plus grand solde, en incluant 0.
  const soldes = lignes.map(function (l) { return l.solde; });
  let min = Math.min(0, ...soldes);
  let max = Math.max(0, ...soldes);
  if (min === max) max = min + 100;
  const ecart = max - min;
  min = min - ecart * 0.08;
  max = max + ecart * 0.08;

  // Les deux fonctions de conversion "montant → position".
  function x(i) {
    return marge.gauche + (lignes.length === 1 ? zoneL / 2 : (i / (lignes.length - 1)) * zoneL);
  }
  function y(montant) {
    return marge.haut + ((max - montant) / (max - min)) * zoneH;
  }

  let svg = '<svg viewBox="0 0 ' + largeur + " " + hauteur + '" role="img" aria-label="Courbe du solde prévu">';

  // Les lignes de repère horizontales et leurs montants.
  for (let k = 0; k <= 4; k++) {
    const valeur = min + (k / 4) * (max - min);
    const py = y(valeur);
    svg += '<line class="g-grille" x1="' + marge.gauche + '" x2="' + (largeur - marge.droite) +
      '" y1="' + py + '" y2="' + py + '"/>';
    svg += '<text class="g-texte" x="' + (marge.gauche - 8) + '" y="' + (py + 4) +
      '" text-anchor="end">' + Math.round(valeur).toLocaleString("fr-FR") + " €</text>";
  }

  // La ligne du zéro, en pointillés.
  svg += '<line class="g-zero" x1="' + marge.gauche + '" x2="' + (largeur - marge.droite) +
    '" y1="' + y(0) + '" y2="' + y(0) + '"/>';

  // La courbe, et la zone colorée en dessous.
  const points = lignes.map(function (l, i) { return x(i) + "," + y(l.solde); });
  svg += '<polygon class="g-aire" points="' + x(0) + "," + y(0) + " " + points.join(" ") + " " +
    x(lignes.length - 1) + "," + y(0) + '"/>';
  svg += '<polyline class="g-ligne" points="' + points.join(" ") + '"/>';

  // Un point par mois (rouge si le solde est négatif) et le nom du mois en dessous.
  // Sur 24 mois, on n'écrit qu'un mois sur trois pour que ça reste lisible.
  const pas = lignes.length > 12 ? 3 : 1;
  lignes.forEach(function (l, i) {
    svg += '<circle class="g-point' + (l.solde < 0 ? " rouge" : "") + '" cx="' + x(i) +
      '" cy="' + y(l.solde) + '" r="3.5"/>';
    if (i % pas === 0) {
      const nom = new Date(l.mois + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short" });
      svg += '<text class="g-texte" x="' + x(i) + '" y="' + (hauteur - 8) +
        '" text-anchor="middle">' + nom + "</text>";
    }
  });

  // Le montant du dernier mois, à côté du dernier point.
  const dernier = lignes[lignes.length - 1];
  svg += '<text class="g-valeur" x="' + x(lignes.length - 1) + '" y="' + (y(dernier.solde) - 10) +
    '" text-anchor="end">' + formaterEuros(dernier.solde) + "</text>";

  svg += "</svg>";
  document.getElementById(idCible).innerHTML = svg;
}

// =========================================================
// 7. EXPORTER ET IMPORTER UNE COPIE (brique 4)
// =========================================================

const message = document.getElementById("sauvegarde-message");

// Exporter : on fabrique un fichier .json et on le propose au téléchargement.
// Sur iPhone, Safari propose alors de l'enregistrer dans l'app Fichiers.
document.getElementById("bouton-exporter").addEventListener("click", function () {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const donnees = toutesLesDonnees();
  donnees.exporteLe = aujourdhui;
  const fichier = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });

  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = "suivi-finances-" + aujourdhui + ".json";
  lien.click();
  URL.revokeObjectURL(lien.href);

  message.textContent = "Fichier exporté : " + mouvements.length + " ligne(s), " +
    dettes.length + " dette(s) et " + projets.length + " projet(s).";
});

// Importer : le bouton visible ouvre le champ "fichier" caché.
const champFichier = document.getElementById("fichier-import");

document.getElementById("bouton-importer").addEventListener("click", function () {
  champFichier.click();
});

// Quand un fichier est choisi, on le lit.
champFichier.addEventListener("change", function () {
  const fichier = champFichier.files[0];
  if (!fichier) return;

  const lecteur = new FileReader();
  lecteur.onload = function () {
    try {
      const donnees = JSON.parse(lecteur.result);
      if (!Array.isArray(donnees.mouvements)) {
        throw new Error("format inconnu");
      }

      const dettesDuFichier = Array.isArray(donnees.dettes) ? donnees.dettes : [];
      const projetsDuFichier = Array.isArray(donnees.projets) ? donnees.projets : [];
      const ok = confirm(
        "Ce fichier contient " + donnees.mouvements.length + " ligne(s), " +
        dettesDuFichier.length + " dette(s) et " + projetsDuFichier.length + " projet(s). " +
        "Il va remplacer les données actuelles de cet appareil. Continuer ?"
      );
      if (ok) {
        mouvements = donnees.mouvements;
        dettes = dettesDuFichier;
        projets = projetsDuFichier;
        if (donnees.parametres) parametres = donnees.parametres;
        enregistrer();
        toutAfficher();
        message.textContent = "Import réussi : " + mouvements.length + " ligne(s), " +
          dettes.length + " dette(s) et " + projets.length + " projet(s).";
      }
    } catch (erreur) {
      message.textContent = "Ce fichier n'est pas une copie de Suivi Finances. Choisis un fichier exporté depuis l'app.";
    }
    champFichier.value = ""; // permet de réimporter le même fichier plus tard
  };
  lecteur.readAsText(fichier);
});


// =========================================================
// 8. DÉMARRAGE
// On relit la mémoire, puis on affiche tout.
// =========================================================

charger();
toutAfficher();
