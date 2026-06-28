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
const words = [
    // Animals & Creatures
    "cat", "mouse", "rat", "cow", "pig", "sheep", "goat", "horse", "donkey", "duck",
    "chicken", "rooster", "turkey", "goose", "swan", "pelican", "flamingo", "ostrich", "eagle", "owl",
    "hawk", "parrot", "pigeon", "frog", "toad", "salamander", "crocodile", "alligator", "lizard", "chameleon",
    "iguana", "gecko", "dinosaur", "dragon", "unicorn", "bear", "wolf", "fox", "deer", "moose",
    "elk", "bat", "monkey", "gorilla", "chimpanzee", "orangutan", "kangaroo", "koala", "panda", "tiger",
    "leopard", "cheetah", "panther", "rhino", "hippo", "zebra", "giraffe", "camel", "alpaca", "llama",
    "whale", "dolphin", "shark", "octopus", "squid", "jellyfish", "seahorse", "crab", "lobster", "shrimp",
    "clam", "snail", "worm", "caterpillar", "bee", "ant", "fly", "mosquito", "beetle", "ladybug",
    "grasshopper", "cricket", "mantis", "scorpion", 
    
    // Food & Drink
    "apple", "pear", "peach", "plum", "cherry", "strawberry",
    "raspberry", "blueberry", "blackberry", "orange", "lemon", "lime", "grapefruit", "pineapple", "mango", "papaya",
    "kiwi", "coconut", "melon", "tomato", "potato", "onion", "garlic", "ginger", "pepper", "broccoli",
    "cauliflower", "cabbage", "lettuce", "spinach", "celery", "asparagus", "corn", "peas", "beans", "mushroom",
    "pumpkin", "squash", "cucumber", "bread", "toast", "sandwich", "wrap", "taco", "burrito", "quesadilla",
    "pasta", "spaghetti", "noodle", "soup", "salad", "steak", "pork", "bacon", "sausage", "egg",
    "omelet", "pancake", "waffle", "cereal", "oatmeal", "muffin", "croissant", "bagel", "pretzel", "cracker",
    "cookie", "brownie", "pie", "pudding", "jelly", "chocolate", "candy", "marshmallow", "popcorn", "peanut",
    "walnut", "almond", "milk", "water", "juice", "soda", "coffee", "tea", "wine", "beer",
    
    // Household & Objects
    "couch", "sofa", "armchair", "bed", "mattress", "blanket", "pillow", "dresser", "wardrobe", "mirror",
    "lamp", "lantern", "flashlight", "candle", "match", "oven", "stove", "microwave", "fridge", "freezer",
    "toaster", "blender", "sink", "toilet", "bathtub", "shower", "towel", "soap", "shampoo", "toothbrush",
    "toothpaste", "comb", "brush", "hairdryer", "iron", "vacuum", "broom", "mop", "bucket", "sponge",
    "trashcan", "plate", "bowl", "fork", "knife", "spoon", "mug", "glass", "pitcher", "pan",
    "pot", "spatula", "whisk", "remote", "tv", "radio", "speaker", "headphones", "keyboard", "mousepad",
    "monitor", "laptop", "tablet", "charger", "battery", "wire", "plug", "socket", "switch", "door",
    "window", "wall", "floor", "ceiling", "roof", "stairs", "elevator", "escalator", "rug", "carpet",
    "curtain", "blind", "frame", "picture", "poster", "painting", 
    
    // Nature, Elements & Environment
    "sun", "planet", "asteroid", "comet",
    "meteor", "galaxy", "universe", "sky", "space", "dirt", "soil", "sand", "rock", "stone",
    "pebble", "boulder", "mountain", "hill", "valley", "cliff", "c canyon", "cave", "ocean", "sea",
    "lake", "pond", "river", "stream", "creek", "waterfall", "wave", "tsunami", "beach", "island",
    "peninsula", "continent", "desert", "forest", "jungle", "woods", "swamp", "marsh", "tree", "bush",
    "shrub", "grass", "weed", "vine", "moss", "branch", "twig", "log", "stump", "bark",
    "root", "seed", "nut", "pinecone", "acorn", "rain", "snow", "hail", "sleet", "ice",
    "frost", "puddle", "fog", "mist", "wind", "breeze", "storm", "hurricane", "earthquake", "volcano",
    "lava", "magma", 
    
    // Clothing & Accessories
    "shirt", "tshirt", "blouse", "sweater", "hoodie", "jacket", "coat", "vest",
    "suit", "tuxedo", "dress", "skirt", "pants", "jeans", "shorts", "leggings", "underwear", "bra",
    "socks", "tights", "boots", "heels", "sneakers", "sandals", "slippers", "flipflops", "scarf", "gloves",
    "mittens", "tie", "bowtie", "belt", "suspenders", "helmet", "cap", "beanie", "mask", "sunglasses",
    "watch", "necklace", "bracelet", "ring", "earrings", "purse", "backpack", "wallet", "briefcase", "suitcase",
    "umbrella", 
    
    // Sports, Hobbies & Toys
    "football", "basketball", "baseball", "soccer", "tennis", "volleyball", "golf", "bowling", "rugby",
    "hockey", "pingpong", "badminton", "pool", "darts", "boxing", "wrestling", "karate", "judo", "fencing",
    "archery", "gymnastics", "cheerleader", "swimsuit", "diver", "surfboard", "skis", "snowboard", "skates", "skateboard",
    "rollerblades", "unicycle", "treadmill", "trampoline", "parachute", "racket", "club", "net", "goal", "hoop",
    "whistle", "trophy", "medal", "ribbon", "kite", "balloon", "yoyo", "frisbee", "doll", "blocks",
    "puzzle", "boardgame", "dice", "cards", "chess", "checkers", "dominoes", "guitar", "piano", "drum",
    "violin", "flute", "trumpet", "saxophone", 
    
    // Tools, Weapons & Professions
    "hammer", "screwdriver", "wrench", "pliers", "saw", "drill",
    "tape", "glue", "nails", "screws", "ruler", "level", "toolbox", "ladder", "wheelbarrow", "shovel",
    "rake", "hoe", "pitchfork", "hose", "lawnmower", "scissors", "needle", "thread", "pin", "sword",
    "shield", "bow", "arrow", "spear", "axe", "dagger", "gun", "rifle", "pistol", "cannon",
    "bomb", "grenade", "dynamite", "tank", "submarine", "battleship", "jet", "rocket", "astronaut", "doctor",
    "nurse", "dentist", "vet", "teacher", "student", "police", "firefighter", "chef", "baker", "waiter"
];
let wordToGuess = words[0]; 

