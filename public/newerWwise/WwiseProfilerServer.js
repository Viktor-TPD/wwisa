/*******************************************************************************
The content of this file includes portions of the AUDIOKINETIC Wwise Technology
released in source code form as part of the SDK installer package.

Commercial License Usage

Licensees holding valid commercial licenses to the AUDIOKINETIC Wwise Technology
may use this file in accordance with the end user license agreement provided 
with the software or, alternatively, in accordance with the terms contained in a
written agreement between you and Audiokinetic Inc.

Apache License Usage

Alternatively, this file may be used under the Apache License, Version 2.0 (the 
"Apache License"); you may not use this file except in compliance with the 
Apache License. You may obtain a copy of the Apache License at 
http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed
under the Apache License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
OR CONDITIONS OF ANY KIND, either express or implied. See the Apache License for
the specific language governing permissions and limitations under the License.

  Copyright (c) 2023 Audiokinetic Inc.
*******************************************************************************/

import { WebSocketServer } from 'ws';
import http from 'node:http';
import net from 'node:net';
import dgram from 'node:dgram';
import os from 'node:os';

// Registry of TCP client connections
let nextTcpClientId = 1;
let tcpClients = {};

class GameSocket {

    constructor(gameClient, id) {
        this.id = id;
        this.gameClient = gameClient;
        this.actions = {
            bind:   (pl) => this.onBindAction(pl),
            binary:   (pl) => this.onBinaryAction(pl)
        };
    }

    sendTypedMessage(type, payload) {
        this.gameClient.ws.send(JSON.stringify({ type: type, socket: this.id, payload: payload }));
    }

    sendBinaryMessage(buffer, payload) {
        this.sendTypedMessage('binary', payload);
        this.gameClient.ws.send(buffer);
    }

    onActionMessage(action, payload) {
        var handler = this.actions[action];
        if (!handler) {
            this.gameClient.reject(`GameSocket #${this.id}: No handler for action ${action}!`);
            return;
        }
        handler(payload);
    }

    onBinaryMessage(data) {
        // Implement in sub-classes.
    }

    onBindAction(payload) {
        // Implement in sub-classes
    }

    onBinaryAction(payload) {
        this.to = payload;
    }

    close() {
        // Implemented in sub-classes
    }
}

class UdpGameSocket extends GameSocket {
    constructor(gameClient, id, payload) {
        super(gameClient, id);
        
        this.udpSocket = dgram.createSocket({
            type: 'udp4',
            reuseAddr: payload.reuseaddress ? true : false
        });
        this.udpSocket.on('message', (buffer, rinfo) => this.onUdpMessage(buffer, rinfo));
        this.udpSocket.on('listening', () => this.onUdpListening());
        this.udpSocket.on('error', (e) => this.onUdpError(e));
        this.udpSocket.on('close', (e) => this.onUdpClose());
    }

    onUdpMessage(buffer, rinfo) {
        // Forward to client, along with remote addr information
        if (rinfo.family != "IPv4")
            return; // Ignore IPv6 clients, CommunicationCentral does not support them.
        this.sendBinaryMessage(buffer, { family: 2, port: rinfo.port, addr: rinfo.address });
    }

    onUdpListening() {
        var addr = this.udpSocket.address();
        console.log(`GameSocket #${this.id}: UDP Server up and listening on ${addr.address}:${addr.port}`);

        this.sendTypedMessage('listening', { family: addr.family, port: addr.port, addr: addr.address });
    }

    onUdpError(err) {
        if (err.code === 'EADDRINUSE') {
            // Force client to reset comms.
            console.log(`UDP port ${this.port} is in use, signalling game client...`);
            this.sendTypedMessage('bindfail', { port: this.port });
        } else {
            console.log(`Server socket error: ${err.stack}`);
        }
    }

    onUdpClose() {
        console.log(`GameSocket #${this.id}: UDP Server closed.`);
    }

    onBindAction(payload) {
        if (typeof(payload.port) != 'number' || payload.port < 0) {
            this.gameClient.reject("Received bind command without valid port number!");
            return;
        }
        this.port = payload.port;
        // For some reason, only UDP has the bind API... weird
        this.udpSocket.bind(this.port);
    }

    onBinaryMessage(buffer) {
        if (!this.to) {
            // Misbehaving client. 
            this.gameClient.reject("Received binary data before destination address!");
            return;
        }
        this.udpSocket.send(buffer, this.to.addr.port, this.to.addr.addr);
    }

    close() {
        this.udpSocket.close();
    }
}

class TcpServerGameSocket extends GameSocket {

