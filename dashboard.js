// récupérer les données depuis Internet
const cheminDonneesEducation = 'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json';
const cheminDonneesComtes = 'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json';


// variables stockent les données chargées
let donneesEducation = [];      // Données d'éducation de chaque comté
let donneesComtes = null;       // Données géographiques des comtés
let donneesEtats = null;        // Données géographiques des états
let frontieresEtats = null;     // Frontières entre états
let carteCompleteUSA = null;    // Carte complète USA


// CHARGEMENT DES DONNÉES AVEC GESTION D'ERREURS
// Fonction asynchrone pour charger toutes les données nécessaires
async function chargerDonnees() {
    try {
        console.log("📊 Début du chargement des données...");
        
        // Chargement des deux fichiers JSON en parallèle
        const [dataEducation, dataComtes] = await Promise.all([
            d3.json(cheminDonneesEducation),
            d3.json(cheminDonneesComtes)
        ]);
        
        // Stockage des données dans les variables globales
        donneesEducation = dataEducation;
        carteCompleteUSA = dataComtes;
        
        // Conversion TopoJSON vers GeoJSON (format utilisable par D3)
        donneesComtes = topojson.feature(carteCompleteUSA, carteCompleteUSA.objects.counties);
        donneesEtats = topojson.feature(carteCompleteUSA, carteCompleteUSA.objects.states);
        
        // Création des frontières entre états
        frontieresEtats = topojson.mesh(carteCompleteUSA, carteCompleteUSA.objects.states, function(a, b) {
            return a !== b;  // Garde seulement les frontières entre états différents
        });
        
        console.log("✅ Données chargées:", donneesEducation.length, "comtés");
        console.log("✅ États chargés:", donneesEtats.features.length, "états");
        
        return donneesEducation;
        
    } catch (erreur) {
        console.error("❌ Erreur de chargement des données:", erreur);
        alert("Erreur lors du chargement des données. Vérifiez votre connexion Internet.");
        return [];
    }
}


// AFFICHAGE DE LA DATE ACTUELLE
function afficherDateActuelle() {
    const elementDate = document.getElementById('current-date');
    const optionsDate = { 
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    };
    const dateAujourdhui = new Date().toLocaleDateString('fr-FR', optionsDate);
    elementDate.textContent = dateAujourdhui;
}


// CALCUL ET AFFICHAGE DES STATISTIQUES
function calculerStatistiques(donnees) {
    
    // Extraction de tous les pourcentages
    const tousLesPourcentages = donnees.map(d => d.bachelorsOrHigher);
    
    // Calcul de la moyenne
    let somme = 0;
    for (let i = 0; i < tousLesPourcentages.length; i++) {
        somme += tousLesPourcentages[i];
    }
    const tauxMoyen = somme / tousLesPourcentages.length;
    
    // Calcul du minimum
    let tauxMinimum = tousLesPourcentages[0];
    for (let i = 1; i < tousLesPourcentages.length; i++) {
        if (tousLesPourcentages[i] < tauxMinimum) {
            tauxMinimum = tousLesPourcentages[i];
        }
    }
    
    // Calcul du maximum
    let tauxMaximum = tousLesPourcentages[0];
    for (let i = 1; i < tousLesPourcentages.length; i++) {
        if (tousLesPourcentages[i] > tauxMaximum) {
            tauxMaximum = tousLesPourcentages[i];
        }
    }
    
    // Nombre total de comtés
    const nombreComtes = donnees.length;
    
    console.log(" Moyenne:", tauxMoyen.toFixed(2) + "%");
    console.log(" Minimum:", tauxMinimum.toFixed(2) + "%");
    console.log(" Maximum:", tauxMaximum.toFixed(2) + "%");
    console.log(" Nombre de comtés:", nombreComtes);
    
    // Animation des chiffres dans les cartes
    animerNombre('avg-education', tauxMoyen, 800, n => n.toFixed(1) + '%');
    animerNombre('total-counties', nombreComtes, 800, n => Math.round(n).toLocaleString('fr-FR'));
    animerNombre('max-education', tauxMaximum, 800, n => n.toFixed(1) + '%');
    animerNombre('min-education', tauxMinimum, 800, n => n.toFixed(1) + '%');
}


