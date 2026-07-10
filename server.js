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

// NEW: Persistent score tracker
const userScoreHistory = {};

const words = [
  "dog", "cat", "mouse", "bird", "fish", "elephant", "lion", "tiger", "sloth", "monkey",
  "snake", "frog", "turtle", "spider", "horse", "cow", "pig", "sheep", "goat", "chicken",
  "duck", "goose", "rabbit", "deer", "fox", "wolf", "giraffe", "zebra", "rhino", "hippo",
  "kangaroo", "panda", "penguin", "seal", "whale", "dolphin", "shark", "octopus", "crab", "lobster",
  "snail", "worm", "bee", "ant", "butterfly", "fly", "mosquito", "bat", "owl", "apple",
  "banana", "orange", "grape", "strawberry", "watermelon", "lemon", "cherry", "peach", "pear", "pineapple",
  "coconut", "tomato", "potato", "carrot", "onion", "corn", "broccoli", "pizza", "hamburger", "hotdog",
  "taco", "sandwich", "bread", "cheese", "egg", "bacon", "cake", "pie", "cookie", "donut",
  "ice cream", "chocolate", "candy", "popcorn", "cereal", "soup", "salad", "steak", "muffin", "pancake",
  "sushi", "milk", "water", "juice", "coffee", "tea", "soda", "beer", "wine", "chair",
  "table", "bed", "sofa", "lamp", "rug", "tv", "remote", "clock", "picture", "mirror",
  "door", "window", "wall", "floor", "ceiling", "stairs", "fan", "heater", "ac", "fridge",
  "stove", "oven", "microwave", "toaster", "blender", "sink", "toilet", "bathtub", "shower", "towel",
  "soap", "toothbrush", "toothpaste", "brush", "comb", "shampoo", "toilet paper", "trash can", "broom", "mop",
  "vacuum", "iron", "ironing board", "bucket", "sponge", "dish", "cup", "bowl", "fork", "sun",
  "moon", "star", "cloud", "rain", "snow", "lightning", "wind", "tornado", "rainbow", "tree",
  "grass", "flower", "leaf", "bush", "dirt", "rock", "stone", "sand", "mountain", "hill",
  "valley", "river", "lake", "ocean", "sea", "beach", "island", "waterfall", "cave", "forest",
  "jungle", "desert", "ice", "fire", "smoke", "ash", "volcano", "earthquake", "mud", "puddle",
  "sky", "planet", "earth", "space", "comet", "asteroid", "meteor", "galaxy", "universe", "head",
  "hair", "face", "eye", "ear", "nose", "mouth", "lip", "tooth", "tongue", "chin",
  "cheek", "neck", "shoulder", "arm", "elbow", "wrist", "hand", "finger", "thumb", "chest",
  "stomach", "back", "spine", "hip", "leg", "knee", "ankle", "foot", "toe", "nail",
  "skin", "bone", "blood", "heart", "brain", "lung", "muscle", "skeleton", "skull", "tear",
  "sweat", "mustache", "beard", "freckles", "vein", "scar", "smile", "frown", "wink", "shirt",
  "pants", "shorts", "dress", "skirt", "sweater", "jacket", "coat", "vest", "suit", "tie",
  "bowtie", "sock", "shoe", "boot", "sandal", "slipper", "hat", "cap", "beanie", "scarf",
  "glove", "mitten", "belt", "glasses", "sunglasses", "watch", "necklace", "bracelet", "ring", "earring",
  "purse", "backpack", "wallet", "umbrella", "swimsuit", "bikini", "underwear", "bra", "pajama", "uniform",
  "costume", "helmet", "mask", "crown", "cape", "apron", "shoelace", "button", "zipper", "car",
  "truck", "bus", "van", "taxi", "police car", "fire truck", "ambulance", "motorcycle", "bicycle", "scooter",
  "skateboard", "roller skates", "train", "subway", "tram", "airplane", "helicopter", "jet", "hot air balloon", "blimp",
  "rocket", "spaceship", "boat", "ship", "submarine", "sailboat", "canoe", "kayak", "raft", "ferry",
  "tractor", "bulldozer", "forklift", "crane", "horse cart", "sleigh", "sled", "wheelchair", "stroller", "parachute",
  "wheel", "tire", "steering wheel", "engine", "road", "track", "bridge", "tunnel", "traffic light", "hammer",
  "screw", "screwdriver", "wrench", "pliers", "saw", "drill", "tape measure", "ruler", "level", "glue",
  "tape", "scissors", "knife", "sword", "shield", "bow", "arrow", "gun", "bomb", "axe",
  "shovel", "rake", "pitchfork", "hoe", "hose", "watering can", "pot", "pan", "kettle", "stapler",
  "paper", "pen", "pencil", "eraser", "marker", "crayon", "paint", "paintbrush", "canvas", "easel",
  "camera", "photo", "phone", "computer", "laptop", "webcam", "keyboard", "screen", "circle", "square",
  "triangle", "rectangle", "oval", "hexagon", "cube", "diamond", "cross", "target", "line", "dot",
  "peace sign", "infinity", "music note", "treble clef", "guitar", "piano", "drum", "violin", "flute", "trumpet",
  "saxophone", "harp", "microphone", "headphones", "speaker", "radio", "cd", "record", "ball", "baseball",
  "football", "racket", "net", "goal", "hoop", "golf club", "puck", "dice", "card", "board",
  "puzzle", "yoyo", "kite", "doll", "teddy bear", "block", "lego", "robot", "house", "apartment",
  "building", "skyscraper", "castle", "church", "temple", "mosque", "school", "hospital", "bank", "store",
  "mall", "restaurant", "cafe", "bar", "hotel", "factory", "barn", "farm", "tent", "igloo",
  "lighthouse", "windmill", "doctor", "nurse", "police", "firefighter", "teacher", "chef", "farmer", "pilot",
  "astronaut", "artist", "singer", "dancer", "clown", "pirate", "ninja", "ghost", "zombie", "vampire",
  "monster", "alien", "angel", "baby", "boy", "girl", "man", "woman"
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

// Begins the 180-second timer and notifies clients
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

// Broadcasts roles, masked words (with letter count), and drawer's name
function updateRolesAndWord() {
    if (!currentDrawerId) return;
    
    const drawer = players.find(p => p.id === currentDrawerId);
    const drawerName = drawer ? drawer.name : 'Someone';
    // CHANGE: Added exact letter count indicator
    const wordMask = wordToGuess.split('').map(() => '_').join(' ') + ` (${wordToGuess.length} letters)`;

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

const chatColors = ['#FF3B30', '#007AFF', '#34C759', '#AF52DE', '#FF9500'];
let colorTracker = 0; 

io.on('connection', (socket) => {
    const rawName = socket.handshake.query.name;
    const userId = socket.handshake.query.userId || socket.id; // NEW: Grab the permanent user ID
    const playerName = sanitizeInput(rawName) || `Player ${socket.id.substring(0,4)}`;

    if (players.length >= 3) {
        socket.emit('error', 'Room is full! Only 3 players allowed.');
        socket.disconnect(true);
        return;
    }

    const assignedColor = chatColors[colorTracker % chatColors.length];
    colorTracker++;

    // NEW: Check if this user has a saved score, otherwise start at 0
    const startingScore = userScoreHistory[userId] || 0;

    // NEW: Save the userId in the player object
    players.push({ id: socket.id, userId: userId, name: playerName, score: startingScore, color: assignedColor });
    console.log(`[+] ${playerName} connected | Total: ${players.length}/3`);

    // ... (keep the rest of the connection logic exactly the same)

    io.emit('chat', { type: 'system', message: `👋 ${playerName} joined the game!` });
    io.emit('updateScores', players);

    if (players.length === 1) {
        currentDrawerId = socket.id;
        wordToGuess = words[Math.floor(Math.random() * words.length)];
        startRound(); 
    } else {
        socket.emit('timer', timeLeft);
        updateRolesAndWord(); 
    }

    socket.on('draw', (data) => {
        if (socket.id === currentDrawerId && data && typeof data.x0 === 'number') {
            socket.broadcast.emit('draw', data);
        }
    });

    socket.on('clearCanvas', () => {
        if (socket.id === currentDrawerId) socket.broadcast.emit('clearCanvas');
    });

    socket.on('syncHistory', (history) => {
        if (socket.id === currentDrawerId) socket.broadcast.emit('syncHistory', history);
    });

    socket.on('guess', (rawMsg) => {
        const msg = sanitizeInput(rawMsg);
        if (!msg) return;

        const sender = players.find(p => p.id === socket.id);
        const drawer = players.find(p => p.id === currentDrawerId);
        const senderName = sender ? sender.name : 'Unknown';
        const senderColor = sender ? sender.color : '#333333';

        if (socket.id === currentDrawerId) {
            if (msg.toLowerCase().includes(wordToGuess.toLowerCase())) {
                socket.emit('chat', { type: 'system', message: '❌ You cannot give away the word!' });
                return;
            }
            io.emit('chat', { type: 'user', sender: senderName, message: msg, color: senderColor });
            return;
        }

        if (msg.toLowerCase() === wordToGuess.toLowerCase()) {
            const timeBonus = Math.floor((timeLeft / 180) * 15); 
            const guesserPoints = 10 + timeBonus;
            const drawerPoints = 5 + Math.floor(timeBonus / 2);

            if (sender) {
                sender.score += guesserPoints;
                userScoreHistory[sender.userId] = sender.score; // NEW: Save to history
            }
            if (drawer) {
                drawer.score += drawerPoints;
                userScoreHistory[drawer.userId] = drawer.score; // NEW: Save to history
            }

            // ... (keep the rest the same)

            io.emit('chat', { 
                type: 'success', 
                message: `🎉 ${senderName} guessed it! (+${guesserPoints} pts)\nWord: ${wordToGuess.toUpperCase()}` 
            });
            io.emit('updateScores', players);
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
        
        io.emit('chat', { type: 'system', message: `🚪 ${leavingName} left.` });
        io.emit('updateScores', players);

        if (currentDrawerId === socket.id && players.length > 0) {
            currentDrawerId = players[0].id;
            startRound(); 
        } else if (players.length === 0) {
            currentDrawerId = null;
            clearInterval(roundTimer);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));