    constructor(gameClient, id, payload) {
        
        super(gameClient, id);
        
        this.tcpSocket = net.createServer({
            noDelay: true
        });
        this.tcpSocket.on('connection', (tcpClient) => this.onTcpServerConnection(tcpClient));
        this.tcpSocket.on('listening', () => this.onTcpServerListening());
        this.tcpSocket.on('error', (err) => this.onTcpServerError(err));
        this.tcpSocket.on('close', (err) => this.onTcpServerClose());

        this.actions['listen'] = (pl) => this.onListenAction(pl);
    }

    onTcpServerConnection(tcpClientSocket) {
        var tcpClientAddress = tcpClientSocket.address();
        
        let clientId = nextTcpClientId;
        nextTcpClientId++;
        tcpClients[clientId] = { id: clientId, tcpConnection: tcpClientSocket, gameSocket: null, buffers: [] };

        console.log(`GameSocket #${this.id}: TCP Client ID #${clientId} connected from ${tcpClientAddress.address}:${tcpClientAddress.port}`);
        this.sendTypedMessage('clientconnected', { id: clientId, addr: { family: tcpClientAddress.family, port: tcpClientAddress.port, addr: tcpClientAddress.address }});

        tcpClientSocket.on('data', (buffer) => this.onTcpConnectionData(clientId, buffer));
        tcpClientSocket.on('error', (err) => this.onTcpConnectionError(clientId, err));
        tcpClientSocket.on('close', () => this.onTcpConnectionClose(clientId));
    }

    onTcpServerListening() {
        var addr = this.tcpSocket.address();
        console.log(`GameSocket #${this.id}: TCP Server up and listening on ${addr.address}:${addr.port}`);

        this.sendTypedMessage('listening', { family: addr.family, port: addr.port, addr: addr.address });
    }

    onTcpServerError(err) {
        if (err.code === 'EADDRINUSE') {
            // Force client to reset comms.
            console.log(`UDP port ${this.port} is in use, signalling game client...`);
            this.sendTypedMessage('bindfail', { port: this.port });
        } else {
            console.log(`GameSocket #${this.id}: TCP Server socket error: ${err.stack}`);
        }
    }

    onTcpServerClose() {
        console.log(`GameSocket #${this.id}: TCP Server closed.`);
    }

    onTcpConnectionError(clientId, err) {
        console.log(`GameSocket #${this.id}: TCP Client ID #${clientId} error: ${err}`);
    }

    onTcpConnectionClose(clientId) {
        console.log(`GameSocket #${this.id}: TCP Client ID #${clientId} disconnected.`);
        if (tcpClients[clientId]) {
            delete tcpClients[clientId];
        }
        // Notify
        this.sendTypedMessage('clientdisconnected', { id: clientId });
    }

    onTcpConnectionData(clientId, buffer) {
        var client = tcpClients[clientId];
        if (client) {
            // Did the game side create a GameSocket for this client?
            if (client.gameSocket) {
                // Yes; we can forward the event to it
                client.gameSocket.onTcpConnectionData(buffer);
            } else {
                // No; buffer the data until the game side creates the GameSocket
                client.buffers.push(buffer);
            }
        } else {
            console.log(`GameSocket #${this.id}: TCP Client ID #${clientId} not found; message discarded.`);
        }
    }

    onBindAction(payload) {
        if (typeof(payload.port) != 'number' || payload.port < 0) {
            this.gameClient.reject("Received bind command without valid port number!");
            return;
        }
        // For some reason, only UDP has the bind API... weird. So just save the port and keep it for listen()
        this.port = payload.port;
    }

    onListenAction(payload) {
        this.backlog = payload;
        this.tcpSocket.listen(this.port, { backlog: this.backlog });
    }

    close() {
        this.tcpSocket.close();
    }
}

const SEND_BUFFER_SIZE = 10 * 1024 * 1024; // 10K

class TcpConnectionGameSocket extends GameSocket {
    constructor(gameClient, id, payload) {
        super(gameClient, id);

        this.tcpConnectionId = payload.tcpConnectionId;

        this.sendBufferWritePos = 0;
        this.sendBuffer = Buffer.alloc(SEND_BUFFER_SIZE);
        this.flushInterval = setInterval(() => { this.onFlush(); }, 100);

        var record = tcpClients[this.tcpConnectionId];
        if (record) {
            if (record.gameSocket != null) {
                this.gameClient.reject("Only one GameSocket is permitted per TCP connection!");
                return;
            }
            record.gameSocket = this;
            // Send all pending data buffers
            for (var i=0; i < record.buffers.length; i++) {
                this.onTcpConnectionData(record.buffers[i]);
            }
            record.buffers = [];
            this.tcpConnection = record.tcpConnection;
        } else {
            console.error(`GameSocket #${this.id}: No TCP connection for ${this.tcpConnectionId}; no communication will be possible.`);
        }
    }

