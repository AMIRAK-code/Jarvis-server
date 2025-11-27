const WebSocket = require('ws');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "models/gemini-2.0-flash-exp"; 
const GEMINI_URL = `wss://generativelanguage.googleapis.com/v1beta/${MODEL}:bidiWrite?key=${GEMINI_API_KEY}`;

console.log(`Jarvis Backend running on port ${PORT}`);

wss.on('connection', (clientWs) => {
    console.log("Client connected. Initializing Jarvis...");

    const geminiWs = new WebSocket(GEMINI_URL);

    geminiWs.on('open', () => {
        console.log("Connected to Gemini.");
        
        // Initial "Handshake" with Jarvis Personality
        const setupMessage = {
            setup: {
                model: MODEL,
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: "Kore" // Deep, authoritative voice
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: "You are J.A.R.V.I.S, a sophisticated AI assistant. Your tone is calm, British, robotic, and concise. You address the user as 'Sir'. You are helpful but dry. Keep responses short. Do not use markdown."
                    }]
                }
            }
        };
        geminiWs.send(JSON.stringify(setupMessage));
    });

    // Forward Audio: Client -> Gemini
    clientWs.on('message', (data) => {
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    // Forward Audio: Gemini -> Client
    geminiWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });

    // Cleanup
    clientWs.on('close', () => geminiWs.close());
    geminiWs.on('close', () => clientWs.close());
    geminiWs.on('error', (err) => console.error("Gemini Error:", err));
});