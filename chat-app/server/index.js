const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sockettalk', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

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
// Map socket.id to username
let users = {};

// For sidebar: track online users (set of usernames)
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
    // Remove any previous socket for this username
    Object.keys(users).forEach(id => {
      if (users[id] === username) {
        delete users[id];
      }
    });
    users[socket.id] = username;
    onlineUsers.add(username);
    io.emit('online_users', Array.from(onlineUsers));
  });

  // Respond to get_online_users event
  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
  });

  // Legacy users list for UsersList component
  socket.on('get_users', () => {
    socket.emit('users_list', Array.from(new Set(Object.values(users))));
  });

  socket.on('send_message', async (data) => {
    // Save message to MongoDB
    try {
      await Message.create({
        message: data.message,
        sender: data.sender,
        recipient: data.recipient
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
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

  // Chat history event
  socket.on('get_history', async ({ user1, user2 }) => {
    try {
      const history = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ time: 1 });
      socket.emit('chat_history', history);
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});