    onFlush() {
        if (this.sendBufferWritePos > 0) {
            let bufView = this.sendBuffer.subarray(0, this.sendBufferWritePos);//Buffer.from(this.sendBuffer, 0, this.sendBufferWritePos);

            this.sendBinaryMessage(bufView, {});
            this.sendBufferWritePos = 0;
        }
    }
    
    onBinaryMessage(buffer) {
        if (this.tcpConnection) {
            this.tcpConnection.write(buffer);
        }
    }

    onTcpConnectionData(buffer) {
        if ((this.sendBufferWritePos + buffer.byteLength) > this.sendBuffer.byteLength) {
            this.onFlush();
        }
        if (buffer.byteLength >= this.sendBuffer.byteLength) {
            this.sendBinaryMessage(buffer, {});
        } else {
            let bytes = buffer.copy(this.sendBuffer, this.sendBufferWritePos);
            if (bytes != buffer.byteLength)
                console.log("WARNING SOME BYTES WERE SKIPPED");
            this.sendBufferWritePos += buffer.byteLength;
        }
    }

    close() {
        if (this.tcpConnection) {
            this.tcpConnection.destroy();
        }
        clearInterval(this.flushInterval);
    }
}

class GameClient {
    constructor(ws) {
        this.ws = ws;
        this.gameSockets = {};
        this.lastRecipientId = 0;

        // Let the game know what the host name of the server is.
        this.ws.send(JSON.stringify({type: "hostname", payload: os.hostname()}));
    }

    onWebSocketMessage(data, isBinary) {
        if (isBinary) {
            // Recipient of the binary message should've been communicated in a previous WebSocket frame
            var socket = this.gameSockets[this.lastRecipientId];
            if (!socket) {
                this.reject("Received binary data before destination address!");
                return;
            }
            socket.onBinaryMessage(data);
        } else {
            const msg = JSON.parse(data);
            if (!msg || !msg.action || typeof(msg.socket) != 'number') {
                this.reject("Malformed JSON message: " + data);
                return;
            }
            this.lastRecipientId = msg.socket;

            if (msg.action == "create") {
                // New GameSocket
                if (msg.payload.type == 2) {
                    // TCP socket.
                    if (msg.payload.tcpConnectionId == 0) {
                        this.gameSockets[msg.socket] = new TcpServerGameSocket(this, msg.socket, msg.payload);
                    } else {
                        this.gameSockets[msg.socket] = new TcpConnectionGameSocket(this, msg.socket, msg.payload);
                    }
                } else if (msg.payload.type == 1) {
                    // UDP socket.
                    this.gameSockets[msg.socket] = new UdpGameSocket(this, msg.socket, msg.payload);
                } else {
                    this.reject("Unsupported socket type.");
                    return;
                }
            } else {
                // Existing GameSocket
                var socket = this.gameSockets[msg.socket];
                if (!socket) {
                    this.reject(`Socket ID not recognized: ${msg.socket}`);
                    return;
                }
                socket.onActionMessage(msg.action, msg.payload);
            }
        }
    }

    onWebSocketError(err) {
        console.log(`WebSocket connection error: ${err.stack}`);
    }

    onWebSocketClose(code, reason) {
        console.log('WebSocket connection closed: Code #%d, reason: %s', code, reason);
        for (var socketId in this.gameSockets) {
            var socket = this.gameSockets[socketId];
            socket.close();
            delete this.gameSockets[socketId];
        }
    }

    reject(reason) {
        // For misbehaving clients, we use code #1002 (see: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1)
        this.close(1002, reason);
    }

    close(code, reason) {
        this.ws.close(code, reason);
    }
}

const httpServer = new http.createServer({
    noDelay: true
});

httpServer.on('listening', function() {
    var addr = httpServer.address();
    console.log(`HTTP Server up and listening on ${addr.address}:${addr.port}`);
});

httpServer.on('error', function(e) {
    console.log(`HTTP Server error: ${err}`);
});

const wss = new WebSocketServer({
    server: httpServer
});

wss.on('connection', function onConnectionAccepted(ws) {
    console.log('Accepted new connection');
    let gameClient = new GameClient(ws);
    ws.on('message', (data, isBinary) => gameClient.onWebSocketMessage(data, isBinary) );
    ws.on('error', (err) => gameClient.onWebSocketError(err));
    ws.on('close', (code, reason) => gameClient.onWebSocketClose(code, reason) );
});

httpServer.listen(8095);
