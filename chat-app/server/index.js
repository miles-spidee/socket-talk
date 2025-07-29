const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow CORS (React will run on different port)
app.use(cors());
app.use(express.json());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Vite default
    methods: ['GET', 'POST'],
  },
});

// Socket connection
io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);

  socket.on('send_message', (data) => {
    // Broadcast message to all users except sender
    socket.broadcast.emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
