const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Jarvis Backend is Live');
});

const wss = new WebSocket.Server({ server });

// 1. CORRECT API ENDPOINT (The "Bidi" WebSocket)
const HOST = "generativelanguage.googleapis.com";
const PATH = "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const MODEL = "models/gemini-2.0-flash-exp";

function getCleanApiKey() {
    let key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("Error: GEMINI_API_KEY is missing.");
        return null;
    }
    return key.replace(/["'\s]/g, ""); 
}

wss.on('connection', (clientWs) => {
    console.log("Client connected. Connecting to Gemini...");

    const API_KEY = getCleanApiKey();
    if (!API_KEY) { 
        clientWs.close(); 
        return; 
    }

    // 2. Connect to the Official WebSocket Endpoint
    const geminiUrl = `wss://${HOST}${PATH}?key=${API_KEY}`;
    const geminiWs = new WebSocket(geminiUrl);

    geminiWs.on('open', () => {
        console.log("Connected to Gemini!");

        // 3. SEND SETUP MESSAGE (Strict CamelCase Required)
        const setupMessage = {
            setup: {
                model: MODEL,
                generationConfig: {  // <-- CamelCase!
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Kore"
                            }
                        }
                    }
                },
                systemInstruction: { // <-- CamelCase!
                    parts: [{
                        text: "You are J.A.R.V.I.S, a sophisticated AI. Speak in a robotic, British, concise manner. Call me 'Sir'."
                    }]
                }
            }
        };
        geminiWs.send(JSON.stringify(setupMessage));

        // 4. SEND INITIAL GREETING (Kickstart)
        const firstMessage = {
            clientContent: { // <-- CamelCase!
                turns: [{
                    role: "user",
                    parts: [{ text: "System check. Initialize voice protocol." }]
                }],
                turnComplete: true
            }
        };
        geminiWs.send(JSON.stringify(firstMessage));
    });

    geminiWs.on('message', (data) => {
        // Forward Gemini -> Client
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });

    clientWs.on('message', (data) => {
        // Forward Client -> Gemini
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    clientWs.on('close', () => geminiWs.close());
    geminiWs.on('close', () => clientWs.close());
    geminiWs.on('error', (err) => console.error("Gemini Error:", err.message));
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
