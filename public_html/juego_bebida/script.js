// Game Configuration
const squaresData = [
    { id: 1, title: "Salida", desc: "Brindis colectivo. Todos beben 1 trago.", icon: "🍻" },
    { id: 2, title: "Color mortal", desc: "Todos los que lleven algo negro beben.", icon: "⚫" },
    { id: 3, title: "Moneda traicionera", desc: "Cara: avanzas 2. Cruz: bebes 2.", icon: "🪙", type: "coin" },
    { id: 4, title: "Imitación express", desc: "Imita a alguien. Si no lo adivinan en 10s, bebes.", icon: "🎭" },
    { id: 5, title: "La Cascada", desc: "Empiezas tú y nadie para hasta que tú pares.", icon: "🌊" },
    { id: 6, title: "Pregunta Cultural", desc: "Pregunta de cultura general. Si fallas, bebes.", icon: "🧠", type: "trivia" },
    { id: 7, title: "Atrás, cobarde", desc: "Retrocedes 3 casillas y bebes 1 por cada casilla.", icon: "🔙", move: -3 },
    { id: 8, title: "Tarareo infernal", desc: "Tararea. Si no adivinan -> bebes. Si sí -> beben ellos.", icon: "🎶" },
    { id: 9, title: "El del medio manda", desc: "Repartes 3 tragos como quieras.", icon: "👉" },
    { id: 10, title: "Regla nueva", desc: "Inventas una norma. El que falle bebe.", icon: "📜" },
    { id: 11, title: "Nunca nunca light", desc: "Dices un “Yo nunca…”. Los que sí, beben.", icon: "🙊" },
    { id: 12, title: "Prenda o trago", desc: "Eliges: quitarte una prenda o beber 2.", icon: "👕" },
    { id: 13, title: "Palabra prohibida", desc: "Palabra prohibida. Pásalo mal.", icon: "🚫" },
    { id: 14, title: "Duelo rápido", desc: "Piedra-papel-tijera. El perdedor bebe 2.", icon: "✂️" },
    { id: 15, title: "Color lucky", desc: "Verde/Rojo/Blanco se salvan. Resto bebe.", icon: "🍀" },
    { id: 16, title: "Cuenta atrás", desc: "Categorías rápidas. El que falle bebe.", icon: "⏱️" },
    { id: 17, title: "La miradita", desc: "Mira fijamente 5s sin reírte o bebes.", icon: "👀" },
    { id: 18, title: "Suerte o castigo", desc: "Tira dado: 1-3 bebes, 4-6 repartes.", icon: "🎲", type: "dice_check" },
    { id: 19, title: "Cambio de sitio", desc: "Todos cambian de asiento. Último bebe 2.", icon: "🔄" },
    { id: 20, title: "Historia colectiva", desc: "Una palabra cada uno. El que se trabe bebe.", icon: "📖" },
    { id: 21, title: "Confesión divertida", desc: "Cuenta algo vergonzoso o bebe 3.", icon: "😳" },
    { id: 22, title: "Todos menos tú", desc: "Todos beben menos tú... o bebes 4 tú.", icon: "😎" },
    { id: 23, title: "Atracción fatal", desc: "Elige compañero de bebida.", icon: "❤️" },
    { id: 24, title: "Ruleta Rusa", desc: "Una bala. Si te toca a ti (el activo), retrocedes 10. Si no, ¡chupito!", icon: "🔫", type: "russian_roulette" },
    { id: 25, title: "Gran Final", desc: "Brindis general. ¡LLEGASTE!", icon: "🏆" }
];

const triviaQuestions = [
    { q: "¿Capital de España?", a: "Madrid" },
    { q: "¿Quién pintó El Guernica?", a: "Pablo Picasso" },
    { q: "¿Río que pasa por Sevilla?", a: "Guadalquivir" },
    { q: "¿Año del descubrimiento de América?", a: "1492" },
    { q: "¿Ingrediente principal del salmorejo?", a: "Tomate y pan" },
    { q: "¿Grupo de 'Zapatillas'?", a: "El Canto del Loco" },
    { q: "¿Quién canta 'Corazón Partío'?", a: "Alejandro Sanz" },
    { q: "¿Dónde está la Alhambra?", a: "Granada" },
    { q: "¿Moneda antes del Euro?", a: "Peseta" },
    { q: "¿Cuántas comunidades autónomas hay?", a: "17" },
    { q: "¿Autor del Quijote?", a: "Cervantes" },
    { q: "¿Baile típico de Madrid?", a: "Chotis" },
    { q: "¿Presidente actual (2025) aprox?", a: "Pedro Sánchez (probablemente)" },
    { q: "¿Equipo de fútbol 'Colchonero'?", a: "Atlético de Madrid" },
    { q: "¿Bebida típica de Asturias?", a: "Sidra" }
];

