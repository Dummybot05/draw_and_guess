let socket; 

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusText = document.getElementById('status');
const timerEl = document.getElementById('timer');
const leaderboardDiv = document.getElementById('leaderboard'); 
const chatHistory = document.getElementById('chat-history');
const guessInput = document.getElementById('guessInput');
const sendBtn = document.getElementById('sendBtn');
const toolbar = document.getElementById('toolbar');

let isDrawer = false;
let drawing = false;
let current = { x: 0, y: 0 };

let currentLineWidth = 6;
let strokeColor = '#333333';

let history = [];
let redoList = [];
let currentPath = [];

ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// --- Login Logic ---
document.getElementById('joinBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value.trim();
    if (!name) return alert("Please enter a name to play!");

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    socket = io({ query: { name: name } });
    setupSocketListeners();
});

// Fix Mobile Keyboard Issue - Scrolldown when typing
guessInput.addEventListener('focus', () => {
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 300);
});

// --- Toolbar Logic ---
document.getElementById('penBtn').addEventListener('click', () => setTool('pen'));
document.getElementById('eraserBtn').addEventListener('click', () => setTool('eraser'));
document.getElementById('undoBtn').addEventListener('click', handleUndo);
document.getElementById('redoBtn').addEventListener('click', handleRedo);
document.getElementById('clearBtn').addEventListener('click', handleClear);

function setTool(tool) {
    document.getElementById('penBtn').classList.remove('active');
    document.getElementById('eraserBtn').classList.remove('active');

    if (tool === 'pen') {
        strokeColor = '#333333';
        currentLineWidth = 6;
        document.getElementById('penBtn').classList.add('active');
    } else if (tool === 'eraser') {
        strokeColor = '#FFFFFF'; 
        currentLineWidth = 25;   
        document.getElementById('eraserBtn').classList.add('active');
    }
}

function handleUndo() {
    if (!isDrawer || history.length === 0) return;
    redoList.push(history.pop());
    redrawHistory();
}

function handleRedo() {
    if (!isDrawer || redoList.length === 0) return;
    history.push(redoList.pop());
    redrawHistory();
}

function handleClear() {
    if (!isDrawer) return;
    history = [];
    redoList = [];
    redrawHistory();
}

function redrawHistory() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas'); 
    
    history.forEach(path => {
        path.forEach(seg => {
            drawLineLocally(seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.width);
        });
    });
    
    socket.emit('syncHistory', history);
}

// --- Chat UI Helpers ---
function addMessage(data) {
    const div = document.createElement('div');
    if (data.type === 'system') {
        div.className = 'msg msg-system';
        div.innerText = data.message;
    } else if (data.type === 'success') {
        div.className = 'msg msg-success';
        div.innerText = data.message;
    } else {
        div.className = 'msg msg-user';
        div.innerHTML = `<div class="sender-name" style="color: ${data.color};">${data.sender}</div><div>${data.message}</div>`;
    }
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight; 
}

function handleSend() {
    const val = guessInput.value.trim();
    if (val !== '' && socket) {
        socket.emit('guess', val);
        guessInput.value = '';
    }
}

// --- Socket Listeners ---
function setupSocketListeners() {
    socket.on('error', (msg) => {
        statusText.innerText = "Error";
        addMessage({ type: 'system', message: msg });
        setTimeout(() => {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
        }, 3000);
    });

    socket.on('updateScores', (players) => {
        players.sort((a, b) => b.score - a.score);
        leaderboardDiv.innerHTML = ''; 
        
        players.forEach((player, index) => {
            const el = document.createElement('div');
            el.className = 'player-score';
            
            const coloredName = `<span style="color: ${player.color};">${player.name}</span>`;

            if (index === 0 && player.score > 0) {
                el.classList.add('first-place');
                el.innerHTML = `👑 ${coloredName}: ${player.score}`;
            } else {
                el.innerHTML = `${coloredName}: ${player.score}`;
            }
            leaderboardDiv.appendChild(el);
        });
    });

    socket.on('role', (data) => {
        isDrawer = (data.role === 'drawer'); 
        
        guessInput.disabled = false;
        sendBtn.disabled = false;

        if (isDrawer) {
            statusText.innerText = "✏️ You are drawing!";
            guessInput.placeholder = "Chat (Don't type the word!)";
            toolbar.style.display = 'flex'; 
            setTool('pen'); 
        } else {
            // Show the masked word to guessers
            statusText.innerText = `👀 ${data.drawerName} is drawing! Word: ${data.wordMask}`; 
            guessInput.placeholder = "Type your guess...";
            toolbar.style.display = 'none'; 
        }
    });

    socket.on('word', (word) => {
        if (isDrawer) statusText.innerText = `✏️ Draw this: ${word.toUpperCase()}`;
    });

    socket.on('timer', (time) => {
        timerEl.innerText = `⏱️ ${time}s`;
        if (time <= 10) {
            timerEl.style.color = '#FF3B30';
        } else {
            timerEl.style.color = 'var(--text)';
        }
    });

    socket.on('draw', (data) => {
        drawLineLocally(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
    });

    socket.on('clearCanvas', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history = [];
        redoList = [];
    });

    socket.on('syncHistory', (syncedHistory) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        syncedHistory.forEach(path => {
            path.forEach(seg => {
                drawLineLocally(seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.width);
            });
        });
    });

    socket.on('chat', (data) => {
        addMessage(data); 
    });
}

// --- Event Listeners for Input ---
guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});
sendBtn.addEventListener('click', handleSend);

// --- Drawing Engine ---
function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }
    
    return { 
        x: (clientX - rect.left) * scaleX, 
        y: (clientY - rect.top) * scaleY 
    };
}

function startDrawing(e) {
    if (!isDrawer || !socket) return;
    e.preventDefault(); 
    drawing = true;
    const pos = getCoordinates(e);
    current.x = pos.x;
    current.y = pos.y;
    currentPath = []; 
}

function stopDrawing(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    if (currentPath.length > 0) {
        history.push(currentPath);
        redoList = []; 
    }
}

function draw(e) {
    if (!drawing || !isDrawer || !socket) return;
    e.preventDefault();
    
    const pos = getCoordinates(e);
    const segment = {
        x0: current.x, y0: current.y, 
        x1: pos.x, y1: pos.y, 
        color: strokeColor, width: currentLineWidth 
    };
    
    drawLineLocally(segment.x0, segment.y0, segment.x1, segment.y1, segment.color, segment.width);
    socket.emit('draw', segment);
    currentPath.push(segment); 
    
    current.x = pos.x;
    current.y = pos.y;
}

function drawLineLocally(x0, y0, x1, y1, color, width) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.closePath();
}

// Mouse Events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('mousemove', draw);

// Touch Events
canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchend', stopDrawing, { passive: false });
canvas.addEventListener('touchcancel', stopDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
