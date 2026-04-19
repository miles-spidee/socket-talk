const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

let useDb = true;
const messagesCache = []; 
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sockettalk';
const clientOrigins = (
  process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    useDb = true;
  })
  .catch((err) => {
    useDb = false;
    console.error('MongoDB connection error (falling back to in-memory store):', err);
  });

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected (event)');
  useDb = true;
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error (event):', err);
});
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

let users = {};

const onlineUsers = new Set();

io.on('connection', (socket) => {
  // Typing indicator
  socket.on('typing', (data) => {
    // Find recipient socket id
    const recipientId = Object.keys(users).find(
      (id) => users[id] === data.recipient
    );
    if (recipientId) {
      io.to(recipientId).emit('typing', data);
    }
  });
  console.log(`⚡ User connected: ${socket.id}`);

  // When a user joins, set their username
  socket.on('join', (username) => {
    Object.keys(users).forEach(id => {
      if (users[id] === username) {
        delete users[id];
      }
    });
    users[socket.id] = username;
    onlineUsers.add(username);
    io.emit('online_users', Array.from(onlineUsers));
  });
  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
  });
  socket.on('get_users', () => {
    socket.emit('users_list', Array.from(new Set(Object.values(users))));
  });

  socket.on('send_message', async (data) => {

    try {
      if (useDb) {
        await Message.create({
          message: data.message,
          sender: data.sender,
          recipient: data.recipient
        });
      } else {
        messagesCache.push({
          message: data.message,
          sender: data.sender,
          recipient: data.recipient,
          time: new Date(),
        });
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
    if (data.recipient) {
      const recipientId = Object.keys(users).find(
        (id) => users[id] === data.recipient
      );
      const senderId = Object.keys(users).find(
        (id) => users[id] === data.sender
      );
      if (recipientId) {
        io.to(recipientId).emit('receive_message', data);
      }
      if (senderId && senderId !== recipientId) {
        io.to(senderId).emit('receive_message', data);
      }
    } else {
      socket.broadcast.emit('receive_message', data);
    }
  });

  socket.on('get_history', async ({ user1, user2 }) => {
    try {
      if (useDb) {
        const history = await Message.find({
          $or: [
            { sender: user1, recipient: user2 },
            { sender: user2, recipient: user1 }
          ]
        }).sort({ time: 1 });
        socket.emit('chat_history', history);
      } else {
        const history = messagesCache.filter(m =>
          (m.sender === user1 && m.recipient === user2) ||
          (m.sender === user2 && m.recipient === user1)
        ).sort((a,b) => new Date(a.time) - new Date(b.time));
        socket.emit('chat_history', history);
      }
    } catch (err) {
      socket.emit('chat_history', []);
    }
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];
    if (username) {
      onlineUsers.delete(username);
      io.emit('online_users', Array.from(onlineUsers));
    }
    io.emit('users_list', Array.from(new Set(Object.values(users))));
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});