let players = [];
let currentPlayerIndex = 0;
let isRolling = false;
let globalTurnCounter = 0;
let nextModoLocoTurn = Math.floor(Math.random() * 5) + 5;

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const newPlayerName = document.getElementById('new-player-name');
const addPlayerBtn = document.getElementById('add-player-btn');
const playersList = document.getElementById('players-list-preview');
const colorBtns = document.querySelectorAll('.color-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameBoard = document.getElementById('game-board');
const rollBtn = document.getElementById('roll-btn');
const dice = document.getElementById('dice');
const turnIndicatorName = document.getElementById('current-player-name');

const modal = document.getElementById('rule-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalIcon = document.getElementById('modal-icon');
// const modalOkBtn = document.getElementById('modal-ok-btn'); // Moved to local scope
const closeModal = document.querySelector('.close-modal');

// Roulette Elements
const rouletteModal = document.getElementById('roulette-modal');
const roulettePlayerName = document.getElementById('roulette-player-name');
const rouletteWheel = document.getElementById('roulette-wheel');
const spinBtn = document.getElementById('spin-btn');
const rouletteResultText = document.getElementById('roulette-result-text');

// Logic State
let selectedColor = '#FF5252';

const funnyIntros = [
    "¡Atención!",
    "La Oca manda:",
    "¿Quién tiene sed?",
    "¡Vaya tela!",
    "Madre mía...",
    "A beber se ha dicho.",
    "No te va a gustar.",
    "¡Sorpresa!",
    "Prepárate.",
    "Jajaja.",
];

// INIT
function init() {
    setupColorPicker();
    addPlayerBtn.addEventListener('click', addPlayer);
    startGameBtn.addEventListener('click', startGame);
    rollBtn.addEventListener('click', handleRoll);

    // Initial listener for Entendido, though showRule will replace it.
    const okBtn = document.getElementById('modal-ok-btn');
    if (okBtn) okBtn.addEventListener('click', finalizeTurn);

    closeModal.addEventListener('click', closeRuleModal);
    // spinBtn listener is handled dynamically by the specific modes
}

function forceCloseRuleModal() {
    closeRuleModal();
    nextTurn();
}

function closeRuleModal() {
    modal.classList.remove('show');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // Reset any ongoing interactive stuff if necessary
    const actionArea = document.getElementById('modal-action-area');
    if (actionArea) actionArea.innerHTML = '';
}

function finalizeTurn() {
    closeRuleModal();
    checkModoLocoAndNext();
}

// UTILS
function getFemaleVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Monica') || v.name.includes('Marta')))
        || voices.find(v => v.lang.startsWith('es'));
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = 'es-ES';
        ut.lang = 'es-ES';
        ut.rate = 0.9;

        const v = getFemaleVoice();
        if (v) ut.voice = v;

        window.speechSynthesis.speak(ut);

        const avatar = document.getElementById('host-avatar');
        if (avatar) avatar.closest('.host-avatar-container').classList.add('host-speaking');
        ut.onend = () => {
            if (avatar) avatar.closest('.host-avatar-container').classList.remove('host-speaking');
        };
    }
}

// SETUP LOGIC
function setupColorPicker() {
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedColor = btn.dataset.color;
        });
    });
}

function addPlayer() {
    const name = newPlayerName.value.trim();
    if (!name) return;
    if (players.some(p => p.name === name)) {
        alert("¡Ese nombre ya existe!");
        return;
    }
    const player = {
        id: Date.now(),
        name: name,
        color: selectedColor,
        position: 1
    };
    players.push(player);
    renderPlayersList();
    newPlayerName.value = '';
    newPlayerName.focus();
    checkStartCondition();
}

