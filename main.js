// Config Supabase
const supabaseClient = supabase.createClient(window.API.SUPABASE_URL, window.API.SUPABASE_ANON_KEY);


let scene, camera, renderer, raycaster, mouse;
let currentMesh = null;
let currentData = null;
async function loadCompetences() {
    const container = document.getElementById('competences-container');
    if (!container) return;

    // Requête vers ta table 'competences'
    const { data: competences, error } = await supabaseClient
        .from('competence')
        .select('*');

    if (error) {
        console.error('Erreur Supabase (compétences) :', error);
        container.innerHTML = `<div class="text-danger small">Erreur de chargement</div>`;
        return;
    }

    if (!competences || competences.length === 0) {
        container.innerHTML = `<div class="text-muted small">Aucune compétence trouvée.</div>`;
        return;
    }

    // Vider le conteneur pour enlever le texte de chargement
    container.innerHTML = '';

    // Boucler sur chaque ligne de ta table Supabase
    competences.forEach(comp => {
        const row = document.createElement('div');
        row.className = 'prop-row';
        
        // On récupère bien la valeur de ta colonne 'competence'
        const texteCompetence = comp.competence || 'Sans nom';
        
        row.innerHTML = `<span class="prop-input">${texteCompetence}</span>`;
        container.appendChild(row);
    });
}

// Pense à appeler cette fonction au démarrage dans ta fonction initApp()
async function initApp() {
    await loadCompetences();
    
    const viewport = document.getElementById('viewport');
    const outliner = document.getElementById('outliner');
    if (!viewport) return;

    // 1. Scène Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x282828);

    camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    viewport.appendChild(renderer.domElement);

    // Lumières
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.PointLight(0xe57922, 2, 50);
    light.position.set(5, 5, 5);
    scene.add(light);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 2. Récupérer données de Supabase (table 'tableau')
    const { data: projets, error } = await supabaseClient.from('tableau').select('*');
    if (error) {
        console.error('Erreur Supabase :', error);
        outliner.innerHTML = `<div class="item ms-3 text-danger">Erreur chargement</div>`;
        return;
    }

    // Charger Police 3D
    const fontLoader = new THREE.FontLoader();
    fontLoader.load('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        
        if (!projets || projets.length === 0) {
            outliner.innerHTML = `<div class="item ms-3 text-muted">Aucun projet</div>`;
            return;
        }

        // Construire la liste Outliner
        outliner.innerHTML = `<div class="item"><i class="bi bi-folder2-open text-warning"></i> Collection</div>`;

        projets.forEach((projet, idx) => {
            const item = document.createElement('div');
            item.className = `item ms-3 ${idx === 0 ? 'active' : ''}`;
            item.innerHTML = `<i class="bi bi-cube-fill me-1"></i> ${projet.titre || 'Projet ' + (idx + 1)}`;
            
            // Clic sur un projet dans l'Outliner
            item.addEventListener('click', () => {
                document.querySelectorAll('.item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                show3DText(projet, font);
            });

            outliner.appendChild(item);
        });

        // Afficher le 1er projet par défaut
        show3DText(projets[0], font);
    });

    // Fonction pour remplacer l'objet 3D actif
    function show3DText(projet, font) {
        if (currentMesh) {
            scene.remove(currentMesh);
            currentMesh.geometry.dispose();
            currentMesh.material.dispose();
        }

        currentData = projet;
        const text = projet.titre || 'Projet';

        const geo = new THREE.TextGeometry(text, {
            font: font,
            size: 0.4,
            height: 0.1,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.01
        });
        geo.center();

        const mat = new THREE.MeshStandardMaterial({ color: 0xe57922, roughness: 0.3, metalness: 0.8 });
        currentMesh = new THREE.Mesh(geo, mat);
        scene.add(currentMesh);
    }

    // Clic sur l'objet 3D pour ouvrir la Popup Modal
    renderer.domElement.addEventListener('click', (e) => {
        if (!currentMesh || !currentData) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / renderer.domElement.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(currentMesh);

        if (intersects.length > 0) {
            document.getElementById('modal-title').innerText = currentData.titre || 'Sans titre';
            document.getElementById('modal-desc').innerText = currentData.description || 'Pas de description.';
            
            const imgBox = document.getElementById('modal-img');
            imgBox.innerHTML = currentData.image 
                ? `<img src="${currentData.image}" class="img-fluid rounded border border-secondary" style="max-height:800px; width:100%; object-fit:contain;">` 
                : '';

            document.getElementById('modal-link').href = currentData.lien || '#';

            new bootstrap.Modal(document.getElementById('modal')).show();
        }
    });

    // Interaction de rotation au glisser-déposer
    let isDragging = false, prevMouse = { x: 0, y: 0 };
    renderer.domElement.addEventListener('mousedown', (e) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentMesh) return;
        currentMesh.rotation.y += (e.clientX - prevMouse.x) * 0.01;
        currentMesh.rotation.x += (e.clientY - prevMouse.y) * 0.01;
        prevMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Boucle d'animation
    function animate() {
        requestAnimationFrame(animate);
        if (currentMesh && !isDragging) currentMesh.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    animate();

    // Redimensionnement
    window.addEventListener('resize', () => {
        camera.aspect = viewport.clientWidth / viewport.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    });
}

initApp();