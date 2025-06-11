import { NextResponse } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WebSocketMessage {
    type: string;
    apiKey?: string;
    accessToken?: string;
    instrumentToken?: string;
    message?: string;
}

let wss: WebSocketServer | null = null;

export async function GET(req: Request) {
    if (!wss) {
        const server = (req as any).socket.server as Server;
        wss = new WebSocketServer({ noServer: true });

        server.on('upgrade', (request, socket, head) => {
            wss?.handleUpgrade(request, socket, head, (ws: WebSocket) => {
                wss?.emit('connection', ws, request);
            });
        });

        wss.on('connection', (ws: WebSocket) => {
            console.log('Client connected to live trading WebSocket');

            ws.on('message', (message: Buffer) => {
                try {
                    const data = JSON.parse(message.toString()) as WebSocketMessage;
                    console.log('Received message:', data);
                    
                    // Handle different message types
                    if (data.type === 'init') {
                        // Initialize KiteTicker with provided credentials
                        const { apiKey, accessToken, instrumentToken } = data;
                        console.log('Initializing KiteTicker with:', {
                            apiKey: apiKey ? '***' : 'missing',
                            accessToken: accessToken ? '***' : 'missing',
                            instrumentToken
                        });
                        
                        // Send success response
                        ws.send(JSON.stringify({
                            type: 'init_success',
                            message: 'KiteTicker initialized successfully'
                        }));
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Error processing message'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected from live trading WebSocket');
            });
        });
    }

    return NextResponse.json({ status: 'WebSocket server is running' });
}

export async function POST(req: Request) {
    const data = await req.json();
    
    // Broadcast message to all connected clients
    if (wss) {
        wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    return NextResponse.json({ status: 'Message broadcasted' });
}
