# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time Pong game application with tournament features, supporting multiplayer gameplay, AI opponents, and blockchain integration. The project implements several advanced features including:

- Remote authentication with Google OAuth
- Two-Factor Authentication (2FA) and JWT
- Tournament management system
- Real-time multiplayer via WebSockets
- AI opponent integration
- Multi-language support (English, Arabic, French)
- Blockchain integration for tournament registry

## Architecture

The project follows a full-stack architecture with clear separation of concerns:

- **Backend**: Node.js with Fastify framework, SQLite database
- **Frontend**: TypeScript/Vite with vanilla JavaScript (no framework)
- **Blockchain**: Solidity smart contracts for tournament management
- **Infrastructure**: Docker containerization with ngrok tunneling

## Development Commands

### Docker Development (Recommended)
```bash
# Start the entire application stack
docker-compose up

# Build and start with fresh containers
docker-compose up --build
```

### Backend Development
```bash
cd backend
npm install
npm run dev  # Starts nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev     # Starts Vite dev server on port 5173 with --host flag
npm run build   # TypeScript compilation + Vite build
npm run preview # Preview production build
```

## Key Technologies

### Backend Stack
- **Fastify**: Web framework with plugin architecture
- **SQLite3**: Database with file-based storage
- **WebSocket (ws)**: Real-time communication for gameplay
- **JWT + bcrypt**: Authentication and security
- **Nodemailer**: Email services
- **Google Auth Library**: OAuth integration

### Frontend Stack
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **i18next**: Internationalization framework
- **Chart.js**: Data visualization
- **Canvas Confetti**: Game effects

### Infrastructure
- **Docker**: Containerization
- **ngrok**: HTTPS tunneling for development
- **SSL/TLS**: Self-signed certificates supported

## Project Structure

```
├── backend/
│   ├── app.js              # Main server entry point
│   ├── ws.js               # WebSocket server logic
│   ├── controllers/        # Route handlers (auth, tournament, etc.)
│   ├── routes/            # API route definitions
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   ├── middlewares/       # Authentication and validation
│   ├── db/               # SQLite database file
│   ├── certificate/      # SSL certificates (if present)
│   └── uploads/          # File upload storage
├── frontend/
│   ├── src/
│   │   ├── main.ts        # Application entry point
│   │   ├── router.ts      # Client-side routing
│   │   ├── i18n.ts        # Internationalization setup
│   │   ├── pages/         # Page components (login, pong, etc.)
│   │   └── locales/       # Translation files
│   └── vite.config.ts     # Vite configuration with HTTPS support
├── blockchain/
│   └── contracts/
│       └── TournamentRegistry.sol  # Smart contract for tournaments
└── docker-compose.yml     # Multi-service container setup
```

## Important Configuration

### Environment Variables
The application requires specific environment variables:
- `NGROK_AUTHTOKEN`: Required for HTTPS tunneling (mandatory for Docker)
- `PUBLIC_URL`: Public URL for the application
- Backend `.env`: Database and auth configuration
- Frontend `.env`: API endpoints and public URL
- Root `.env`: Additional configuration variables

### HTTPS/SSL Setup
- The application auto-detects SSL certificates in `backend/certificate/`
- If certificates exist (key.pem, cert.pem), both frontend and backend use HTTPS
- Without certificates, the application falls back to HTTP
- ngrok is used to provide HTTPS tunneling in development

### Database
- Uses SQLite with file-based storage in `backend/db/`
- Database file: `db.sqlite`
- Schema managed through models in `backend/models/`

## WebSocket Architecture

Real-time features implemented via WebSocket connections:
- Game state synchronization
- Player matchmaking
- Tournament updates
- Live match spectating

WebSocket server in `backend/ws.js` handles:
- Connection management
- Room-based communication
- Game loop coordination
- Player state tracking

## Authentication Flow

Multi-layered authentication system:
1. **Local Authentication**: Email/password with JWT
2. **Google OAuth**: Social login integration
3. **Two-Factor Authentication**: Additional security layer
4. **Session Management**: Cookie-based session handling

## Internationalization

Frontend supports multiple languages via i18next:
- English (en)
- Arabic (ar) - RTL support
- French (fr)

Translation files located in `frontend/src/locales/`

## Development Notes

- Frontend uses vanilla TypeScript with custom routing (no React/Vue)
- Backend follows MVC pattern with controller/route separation  
- WebSocket and HTTP servers run on separate ports (backend: 3000, frontend: 5173)
- Auto-detection of LAN IP for CORS configuration
- Docker setup includes ngrok for HTTPS tunneling, requires valid authtoken
- No test framework currently configured
- No linting tools (ESLint, etc.) currently configured

## Docker Architecture

The containerized setup includes:
- Single container running both frontend and backend services
- ngrok tunnel for HTTPS access to backend (port 3000)
- Volume mounting for SQLite database persistence
- Automatic service startup via `entrypoint.sh`
- Both services run in development mode with auto-reload