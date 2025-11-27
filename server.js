const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// 1. Basic HTTP Server (Keeps Render Alive)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Jarvis Backend is Online');
});

const wss = new WebSocket.Server({ server });

// 2. Gemini Configuration
const HOST = "generativelanguage.googleapis.com";
const PATH = "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const MODEL = "models/gemini-2.0-flash-exp";

function getCleanApiKey() {
    let key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return key.replace(/["'\s]/g, ""); 
}

wss.on('connection', (clientWs) => {
    console.log("Client connected.");
    
    // --- ERROR TRAP 1: API KEY CHECK ---
    const API_KEY = getCleanApiKey();
    if (!API_KEY) {
        console.error("API Key Missing");
        clientWs.send(JSON.stringify({ 
            error: "CRITICAL ERROR: No API Key found in Render Environment Variables!" 
        }));
        // We do NOT close the connection instantly, so you can read the error.
        return; 
    }

    // 3. Connect to Gemini
    const geminiUrl = `wss://${HOST}${PATH}?key=${API_KEY}`;
    
    let geminiWs;
    try {
        geminiWs = new WebSocket(geminiUrl);
    } catch (err) {
        clientWs.send(JSON.stringify({ error: "Failed to create Gemini Socket: " + err.message }));
        return;
    }

    geminiWs.on('open', () => {
        console.log("Connected to Google.");
        
        // 4. Send Setup Message (CamelCase Required)
        const setupMessage = {
            setup: {
                model: MODEL,
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Kore" // Deep Voice
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{
                        text: "You are JARVIS. Speak in a robotic, British, concise manner. Introduce yourself."
                    }]
                }
            }
        };
        geminiWs.send(JSON.stringify(setupMessage));

        // 5. Send Kickstart Message (Wait 500ms to be safe)
        setTimeout(() => {
            if (geminiWs.readyState === WebSocket.OPEN) {
                const firstMessage = {
                    clientContent: {
                        turns: [{
                            role: "user",
                            parts: [{ text: "System Online. Report status." }]
                        }],
                        turnComplete: true
                    }
                };
                geminiWs.send(JSON.stringify(firstMessage));
            }
        }, 500);
    });

    geminiWs.on('message', (data) => {
        // Forward Audio: Gemini -> Client
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });

    geminiWs.on('error', (err) => {
        console.error("Gemini Error:", err);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: "Google API Error: " + err.message }));
        }
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`Gemini Closed: ${code} ${reason}`);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: `Google hung up. Code: ${code}` }));
        }
    });

    // Forward Audio: Client -> Gemini
    clientWs.on('message', (data) => {
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    clientWs.on('close', () => {
        if (geminiWs) geminiWs.close();
    });
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
