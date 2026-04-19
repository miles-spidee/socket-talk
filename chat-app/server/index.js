const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const clientOrigins = (
  process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
  },
});

const usersBySocket = {};
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (username) => {
    Object.keys(usersBySocket).forEach((id) => {
      if (usersBySocket[id] === username) {
        delete usersBySocket[id];
      }
    });

    usersBySocket[socket.id] = username;
    onlineUsers.add(username);

    io.emit('online_users', Array.from(onlineUsers));
    socket.emit('users_list', Array.from(new Set(Object.values(usersBySocket))));
  });

  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
  });

  socket.on('get_users', () => {
    socket.emit('users_list', Array.from(new Set(Object.values(usersBySocket))));
  });

  socket.on('typing', (data) => {
    const recipientId = Object.keys(usersBySocket).find(
      (id) => usersBySocket[id] === data.recipient
    );

    if (recipientId) {
      io.to(recipientId).emit('typing', data);
    }
  });

  socket.on('disconnect', () => {
    const username = usersBySocket[socket.id];
    delete usersBySocket[socket.id];

    if (username) {
      onlineUsers.delete(username);
      io.emit('online_users', Array.from(onlineUsers));
    }

    io.emit('users_list', Array.from(new Set(Object.values(usersBySocket))));
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