// FONCTION UTILITAIRE: ANIMATION DES NOMBRES
function animerNombre(idElement, valeurFinale, duree, formateur) {
    const element = document.getElementById(idElement);
    if (!element) return;
    
    const valeurDepart = 0;
    const tempsDepart = performance.now();
    
    function mettreAJour(tempsCourant) {
        const tempsEcoule = tempsCourant - tempsDepart;
        const progression = Math.min(tempsEcoule / duree, 1);
        
        // Easing function
        const progressionLissee = 1 - Math.pow(1 - progression, 4);
        const valeurCourante = valeurDepart + (valeurFinale - valeurDepart) * progressionLissee;
        
        element.textContent = formateur ? formateur(valeurCourante) : valeurCourante.toFixed(2);
        
        if (progression < 1) {
            requestAnimationFrame(mettreAJour);
        }
    }
    
    requestAnimationFrame(mettreAJour);
}


// CRÉATION DE LA CARTE CHOROPLÈTHE
function creerCarteChoropleth(donnees, selecteur) {
    console.log("🗺️ Création de la carte choroplèthe...");
    
    // Dimensions
    const largeur = 975;
    const hauteur = 610;
    
    // Supprimer l'ancien SVG s'il existe
    d3.select(selecteur).select("svg").remove();
    
    // Créer un dictionnaire pour accès rapide aux données
    const dictionnaireEducation = new Map();
    const dictionnaireNoms = new Map();
    
    donnees.forEach(d => {
        dictionnaireEducation.set(d.fips, d.bachelorsOrHigher);
        dictionnaireNoms.set(d.fips, {
            nom: d.area_name,
            etat: d.state
        });
    });
    
    // Échelle de couleurs
    const echelleCouleur = d3.scaleQuantize()
        .domain([0, 70])
        .range(d3.schemeBlues[9]);
    
    // Projection géographique
    const projectionCarte = d3.geoPath();
    
    // Créer le SVG
    const svg = d3.select(selecteur)
        .append('svg')
        .attr('width', largeur)
        .attr('height', hauteur)
        .attr('viewBox', [0, 0, largeur, hauteur])
        .attr('style', 'max-width: 100%; height: auto;');
    
    // Dessiner les comtés
    svg.append('g')
        .selectAll('path')
        .data(donneesComtes.features)
        .enter()
        .append('path')
        .attr('fill', d => {
            const taux = dictionnaireEducation.get(d.id);
            return taux !== undefined ? echelleCouleur(taux) : '#ccc';
        })
        .attr('d', projectionCarte)
        .attr('class', 'county')
        .attr('stroke', 'none')
        .append('title')
        .text(d => {
            const taux = dictionnaireEducation.get(d.id);
            const info = dictionnaireNoms.get(d.id);
            if (taux !== undefined && info) {
                return `${info.nom}, ${info.etat}\n${taux.toFixed(1)}%`;
            }
            return 'Données non disponibles';
        });
    
    // Dessiner les frontières des états
    svg.append('path')
        .datum(frontieresEtats)
        .attr('fill', 'none')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('d', projectionCarte);
    
    // Créer la légende
    const largeurLegende = 320;
    const positionXLegende = largeur - largeurLegende - 20;
    const positionYLegende = 20;
    
    const groupeLegende = svg.append('g')
        .attr('transform', `translate(${positionXLegende},${positionYLegende})`);
    
    groupeLegende.append('text')
        .attr('x', 0)
        .attr('y', -6)
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text('Taux d\'éducation (%)');
    
    const largeurRectangle = largeurLegende / 9;
    const couleursLegende = d3.schemeBlues[9];
    
    couleursLegende.forEach((couleur, i) => {
        groupeLegende.append('rect')
            .attr('x', i * largeurRectangle)
            .attr('y', 0)
            .attr('width', largeurRectangle)
            .attr('height', 20)
            .attr('fill', couleur)
            .attr('stroke', 'rgba(255,255,255,0.2)')
            .attr('stroke-width', 0.5);
    });
    
    const echelleLegende = d3.scaleLinear()
        .domain([0, 70])
        .range([0, largeurLegende]);
    
    const axeLegende = d3.axisBottom(echelleLegende)
        .tickValues([0, 10, 20, 30, 40, 50, 60, 70])
        .tickFormat(d => d + '%')
        .tickSize(6);
    
    groupeLegende.append('g')
        .attr('transform', 'translate(0, 20)')
        .call(axeLegende)
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .attr('fill', 'var(--text-secondary)')
        .attr('font-size', '10px');
    
    groupeLegende.selectAll('line')
        .attr('stroke', 'var(--text-secondary)');
    
    // Animation d'apparition
    svg.style('opacity', 0)
        .transition()
        .duration(500)
        .style('opacity', 1);
    
    console.log("✅ Carte choroplèthe créée");
}


