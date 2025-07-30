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

// Track users
// Map username to socket.id
let users = {};

io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);

  // When a user joins, set their username
  socket.on('join', (username) => {
    // Remove any previous socket for this username
    Object.keys(users).forEach(id => {
      if (users[id] === username) {
        delete users[id];
      }
    });
    users[socket.id] = username;
    io.emit('users_list', Array.from(new Set(Object.values(users))));
  });

  // Respond to get_users event
  socket.on('get_users', () => {
    socket.emit('users_list', Array.from(new Set(Object.values(users))));
  });

  socket.on('send_message', (data) => {
    // Always send to both sender and recipient for private messages
    if (data.recipient) {
      // Find recipient socket id
      const recipientId = Object.keys(users).find(
        (id) => users[id] === data.recipient
      );
      const senderId = Object.keys(users).find(
        (id) => users[id] === data.sender
      );
      // Send to recipient
      if (recipientId) {
        io.to(recipientId).emit('receive_message', data);
      }
      // Send to sender (always, even if sender == recipient)
      if (senderId && senderId !== recipientId) {
        io.to(senderId).emit('receive_message', data);
      }
    } else {
      // Fallback: broadcast to all except sender
      socket.broadcast.emit('receive_message', data);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('users_list', Array.from(new Set(Object.values(users))));
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
