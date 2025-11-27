const WebSocket = require('ws');
const http = require('http');

// 1. Setup the Server (Required for Render Health Checks)
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Jarvis Backend is Running');
});

const wss = new WebSocket.Server({ server });

// 2. Configuration
const MODEL = "models/gemini-2.0-flash-exp";

// --- HELPER: Clean API Key ---
// Removes invisible spaces or quotes that cause Error 400
function getCleanApiKey() {
    let key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in Render Settings!");
        return null;
    }
    return key.replace(/["'\s]/g, ""); 
}

wss.on('connection', (clientWs) => {
    console.log("Client connected. Attempting to connect to Gemini...");

    const API_KEY = getCleanApiKey();
    if (!API_KEY) {
        console.error("Closing connection due to missing API Key.");
        clientWs.close();
        return;
    }

    // 3. Connect to Google Gemini
    const geminiUrl = `wss://generativelanguage.googleapis.com/v1beta/${MODEL}:bidiWrite?key=${API_KEY}`;
    
    const geminiWs = new WebSocket(geminiUrl);

    geminiWs.on('open', () => {
        console.log("SUCCESS: Connected to Gemini API!");
        
        // A. Send Initial Setup (Personality)
        const setupMessage = {
            setup: {
                model: MODEL,
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: "Kore" // "Kore", "Charon", "Puck", "Fenrir"
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: "You are J.A.R.V.I.S, a sophisticated AI assistant. Your tone is calm, British, robotic, and concise. Address the user as 'Sir'. Keep responses short and efficient."
                    }]
                }
            }
        };
        geminiWs.send(JSON.stringify(setupMessage));

        // B. Send "Kickstart" Message (Force him to speak first)
        const firstMessage = {
            client_content: {
                turns: [{
                    role: "user",
                    parts: [{ text: "System check. Are you online?" }]
                }],
                turn_complete: true
            }
        };
        geminiWs.send(JSON.stringify(firstMessage));
    });

    // 4. Pipe Audio: Client (Mic) -> Gemini
    clientWs.on('message', (data) => {
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    // 5. Pipe Audio: Gemini -> Client (Speakers)
    geminiWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });

    // Error Handling
    geminiWs.on('error', (error) => {
        console.error("Gemini Error:", error.message);
    });

    geminiWs.on('close', () => {
        console.log("Gemini connection closed.");
    });

    clientWs.on('close', () => {
        console.log("Client disconnected.");
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