// CRÉATION DE L'HISTOGRAMME
function creerHistogramme(donnees, selecteur) {
    console.log("📊 Création de l'histogramme...");
    
    // Dimensions
    const marges = { haut: 20, droite: 30, bas: 60, gauche: 60 };
    const largeurTotale = d3.select(selecteur).node().getBoundingClientRect().width;
    const largeur = largeurTotale - marges.gauche - marges.droite;
    const hauteur = 400 - marges.haut - marges.bas;
    
    // Supprimer l'ancien SVG s'il existe
    d3.select(selecteur).select("svg").remove();
    
    // Regrouper par tranches de 5%
    const tranches = {};
    
    donnees.forEach(d => {
        const taux = d.bachelorsOrHigher;
        const cleTrache = Math.floor(taux / 5) * 5;
        
        if (!tranches[cleTrache]) {
            tranches[cleTrache] = {
                intervalle: `${cleTrache}-${cleTrache + 5}%`,
                compteur: 0
            };
        }
        tranches[cleTrache].compteur++;
    });
    
    // Conversion en tableau et tri
    const tableauTranches = Object.values(tranches).sort((a, b) => 
        parseInt(a.intervalle) - parseInt(b.intervalle)
    );
    
    // Créer le SVG
    const svg = d3.select(selecteur)
        .append('svg')
        .attr('width', largeurTotale)
        .attr('height', 400)
        .append('g')
        .attr('transform', `translate(${marges.gauche},${marges.haut})`);
    
    // Échelles
    const echelleX = d3.scaleBand()
        .domain(tableauTranches.map(d => d.intervalle))
        .range([0, largeur])
        .padding(0.2);
    
    const echelleY = d3.scaleLinear()
        .domain([0, d3.max(tableauTranches, d => d.compteur)])
        .nice()
        .range([hauteur, 0]);
    
    // Grille
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(echelleY)
            .tickSize(-largeur)
            .tickFormat(''))
        .selectAll('line')
        .attr('class', 'grid-line');
    
    // Barres
    svg.selectAll('.bar')
        .data(tableauTranches)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => echelleX(d.intervalle))
        .attr('width', echelleX.bandwidth())
        .attr('y', hauteur)
        .attr('height', 0)
        .attr('fill', 'var(--accent-blue)')
        .attr('rx', 3)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', 'var(--accent-purple)');
            
            svg.append('text')
                .attr('class', 'tooltip')
                .attr('x', echelleX(d.intervalle) + echelleX.bandwidth() / 2)
                .attr('y', echelleY(d.compteur) - 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', 'var(--text-primary)')
                .text(d.compteur);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', 'var(--accent-blue)');
            svg.selectAll('.tooltip').remove();
        })
        .transition()
        .duration(500)
        .attr('y', d => echelleY(d.compteur))
        .attr('height', d => hauteur - echelleY(d.compteur));
    
    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${hauteur})`)
        .call(d3.axisBottom(echelleX))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(echelleY));
    
    // Labels
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', largeur / 2)
        .attr('y', hauteur + 50)
        .text('Tranche de pourcentage');
    
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -hauteur / 2)
        .attr('y', -40)
        .text('Nombre de comtés');
    
    console.log("✅ Histogramme créé");
}


// CRÉATION DU DIAGRAMME CIRCULAIRE (PIE CHART)
function creerDiagrammeCirculaire(donnees, selecteur) {
    console.log("🥧 Création du diagramme circulaire...");
    
    const largeur = d3.select(selecteur).node().getBoundingClientRect().width;
    const hauteur = 400;
    const rayon = Math.min(largeur, hauteur) / 2 - 40;
    
    // Supprimer l'ancien SVG s'il existe
    d3.select(selecteur).select("svg").remove();
    
    // Classifier les comtés
    const categories = {
        'Très Faible': { compteur: 0, intervalle: '< 15%', couleur: '#ff6b6b' },
        'Faible': { compteur: 0, intervalle: '15-25%', couleur: '#ffd93d' },
        'Moyen': { compteur: 0, intervalle: '25-35%', couleur: '#6bcf7f' },
        'Élevé': { compteur: 0, intervalle: '35-45%', couleur: '#4facfe' },
        'Très Élevé': { compteur: 0, intervalle: '> 45%', couleur: '#9b51e0' }
    };
    
    donnees.forEach(d => {
        const taux = d.bachelorsOrHigher;
        if (taux < 15) categories['Très Faible'].compteur++;
        else if (taux < 25) categories['Faible'].compteur++;
        else if (taux < 35) categories['Moyen'].compteur++;
        else if (taux < 45) categories['Élevé'].compteur++;
        else categories['Très Élevé'].compteur++;
    });
    
    const tableauCategories = Object.entries(categories).map(([nom, data]) => ({
        nom,
        valeur: data.compteur,
        intervalle: data.intervalle,
        couleur: data.couleur
    }));
    
    // Créer le SVG
    const svg = d3.select(selecteur)
        .append('svg')
        .attr('width', largeur)
        .attr('height', hauteur)
        .append('g')
        .attr('transform', `translate(${largeur / 2},${hauteur / 2})`);
    
    // Générateurs
    const generateurPie = d3.pie()
        .value(d => d.valeur)
        .sort(null);
    
    const generateurArc = d3.arc()
        .innerRadius(0)
        .outerRadius(rayon);
    
    const arcHover = d3.arc()
        .innerRadius(0)
        .outerRadius(rayon + 10);
    
    const arcLabel = d3.arc()
        .innerRadius(rayon * 0.6)
        .outerRadius(rayon * 0.6);
    
    // Créer les portions
    const portions = svg.selectAll('.slice')
        .data(generateurPie(tableauCategories))
        .enter()
        .append('g')
        .attr('class', 'slice');
    
    portions.append('path')
        .attr('d', generateurArc)
        .attr('fill', d => d.data.couleur)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arcHover);
            
            svg.append('text')
                .attr('class', 'tooltip')
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('dy', '.35em')
                .attr('fill', 'var(--text-primary)')
                .text(`${d.data.nom}: ${d.data.valeur}`);
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', generateurArc);
            svg.selectAll('.tooltip').remove();
        })
        .style('opacity', 0)
        .transition()
        .duration(600)
        .style('opacity', 1);
    
    // Labels
    portions.append('text')
        .attr('class', 'slice-label')
        .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
        .attr('dy', '0.35em')
        .text(d => {
            const pourcentage = (d.data.valeur / donnees.length * 100).toFixed(0);
            return `${pourcentage}%`;
        })
        .style('opacity', 0)
        .transition()
        .duration(400)
        .style('opacity', 1);
    
    // Légende
    const legende = svg.selectAll('.legend')
        .data(tableauCategories)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${rayon + 20},${-rayon + i * 30})`);
    
    legende.append('rect')
        .attr('width', 18)
        .attr('height', 18)
        .attr('fill', d => d.couleur);
    
    legende.append('text')
        .attr('x', 24)
        .attr('y', 9)
        .attr('dy', '.35em')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '12px')
        .text(d => `${d.nom} (${d.valeur})`);
    
    console.log("✅ Diagramme circulaire créé");
}


