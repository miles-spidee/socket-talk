-# NOTE: This project is still under work , not all features are implemented yet.

# SocketTalk

SocketTalk is a full-stack real-time chat application built with React (TypeScript), Express, MongoDB, and Socket.IO.

## Features
- Real-time messaging with Socket.IO
- User authentication (JWT, bcryptjs)
- Persistent chat history (MongoDB)
- Modern React frontend (Vite, TypeScript)

## Project Structure

```
chat-app/
  client/   # React + Vite frontend
  server/   # Express + Socket.IO backend
```

## Getting Started

### Prerequisites
- Node.js & npm
- MongoDB (local or cloud)

### Setup
1. Clone the repository:
   ```sh
   git clone https://github.com/miles-spidee/socket-talk.git
   cd socket-talk/chat-app
   ```
2. Install dependencies for both client and server:
   ```sh
   cd client && npm install
   cd ../server && npm install
   ```
3. Configure environment variables in `server/.env` (see `.env.example` if available).
4. Start the backend:
   ```sh
   npm run dev
   ```
5. Start the frontend:
   ```sh
   cd ../client
   npm run dev
   ```

## Usage
- Open your browser at `http://localhost:5173` (or the port shown in terminal).
- Register/login and start chatting in real time!

## License
MIT