function renderPlayersList() {
    playersList.innerHTML = '';
    players.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <div class="player-dot" style="background-color: ${p.color}"></div>
            <span style="flex:1; font-weight:700;">${p.name}</span>
            <button class="remove-player" onclick="removePlayer(${index})">&times;</button>
        `;
        playersList.appendChild(li);
    });
}

window.removePlayer = (index) => {
    players.splice(index, 1);
    renderPlayersList();
    checkStartCondition();
}

function checkStartCondition() {
    startGameBtn.disabled = players.length < 1;
}

// GAME START
function startGame() {
    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
    generateBoard();
    renderBoard();
    updateTurnIndicator();
}

function generateBoard() {
    gameBoard.innerHTML = '';

    for (let r = 0; r < 5; r++) {
        let rowIds = [];
        let start = r * 5 + 1;
        for (let c = 0; c < 5; c++) {
            rowIds.push(start + c);
        }
        if (r % 2 === 1) rowIds.reverse(); // Snake S-shape logic

        rowIds.forEach((id, index) => {
            const div = document.createElement('div');
            div.className = 'square';
            div.dataset.id = id;
            div.innerText = id;

            if (id === 1) div.classList.add('start');
            if (id === 25) div.classList.add('finish');

            // SNAKE ARROW LOGIC
            // r = 0 (1-5): Right
            // r = 1 (10-6): Left
            // r = 2 (11-15): Right

            // Connectors (Down arrows):
            // End of Row 0 (id 5) -> Down to 6
            // Start of Row 1 (id 6) is visually Rightmost of row 1... wait.
            // Grid layout:
            // Row 0: 1 2 3 4 5
            // Row 1: 10 9 8 7 6 (Reversed ids, but visually Left-to-Right is 10->6? NO)
            // CSS Grid simply places DOM elements in order.
            // visualSquares data order:
            // R0: 1,2,3,4,5
            // R1: 10,9,8,7,6
            // So visually on screen (Slot 6 to 10 in standard grid):
            // Pos 6 is ID 10. Pos 7 is ID 9... Pos 10 is ID 6.

            // Path: 5 (Rightmost R0) -> 6 (Rightmost R1).
            // So 5 needs Arrow Down.

            // Then 6 (Rightmost R1) -> 7 (Left of 6) ... -> 10 (Leftmost R1).
            // So 6,7,8,9 need Arrow Left.

            // Then 10 (Leftmost R1) -> 11 (Leftmost R2).
            // So 10 needs Arrow Down.

            // R2 (11-15): 11->12->...->15 (Rightmost R2).
            // 11,12,13,14 need Arrow Right.
            // 15 needs Arrow Down.

            // Logic based on ID is cleaner?
            // Right Arrows: 1,2,3,4 | 11,12,13,14 | 21,22,23,24
            // Left Arrows: 6,7,8,9 | 16,17,18,19
            // Down Arrows: 5, 15 | 10, 20

            // Wait, 10 is Leftmost. 11 is Leftmost. 10->11 is Down. Correct.
            // 5 is Rightmost. 6 is Rightmost. 5->6 is Down. Correct.
            // 20 is Leftmost. 21 is Leftmost. 20->21 is Down. Correct.

            if (id === 25) {
                // No arrow
            } else if ([5, 15].includes(id)) {
                div.classList.add('arrow-down');
            } else if ([10, 20].includes(id)) {
                div.classList.add('arrow-down');
                // Also 10 needs to indicate it came from right? No, arrow is "outgoing".
            } else if ([1, 2, 3, 4, 11, 12, 13, 14, 21, 22, 23, 24].includes(id)) {
                div.classList.add('arrow-right');
            } else if ([6, 7, 8, 9, 16, 17, 18, 19].includes(id)) {
                div.classList.add('arrow-left');
            }

            gameBoard.appendChild(div);
        });
    }
}

function renderBoard() {
    document.querySelectorAll('.player-piece').forEach(e => e.remove());
    players.forEach((p, index) => {
        const targetSquare = document.querySelector(`.square[data-id="${p.position}"]`);
        if (targetSquare) {
            const piece = document.createElement('div');
            piece.className = 'player-piece';
            piece.style.backgroundColor = p.color;
            piece.style.boxShadow = `0 0 10px ${p.color}`;
            const sameSquare = players.filter(pl => pl.position === p.position);
            if (sameSquare.length > 1) {
                const subIndex = sameSquare.indexOf(p);
                const offset = (subIndex * 8) - (sameSquare.length * 4);
                piece.style.transform = `scale(0.8) translate(${offset}px, ${offset}px)`;
            }
            targetSquare.appendChild(piece);
        }
    });
}

function updateTurnIndicator() {
    const p = players[currentPlayerIndex];
    turnIndicatorName.innerText = p.name;
    turnIndicatorName.style.color = p.color;
}

function handleRoll() {
    if (isRolling) return;
    isRolling = true;
    rollBtn.disabled = true;

    const result = Math.floor(Math.random() * 6) + 1;
    let xRot = 0, yRot = 0;

    switch (result) {
        case 1: xRot = 0; yRot = 0; break;
        case 6: xRot = 180; yRot = 0; break;
        case 2: xRot = -90; yRot = 0; break;
        case 5: xRot = 90; yRot = 0; break;
        case 3: xRot = 0; yRot = -90; break;
        case 4: xRot = 0; yRot = 90; break;
    }
    xRot += 720;
    yRot += 720;
    dice.style.transform = `rotateX(${xRot}deg) rotateY(${yRot}deg)`;

    setTimeout(() => {
        movePlayer(result);
        isRolling = false;
        rollBtn.disabled = false;
    }, 1600);
}

function movePlayer(steps) {
    const player = players[currentPlayerIndex];
    let newPos = player.position + steps;
    if (newPos > 25) {
        const diff = newPos - 25;
        newPos = 25 - diff;
    }
    player.position = newPos;
    renderBoard();
    setTimeout(() => {
        if (newPos === 25) {
            triggerWin(player);
        } else {
            showRule(newPos);
        }
    }, 600);
}

function showRule(pos) {
    const rule = squaresData.find(s => s.id === pos);
    modalTitle.innerText = `${pos}. ${rule.title}`;
    modalDesc.innerText = rule.desc;
    modalIcon.innerText = rule.icon;

    const actionArea = document.getElementById('modal-action-area');
    actionArea.innerHTML = '';

    // Reset OK Button Listeners by cloning
    // Reset OK Button Listeners by cloning
    let currentOkBtn = document.getElementById('modal-ok-btn');
    const newOkBtn = currentOkBtn.cloneNode(true);
    currentOkBtn.parentNode.replaceChild(newOkBtn, currentOkBtn);
    // Update reference to new button
    currentOkBtn = newOkBtn; // now currentOkBtn points to the live element

    currentOkBtn.style.display = 'block';

    // INTERACTIVE RULES
    if (rule.type === "russian_roulette") {
        currentOkBtn.style.display = 'none';
        startRussianRouletteLogic(actionArea);
    }
    else if (rule.type === "trivia") {
        currentOkBtn.style.display = 'none';
        const qObj = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
        modalDesc.innerText = `❓ ${qObj.q}`;

        const revealBtn = document.createElement('button');
        revealBtn.className = 'btn action';
        revealBtn.innerText = "Ver Respuesta";
        revealBtn.onclick = () => {
            modalDesc.innerText += `\n\n✅ Respuesta: ${qObj.a}`;
            revealBtn.style.display = 'none';
            currentOkBtn.style.display = 'block';
            currentOkBtn.onclick = () => { finalizeTurn(); };
            speakText(`La respuesta es ${qObj.a}.`);
        };
        actionArea.appendChild(revealBtn);
        speakText(qObj.q);

    }
    else if (rule.type === "dice_check") {
        currentOkBtn.style.display = 'none';
        const rollActionBtn = document.createElement('button');
        rollActionBtn.className = 'btn action';
        rollActionBtn.innerText = "🎲 LANZAR DADO 🎲";
        rollActionBtn.onclick = () => {
            rollActionBtn.disabled = true;
            // Animate Dice in Modal? Or just Number? User requested Animation.
            // We can't easily move the 3D dice into modal.
            // But we can spin standard dice on board?
            // Simpler: Show random number with emoji effects.

            const val = Math.floor(Math.random() * 6) + 1;
            modalIcon.innerText = `🎲 ${val}`;
            if (val <= 3) {
                modalDesc.innerText = `¡Ha salido ${val}! \n🍺 BEBES TÚ.`;
                speakText(`Ha salido un ${val}. Te toca beber.`);
            } else {
                modalDesc.innerText = `¡Ha salido ${val}! \n👉 REPARTES TRAGOS.`;
                speakText(`Un ${val}. Estás de suerte, manda a beber a otro.`);
            }
            currentOkBtn.style.display = 'block';
            currentOkBtn.innerText = "Continuar";
            currentOkBtn.onclick = () => { finalizeTurn(); };
            rollActionBtn.style.display = 'none';
        };
        actionArea.appendChild(rollActionBtn);
    } else if (rule.move) {
        currentOkBtn.onclick = () => {
            closeRuleModal();
            setTimeout(() => {
                const p = players[currentPlayerIndex];
                p.position += rule.move;
                renderBoard();
                checkModoLocoAndNext();
            }, 500);
        };
    } else if (rule.type === "choice") {
        currentOkBtn.style.display = 'none';
        const b1 = document.createElement('button');
        b1.className = 'btn primary';
        b1.style.margin = '5px';
        b1.innerText = "Avanzar 2 🍻";
        b1.onclick = () => { players[currentPlayerIndex].position += 2; finalizeTurn(); };
        const b2 = document.createElement('button');
        b2.className = 'btn primary';
        b2.style.background = '#FF4444';
        b2.style.margin = '5px';
        b2.innerText = "Retroceder 4 🍻";
        b2.onclick = () => { players[currentPlayerIndex].position -= 4; finalizeTurn(); };
        actionArea.appendChild(b1);
        actionArea.appendChild(b2);
    } else if (rule.type === "coin") {
        currentOkBtn.innerText = "Lanzar Moneda";
        currentOkBtn.onclick = () => {
            const head = Math.random() > 0.5;
            modalIcon.innerText = head ? "🪙" : "❌";
            modalDesc.innerText = head ? "¡CARA! Avanzas 2 casillas." : "¡CRUZ! Bebes 2 tragos.";
            speakText(head ? "Cara. Avanzas." : "Cruz. Bebes.");
            currentOkBtn.innerText = "Continuar";
            currentOkBtn.onclick = () => {
                if (head) { players[currentPlayerIndex].position += 2; renderBoard(); }
                finalizeTurn();
            };
        };
    } else {
        currentOkBtn.innerText = "¡Entendido!";
        currentOkBtn.style.display = 'block';
        currentOkBtn.onclick = () => { finalizeTurn(); };
    }

    modal.classList.add('show');
    if (rule.type !== "trivia") {
        const intro = funnyIntros[Math.floor(Math.random() * funnyIntros.length)];
        speakText(`${intro} ${rule.title}. ${rule.desc}`);
    }
}

function startRussianRouletteLogic(container) {
    // Russian Roulette: 6 slots. 1 Bullet.
    // Logic: Iterate players? User said "it goes touching one to each player".
    // So distinct buttons for each slot?
    // Let's make 6 "chambers".

    container.innerHTML = '<h3>¡Girar el tambor!</h3>';
    const chambersDiv = document.createElement('div');
    chambersDiv.style.display = 'grid';
    chambersDiv.style.gridTemplateColumns = 'repeat(3, 1fr)';
    chambersDiv.style.gap = '10px';
    chambersDiv.style.margin = '20px 0';

    const bulletIndex = Math.floor(Math.random() * 6);
    let currentChamber = 0;

    // Create queue for roulette
    let rouletteQueue = [...players];
    // Rotate queue so current player is first? Or random?
    // "Touching one to each player" -> Sequence.
    // Start with current player.
    while (rouletteQueue[0] !== players[currentPlayerIndex]) {
        rouletteQueue.push(rouletteQueue.shift());
    }

    for (let i = 0; i < 6; i++) {
        const btn = document.createElement('button');
        btn.innerText = "⚫";
        btn.className = 'btn';
        btn.style.backgroundColor = '#333';
        btn.style.fontSize = '1.5rem';

        btn.onclick = () => {
            btn.disabled = true;
            // Identify player
            const victim = rouletteQueue[currentChamber % rouletteQueue.length];

            if (i === bulletIndex) {
                // BANG
                btn.innerText = "💥";
                btn.style.backgroundColor = 'red';

                // If victim is ACTUAL current player who landed:
                if (victim === players[currentPlayerIndex]) {
                    modalDesc.innerText = `¡BANG! ${victim.name} te has disparado. RETROCEDES 10 CASILLAS.`;
                    speakText(`¡Bang! ${victim.name}, has muerto. Retrocedes diez casillas.`);
                    setTimeout(() => {
                        victim.position -= 10;
                        if (victim.position < 1) victim.position = 1;
                        renderBoard();
                        finalizeTurn();
                    }, 2000);
                } else {
                    modalDesc.innerText = `¡BANG! ${victim.name} ha recibido el disparo. FONDO.`;
                    speakText(`¡Bang! ${victim.name}, te toca beberte la copa entera.`);
                    setTimeout(() => {
                        finalizeTurn();
                    }, 2000);
                }

                // Disable all
                Array.from(chambersDiv.children).forEach(b => b.disabled = true);

            } else {
                // Click
                btn.innerText = "💨";
                btn.style.backgroundColor = '#555';
                speakText("Click.");
                currentChamber++;
                const nextVictim = rouletteQueue[currentChamber % rouletteQueue.length];
                modalDesc.innerText = `Turno de ${nextVictim.name}... elige hueco.`;
            }
        };

        chambersDiv.appendChild(btn);
    }

    container.appendChild(chambersDiv);
    modalDesc.innerText = `Turno de ${rouletteQueue[0].name}. Elige con cuidado.`;
    speakText("Vamos a jugar a un juego. Ruleta rusa.");
}


// SPECIAL ROUNDS COMPOSER
let specialRoundType = 'roulette'; // Toggles: 'roulette' -> 'trivia' -> 'roulette'
let specialQueue = [];
let currentSpecialPlayer = null;

function checkModoLocoAndNext() {
    globalTurnCounter++;
    // Decrease frequency slightly to not interrupt too often? 
    // User said "every X turns". Let's keep 5-10 turns range.
    if (globalTurnCounter >= nextModoLocoTurn) {
        globalTurnCounter = 0;
        nextModoLocoTurn = Math.floor(Math.random() * 6) + 6; // 6 to 11 turns

        // Trigger Special Round
        if (specialRoundType === 'roulette') {
            specialRoundType = 'trivia'; // Next time will be trivia
            startStartRouletteRound();
        } else {
            specialRoundType = 'roulette'; // Next time will be roulette
            startTriviaRound();
        }
    } else {
        nextTurn();
    }
}

// Ensure nextTurn function exists and advances player
function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateTurnIndicator();
    modal.classList.remove('show');
    rouletteModal.classList.remove('show');

    // Safety resets
    isRolling = false;
    rollBtn.disabled = false;

    // Reset Special UI elements just in case
    const triviaUI = document.getElementById('trivia-ui');
    if (triviaUI) triviaUI.style.display = 'none';
    const rC = document.querySelector('.roulette-container');
    if (rC) rC.style.display = 'block';

    speakText(`Turno de ${players[currentPlayerIndex].name}`);
}

// --- ROULETTE ROUND (Modo Loco) ---
function startStartRouletteRound() {
    specialQueue = [...players];
    processRouletteQueue();
}

function processRouletteQueue() {
    if (specialQueue.length === 0) {
        rouletteModal.classList.remove('show');
        nextTurn();
        speakText("Ronda de chupitos terminada. Seguimos.");
        return;
    }
    currentSpecialPlayer = specialQueue.shift();

    // Setup UI for Roulette
    rouletteModal.classList.add('show');
    // Hide Trivia elements if any
    document.getElementById('trivia-ui').style.display = 'none';
    document.querySelector('.roulette-container').style.display = 'block';

    roulettePlayerName.innerText = `Turno de ${currentSpecialPlayer.name}`;
    roulettePlayerName.style.color = currentSpecialPlayer.color;
    rouletteResultText.innerText = "¡GIRA LA RULETA!";
    spinBtn.style.display = 'inline-block';
    spinBtn.disabled = false;

    // Reset wheel
    rouletteWheel.style.transition = 'none';
    rouletteWheel.style.transform = 'rotate(0deg)';

    // Bind Spin Button to Standard Flow
    spinBtn.onclick = () => {
        performSpin(() => {
            setTimeout(() => processRouletteQueue(), 3000);
        });
    };

    speakText(`Modo Loco. ${currentSpecialPlayer.name}, te toca girar.`);
}

// --- TRIVIA ROUND (Cultura y Castigo) ---
function startTriviaRound() {
    specialQueue = [...players];
    processTriviaQueue();
}

function processTriviaQueue() {
    if (specialQueue.length === 0) {
        rouletteModal.classList.remove('show');
        nextTurn();
        speakText("Ronda de preguntas terminada.");
        return;
    }
    currentSpecialPlayer = specialQueue.shift();

    // Reuse Roulette Modal but switch content
    rouletteModal.classList.add('show');

    // Ensure Trivia UI container exists
    let triviaUI = document.getElementById('trivia-ui');
    if (!triviaUI) {
        triviaUI = document.createElement('div');
        triviaUI.id = 'trivia-ui';
        // Insert before result text
        rouletteModal.querySelector('.roulette-content').insertBefore(triviaUI, rouletteResultText);
    }

    // Toggle Views
    triviaUI.style.display = 'block'; // Show Trivia
    document.querySelector('.roulette-container').style.display = 'none'; // Hide Wheel initially
    spinBtn.style.display = 'none'; // Hide Spin btn initially
    rouletteResultText.innerText = "";

    roulettePlayerName.innerText = `Pregunta para ${currentSpecialPlayer.name}`;
    roulettePlayerName.style.color = currentSpecialPlayer.color;

    // Get Question
    const q = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];

    triviaUI.innerHTML = `
        <div style="margin: 20px 0; font-size: 1.3rem; color: white;">
            <p><strong>❓ ${q.q}</strong></p>
        </div>
        <div id="trivia-controls">
            <button id="btn-see-answer" class="btn action" style="margin-bottom:10px;">Ver Respuesta</button>
            <div id="trivia-judge" style="display:none; gap:10px; justify-content:center;">
                <button id="btn-correct" class="btn primary" style="background:#4CAF50;">¡ACERTÓ! ✅</button>
                <button id="btn-wrong" class="btn primary" style="background:#F44336;">¡FALLÓ! ❌</button>
            </div>
        </div>
        <div id="trivia-answer" style="display:none; margin: 15px 0; color: #aaa; font-style: italic;">
            ${q.a}
        </div>
    `;

    speakText(`Pregunta para ${currentSpecialPlayer.name}. ${q.q}`);

    // Logic
    document.getElementById('btn-see-answer').onclick = () => {
        document.getElementById('trivia-answer').style.display = 'block';
        document.getElementById('trivia-judge').style.display = 'flex';
        document.getElementById('btn-see-answer').style.display = 'none';
        speakText(`La respuesta es ${q.a}`);
    };

    document.getElementById('btn-correct').onclick = () => {
        speakText("¡Correcto! Te salvas.");
        processTriviaQueue();
    };

    document.getElementById('btn-wrong').onclick = () => {
        speakText("¡Incorrecto! A la ruleta.");
        // Switch to Roulette View for Punishment
        triviaUI.style.display = 'none';
        document.querySelector('.roulette-container').style.display = 'block';
        spinBtn.style.display = 'inline-block';
        spinBtn.disabled = false;
        rouletteResultText.innerText = "¡CASTIGO! GIRA LA RULETA";

        // Reset wheel
        rouletteWheel.style.transition = 'none';
        rouletteWheel.style.transform = 'rotate(0deg)';

        spinBtn.onclick = () => {
            performSpin(() => {
                setTimeout(() => processTriviaQueue(), 3000);
            });
        };
    };
}

// Shared Spin Logic
function performSpin(onComplete) {
    spinBtn.disabled = true;
    speakText("Girando...");

    const extraSpins = 5 * 360;
    const randomStop = Math.floor(Math.random() * 360);
    const finalRot = extraSpins + randomStop;

    rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.1, 0.9, 0.3, 1)';
    rouletteWheel.style.transform = `rotate(${finalRot}deg)`;

    setTimeout(() => {
        const normalized = finalRot % 360;
        let angleAtPointer = (360 - normalized) % 360;
        let drinks = 0;
        if (angleAtPointer < 90) drinks = 1;
        else if (angleAtPointer < 180) drinks = 2;
        else if (angleAtPointer < 270) drinks = 3;
        else drinks = 4;

        rouletteResultText.innerText = `¡${drinks} TRAGOS! 🥃`;
        speakText(`Te tocan ${drinks} tragos.`);

        if (onComplete) onComplete();
    }, 4000);
}

function triggerWin(player) {
    document.getElementById('winner-overlay').style.display = 'flex';
    document.getElementById('winner-name').innerText = player.name;
    document.getElementById('winner-name').style.color = player.color;
    if (window.startConfetti) window.startConfetti();
    speakText(`¡Felicidades ${player.name}! Eres el campeón.`);
}

init();