// CRÉATION DU GRAPHIQUE RADAR
function creerGraphiqueRadar(donnees, selecteur) {
    console.log("📡 Création du graphique radar...");
    
    const largeur = d3.select(selecteur).node().getBoundingClientRect().width;
    const hauteur = 400;
    const rayon = Math.min(largeur, hauteur) / 2 - 80;
    
    // Supprimer l'ancien SVG s'il existe
    d3.select(selecteur).select("svg").remove();
    
    // Calculer les moyennes par région
    const regions = {
        'Nord-Est': [],
        'Sud-Est': [],
        'Midwest': [],
        'Sud-Ouest': [],
        'Ouest': []
    };
    
    donnees.forEach(d => {
        const codeEtat = Math.floor(d.fips / 1000);
        const taux = d.bachelorsOrHigher;
        
        if ([9, 23, 25, 33, 44, 50, 34, 36, 42].includes(codeEtat)) {
            regions['Nord-Est'].push(taux);
        } else if ([10, 11, 12, 13, 24, 37, 45, 51, 54].includes(codeEtat)) {
            regions['Sud-Est'].push(taux);
        } else if ([17, 18, 19, 20, 26, 27, 29, 31, 38, 39, 46, 55].includes(codeEtat)) {
            regions['Midwest'].push(taux);
        } else if ([1, 5, 22, 28, 35, 40, 47, 48].includes(codeEtat)) {
            regions['Sud-Ouest'].push(taux);
        } else {
            regions['Ouest'].push(taux);
        }
    });
    
    const donneesRegions = {};
    Object.entries(regions).forEach(([region, tableauTaux]) => {
        const somme = tableauTaux.reduce((acc, val) => acc + val, 0);
        donneesRegions[region] = somme / tableauTaux.length;
    });
    
    const nomsAxes = Object.keys(donneesRegions);
    const valeursAxes = Object.values(donneesRegions);
    
    // Créer le SVG
    const svg = d3.select(selecteur)
        .append('svg')
        .attr('width', largeur)
        .attr('height', hauteur)
        .append('g')
        .attr('transform', `translate(${largeur / 2},${hauteur / 2})`);
    
    const echelleRadiale = d3.scaleLinear()
        .domain([0, Math.max(...valeursAxes)])
        .range([0, rayon]);
    
    // Cercles concentriques
    const niveaux = 5;
    for (let i = 1; i <= niveaux; i++) {
        svg.append('circle')
            .attr('r', rayon * i / niveaux)
            .attr('class', 'radar-line')
            .attr('fill', 'none');
    }
    
    // Axes et labels
    const anglePortion = (Math.PI * 2) / nomsAxes.length;
    
    nomsAxes.forEach((nom, i) => {
        const angle = anglePortion * i - Math.PI / 2;
        
        svg.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', rayon * Math.cos(angle))
            .attr('y2', rayon * Math.sin(angle))
            .attr('class', 'radar-axis');
        
        svg.append('text')
            .attr('class', 'radar-label')
            .attr('x', (rayon + 30) * Math.cos(angle))
            .attr('y', (rayon + 30) * Math.sin(angle))
            .attr('text-anchor', 'middle')
            .text(nom);
    });
    
    // Aire du radar
    const generateurLigne = d3.lineRadial()
        .angle((d, i) => anglePortion * i)
        .radius((d, i) => echelleRadiale(valeursAxes[i]))
        .curve(d3.curveLinearClosed);
    
    svg.append('path')
        .datum(valeursAxes)
        .attr('class', 'radar-area')
        .attr('d', generateurLigne)
        .style('opacity', 0)
        .transition()
        .duration(500)
        .style('opacity', 1);
    
    // Points
    valeursAxes.forEach((valeur, i) => {
        const angle = anglePortion * i - Math.PI / 2;
        const rayon_point = echelleRadiale(valeur);
        
        svg.append('circle')
            .attr('cx', rayon_point * Math.cos(angle))
            .attr('cy', rayon_point * Math.sin(angle))
            .attr('r', 4)
            .attr('fill', 'var(--accent-blue)');
    });
    
}