// Helper to prevent malicious HTML in chat
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim().substring(0, 100);
};

// Helper to broadcast roles and the drawer's name
function updateRolesAndWord() {
    if (!currentDrawerId) return;
    
    const drawer = players.find(p => p.id === currentDrawerId);
    const drawerName = drawer ? drawer.name : 'Someone';

    io.sockets.sockets.forEach((s, id) => {
        s.emit('role', {
            role: id === currentDrawerId ? 'drawer' : 'guesser',
            drawerName: drawerName
        });
        
        if (id === currentDrawerId) {
            s.emit('word', wordToGuess);
        }
    });
}

// A list of distinct, readable colors for players
const chatColors = ['#FF3B30', '#007AFF', '#34C759', '#AF52DE', '#FF9500'];
let colorTracker = 0; // Ensures everyone gets a different color

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

    if (players.length === 1) {
        currentDrawerId = socket.id;
    }

    updateRolesAndWord();

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

            io.emit('chat', { type: 'system', message: `🎉 ${senderName} guessed the word! (+10 pts)` });
            io.emit('updateScores', players);
            
            let currentIndex = players.findIndex(p => p.id === currentDrawerId);
            let nextIndex = (currentIndex + 1) % players.length;
            currentDrawerId = players[nextIndex].id;
            wordToGuess = words[Math.floor(Math.random() * words.length)];
            
            io.emit('clearCanvas');
            updateRolesAndWord();
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
            updateRolesAndWord(); 
        } else if (players.length === 0) {
            currentDrawerId = null;
            wordToGuess = words[0];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
