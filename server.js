const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Production-ready Socket configuration
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    serveClient: true, 
    pingTimeout: 60000, 
    pingInterval: 25000 
});

app.use(express.static('public'));

// Game State
let players = []; 
let currentDrawerId = null;
let timeLeft = 180;
let roundTimer = null;

const words = [
    "cat", "mouse", "rat", "cow", "pig", "sheep", "goat", "horse", "donkey", "duck", "chicken", 
    "apple", "pear", "peach", "plum", "cherry", "strawberry", "pizza", "burger", "taco",
    "couch", "sofa", "bed", "lamp", "oven", "fridge", "toilet", "bathtub", "shower", "towel",
    "sun", "planet", "asteroid", "comet", "ocean", "mountain", "forest", "tree", "rain", "snow",
    "shirt", "jacket", "pants", "shoes", "socks", "hat", "glasses", "watch", "ring", "purse",
    "football", "basketball", "tennis", "golf", "guitar", "piano", "drum", "car", "train", "plane"
];
let wordToGuess = words[0]; 

// Helper to prevent malicious HTML in chat
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim().substring(0, 100);
};

// Starts a new turn securely
function startNextTurn() {
    if (players.length === 0) return;
    let currentIndex = players.findIndex(p => p.id === currentDrawerId);
    let nextIndex = (currentIndex + 1) % players.length;
    currentDrawerId = players[nextIndex].id;
    wordToGuess = words[Math.floor(Math.random() * words.length)];
    startRound();
}

// Begins the 60 second timer and notifies clients
function startRound() {
    clearInterval(roundTimer);
    timeLeft = 180;
    
    io.emit('clearCanvas');
    updateRolesAndWord();
    
    roundTimer = setInterval(() => {
        timeLeft--;
        io.emit('timer', timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            io.emit('chat', { type: 'system', message: `⏰ Time's up! The word was: ${wordToGuess.toUpperCase()}` });
            startNextTurn();
        }
    }, 1000);
}

// Helper to broadcast roles, masked words, and the drawer's name
function updateRolesAndWord() {
    if (!currentDrawerId) return;
    
    const drawer = players.find(p => p.id === currentDrawerId);
    const drawerName = drawer ? drawer.name : 'Someone';
    const wordMask = wordToGuess.split('').map(() => '_').join(' ');

    io.sockets.sockets.forEach((s, id) => {
        s.emit('role', {
            role: id === currentDrawerId ? 'drawer' : 'guesser',
            drawerName: drawerName,
            wordMask: wordMask
        });
        
        if (id === currentDrawerId) {
            s.emit('word', wordToGuess);
        }
    });
    
    io.emit('timer', timeLeft);
}

// A list of distinct, readable colors for players
const chatColors = ['#FF3B30', '#007AFF', '#34C759', '#AF52DE', '#FF9500'];
let colorTracker = 0; 

io.on('connection', (socket) => {
    const rawName = socket.handshake.query.name;
    const playerName = sanitizeInput(rawName) || `Player ${socket.id.substring(0,4)}`;

    if (players.length >= 3) {
        socket.emit('error', 'Room is full! Only 3 players allowed.');
        socket.disconnect(true);
        return;
    }

    const assignedColor = chatColors[colorTracker % chatColors.length];
    colorTracker++;

    players.push({ id: socket.id, name: playerName, score: 0, color: assignedColor });
    console.log(`[+] ${playerName} connected | Total: ${players.length}/3`);

    io.emit('chat', { type: 'system', message: `👋 ${playerName} joined the game!` });
    io.emit('updateScores', players);

    // If it's the first player, make them drawer and start the timer
    if (players.length === 1) {
        currentDrawerId = socket.id;
        wordToGuess = words[Math.floor(Math.random() * words.length)];
        startRound(); 
    } else {
        // Just sync the current round state to the new player
        socket.emit('timer', timeLeft);
        updateRolesAndWord(); 
    }

    socket.on('draw', (data) => {
        if (socket.id === currentDrawerId && data && typeof data.x0 === 'number') {
            socket.broadcast.emit('draw', data);
        }
    });

    socket.on('clearCanvas', () => {
        if (socket.id === currentDrawerId) {
            socket.broadcast.emit('clearCanvas');
        }
    });

    socket.on('syncHistory', (history) => {
        if (socket.id === currentDrawerId) {
            socket.broadcast.emit('syncHistory', history);
        }
    });

    socket.on('guess', (rawMsg) => {
        const msg = sanitizeInput(rawMsg);
        if (!msg) return;

        const sender = players.find(p => p.id === socket.id);
        const drawer = players.find(p => p.id === currentDrawerId);
        const senderName = sender ? sender.name : 'Unknown';
        const senderColor = sender ? sender.color : '#333333';

        if (socket.id === currentDrawerId) {
            if (msg.toLowerCase().includes(wordToGuess)) {
                socket.emit('chat', { type: 'system', message: '❌ You cannot give away the word!' });
                return;
            }
            io.emit('chat', { type: 'user', sender: senderName, message: msg, color: senderColor });
            return;
        }

        if (msg.toLowerCase() === wordToGuess) {
            if (sender) sender.score += 10;
            if (drawer) drawer.score += 5;

            // Send standard messages, BUT highlight the winning answer for everyone
            io.emit('chat', { type: 'success', message: `🎉 ${senderName} guessed it! The word was: ${wordToGuess.toUpperCase()}` });
            io.emit('updateScores', players);
            
            // Move to next turn
            startNextTurn();
        } else {
            io.emit('chat', { type: 'user', sender: senderName, message: msg, color: senderColor });
        }
    });

    socket.on('disconnect', () => {
        const leavingPlayer = players.find(p => p.id === socket.id);
        const leavingName = leavingPlayer ? leavingPlayer.name : 'Someone';
        
        players = players.filter(p => p.id !== socket.id);
        console.log(`[-] ${leavingName} disconnected`);
        
        io.emit('chat', { type: 'system', message: `🚪 ${leavingName} left the game.` });
        io.emit('updateScores', players);

        if (currentDrawerId === socket.id && players.length > 0) {
            currentDrawerId = players[0].id;
            startRound(); // Restart round with new drawer
        } else if (players.length === 0) {
            currentDrawerId = null;
            clearInterval(roundTimer);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
