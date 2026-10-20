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
  return { version: 2, mouvements: mouvements, dettes: dettes };
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

  const caseSolde = document.getElementById("apercu-solde");
  caseSolde.textContent = formaterEuros(solde);
  caseSolde.classList.toggle("positif", solde > 0);
  caseSolde.classList.toggle("negatif", solde < 0);

  // Le message d'attente disparaît dès qu'il y a une donnée.
  document.getElementById("apercu-vide").hidden = mouvements.length > 0 || dettes.length > 0;
}

function toutAfficher() {
  afficherListe("recette");
  afficherListe("depense");
  afficherDettes();
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

  message.textContent = "Fichier exporté : " + mouvements.length + " ligne(s) et " + dettes.length + " dette(s).";
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
      const ok = confirm(
        "Ce fichier contient " + donnees.mouvements.length + " ligne(s) et " +
        dettesDuFichier.length + " dette(s). " +
        "Il va remplacer les données actuelles de cet appareil. Continuer ?"
      );
      if (ok) {
        mouvements = donnees.mouvements;
        dettes = dettesDuFichier;
        enregistrer();
        toutAfficher();
        message.textContent = "Import réussi : " + mouvements.length + " ligne(s) et " + dettes.length + " dette(s).";
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