// CRÉATION DU GRAPHIQUE LINÉAIRE
function creerGraphiqueLineaire(donnees, selecteur) {
    console.log("📈 Création du graphique linéaire...");
    
    const largeur = 975;
    const hauteur = 500;
    const marges = { haut: 40, droite: 40, bas: 60, gauche: 60 };
    const largeurInterieure = largeur - marges.gauche - marges.droite;
    const hauteurInterieure = hauteur - marges.haut - marges.bas;
    
    // Supprimer l'ancien SVG s'il existe
    d3.select(selecteur).select("svg").remove();
    
    // Générer données temporelles
    const anneeDebut = 1990;
    const anneeFin = 2020;
    const donneesTemporelles = [];
    
    let valeurBase = 20;
    const augmentationAnnuelle = 0.8;
    
    for (let annee = anneeDebut; annee <= anneeFin; annee++) {
        const variationAleatoire = (Math.random() - 0.5) * 2;
        const valeur = valeurBase + variationAleatoire;
        
        donneesTemporelles.push({
            annee: annee,
            valeur: parseFloat(valeur.toFixed(2))
        });
        
        valeurBase += augmentationAnnuelle;
    }
    
    // Trier par date
    const donneesTries = donneesTemporelles.sort((a, b) => a.annee - b.annee);
    
    // Créer le SVG
    const svg = d3.select(selecteur)
        .append('svg')
        .attr('width', largeur)
        .attr('height', hauteur)
        .attr('viewBox', [0, 0, largeur, hauteur])
        .attr('style', 'max-width: 100%; height: auto;');
    
    const g = svg.append('g')
        .attr('transform', `translate(${marges.gauche},${marges.haut})`);
    
    // Gradient
    const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'line-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
    
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#4facfe')
        .attr('stop-opacity', 0.8);
    
    gradient.append('stop')
        .attr('offset', '50%')
        .attr('stop-color', '#2196f3')
        .attr('stop-opacity', 0.5);
    
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#1a237e')
        .attr('stop-opacity', 0.3);
    
    // Échelles
    const echelleX = d3.scaleLinear()
        .domain([anneeDebut, anneeFin])
        .range([0, largeurInterieure]);
    
    const echelleY = d3.scaleLinear()
        .domain([0, d3.max(donneesTries, d => d.valeur) * 1.1])
        .nice()
        .range([hauteurInterieure, 0]);
    
    // Grille
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(echelleY)
            .tickSize(-largeurInterieure)
            .tickFormat(''))
        .selectAll('line')
        .attr('class', 'grid-line')
        .attr('stroke', 'rgba(255,255,255,0.05)')
        .attr('stroke-dasharray', '2,2');
    
    // Générateurs
    const generateurLigne = d3.line()
        .x(d => echelleX(d.annee))
        .y(d => echelleY(d.valeur))
        .curve(d3.curveMonotoneX);
    
    const generateurAire = d3.area()
        .x(d => echelleX(d.annee))
        .y0(hauteurInterieure)
        .y1(d => echelleY(d.valeur))
        .curve(d3.curveMonotoneX);
    
    // Aire avec gradient
    g.append('path')
        .datum(donneesTries)
        .attr('class', 'area-gradient')
        .attr('d', generateurAire)
        .attr('fill', 'url(#line-gradient)')
        .style('opacity', 0)
        .transition()
        .duration(800)
        .style('opacity', 1);
    
    // Ligne
    const cheminLigne = g.append('path')
        .datum(donneesTries)
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', '#4facfe')
        .attr('stroke-width', 3)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', generateurLigne);
    
    const longueurTotale = cheminLigne.node().getTotalLength();
    
    cheminLigne
        .attr('stroke-dasharray', `${longueurTotale} ${longueurTotale}`)
        .attr('stroke-dashoffset', longueurTotale)
        .transition()
        .duration(1500)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);
    
    // Points
    g.selectAll('.dot')
        .data(donneesTries)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => echelleX(d.annee))
        .attr('cy', d => echelleY(d.valeur))
        .attr('r', 0)
        .attr('fill', '#4facfe')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 7)
                .attr('fill', '#45a049');
            
            g.append('text')
                .attr('class', 'tooltip')
                .attr('x', echelleX(d.annee))
                .attr('y', echelleY(d.valeur) - 15)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', 'var(--text-primary)')
                .text(`${d.annee}: ${d.valeur.toFixed(1)}%`);
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 5)
                .attr('fill', '#4facfe');
            g.selectAll('.tooltip').remove();
        })
        .transition()
        .duration(400)
        .delay((d, i) => 1500 + i * 50)
        .attr('r', 5);
    
    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${hauteurInterieure})`)
        .call(d3.axisBottom(echelleX)
            .tickFormat(d3.format('d'))
            .ticks(10));
    
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(echelleY)
            .tickFormat(d => d + '%'));
    
    // Labels
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', largeur / 2)
        .attr('y', hauteur - 15)
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .text('Année');
    
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -hauteur / 2)
        .attr('y', 20)
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .text('Taux d\'éducation moyen (%)');
    
    // Titre
    svg.append('text')
        .attr('x', largeur / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-primary)')
        .attr('font-size', '16px')
        .attr('font-weight', '700')
        .style('opacity', 0)
        .text('Progression du taux d\'éducation supérieure aux États-Unis')
        .transition()
        .duration(800)
        .style('opacity', 1);
    
}


function mettreAJourGraphiques(donnees) {
    if (donnees.length === 0) {
        alert("Aucune donnée disponible.");
        return;
    }
    
    
    // Mettre à jour tous les graphiques
    creerCarteChoropleth(donnees, "#choropleth-map");
    creerHistogramme(donnees, "#histogram");
    creerDiagrammeCirculaire(donnees, "#pie-chart");
    creerGraphiqueRadar(donnees, "#radar-chart");
    creerGraphiqueLineaire(donnees, "#line");
}


// INITIALISATION DU DASHBOARD
chargerDonnees().then(donnees => {
    if (donnees.length === 0) {
        console.error("❌ Aucune donnée à afficher");
        return;
    }
    
    console.log("🎉 Initialisation du dashboard avec", donnees.length, "éléments");
    
    // Afficher la date
    afficherDateActuelle();
    
    // Calculer et afficher les statistiques
    calculerStatistiques(donnees);
    
    // Créer tous les graphiques
    mettreAJourGraphiques(donnees);
    
    
}).catch(erreur => {
    console.error("❌ Erreur lors de l'initialisation:", erreur);
});