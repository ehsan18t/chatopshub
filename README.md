# Chat OPS Hub Backend

Unified social inbox API for WhatsApp Business API and Facebook Messenger. Built with NestJS, PostgreSQL, and Valkey.

## 🚀 Features

- **Multi-Channel Support**: WhatsApp Business API and Facebook Messenger integration
- **Real-time Communication**: WebSocket gateway with Socket.io and Redis adapter for multi-instance support
- **Agent Management**: Conversation assignment, distributed locking, and performance tracking
- **Background Jobs**: BullMQ-powered webhook processing and outbound message queues
- **Analytics Dashboard**: Agent performance metrics and organization-wide statistics
- **File Storage**: Local file system support for media attachments

## 📋 Tech Stack

| Technology  | Version | Purpose                           |
| ----------- | ------- | --------------------------------- |
| NestJS      | 11.x    | Core framework                    |
| PostgreSQL  | 18      | Primary database                  |
| Valkey      | 9       | Cache, pub/sub, distributed locks |
| Drizzle ORM | 0.44.x  | Type-safe database queries        |
| BullMQ      | 5.x     | Background job processing         |
| Socket.io   | 4.8.x   | Real-time WebSocket               |
| better-auth | 1.x     | Authentication                    |
| Bun         | 1.3.x   | Package manager & runtime         |

## 🛠️ Prerequisites

- [Bun](https://bun.sh/) >= 1.3.0
- [Docker](https://www.docker.com/) & Docker Compose
- ngrok (for webhook development)

## 🏃 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd chatopshub-backend
bun install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://chatops:chatops@localhost:5432/chatopshub

# Valkey (Redis-compatible)
VALKEY_URL=valkey://localhost:6379

# Auth
AUTH_SECRET=your-secret-key-minimum-32-characters
AUTH_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# WhatsApp Business API
WHATSAPP_VERIFY_TOKEN=your-whatsapp-verify-token
WHATSAPP_APP_SECRET=your-whatsapp-app-secret

# Facebook Messenger
MESSENGER_VERIFY_TOKEN=your-messenger-verify-token
MESSENGER_APP_SECRET=your-messenger-app-secret

# Storage
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Server
PORT=3001
NODE_ENV=development
```

### 3. Start Services

```bash
# Start PostgreSQL and Valkey
docker compose up -d

# Run database migrations
bun run db:push

# Seed initial data (optional)
bun run db:seed

# Start development server
bun run start:dev
```

### 4. Access

- API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/api/docs
- Drizzle Studio: `bun run db:studio`

## 📁 Project Structure

```
src/
├── analytics/     # Agent performance & dashboard metrics
├── auth/          # Authentication (better-auth)
├── channels/      # WhatsApp/Messenger channel management
├── common/        # Decorators, guards, filters, pipes
├── config/        # Configuration & validation
├── contacts/      # Contact management
├── conversations/ # Conversation CRUD & state management
├── db/            # Drizzle ORM schemas & migrations
├── events/        # WebSocket gateway
├── messages/      # Message CRUD & status tracking
├── providers/     # WhatsApp/Messenger API clients
├── queues/        # BullMQ processors
├── storage/       # File storage & attachments
├── users/         # User management
├── valkey/        # Valkey client service
└── webhooks/      # Webhook handlers & signature validation
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Sign in
- `POST /api/auth/register` - Create account
- `POST /api/auth/logout` - Sign out

### Conversations
- `GET /api/conversations` - List with filters
- `GET /api/conversations/:id` - Get with relations
- `POST /api/conversations/:id/accept` - Accept/assign
- `POST /api/conversations/:id/release` - Release back to queue
- `POST /api/conversations/:id/complete` - Mark complete

### Messages
- `GET /api/messages/conversation/:id` - List by conversation (cursor pagination)
- `POST /api/messages` - Send message

### Analytics
- `GET /api/analytics/dashboard/:orgId` - Real-time stats
- `GET /api/analytics/organization/:orgId` - Organization metrics
- `GET /api/analytics/agent/:agentId` - Agent performance

### Webhooks
- `GET /api/webhooks/whatsapp` - WhatsApp verification
- `POST /api/webhooks/whatsapp` - WhatsApp events
- `GET /api/webhooks/messenger` - Messenger verification
- `POST /api/webhooks/messenger` - Messenger events

## 🔄 WebSocket Events

### Client → Server
- `accept_conversation` - Agent accepts conversation
- `release_conversation` - Agent releases conversation
- `complete_conversation` - Agent completes conversation
- `set_status` - Update agent status (online/away)

### Server → Client
- `conversation_update` - Conversation state changed
- `new_message` - New message received
- `message_status` - Message delivery status
- `queue_update` - Queue count changed

## 🧪 Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

## 📝 Scripts

| Script                | Description              |
| --------------------- | ------------------------ |
| `bun run build`       | Build for production     |
| `bun run start`       | Start production server  |
| `bun run start:dev`   | Start development server |
| `bun run start:prod`  | Start with Bun runtime   |
| `bun run lint`        | Run Biome linter         |
| `bun run format`      | Format code              |
| `bun run test`        | Run tests                |
| `bun run db:generate` | Generate migrations      |
| `bun run db:push`     | Push schema to database  |
| `bun run db:studio`   | Open Drizzle Studio      |
| `bun run db:seed`     | Seed database            |

## 🔧 Webhook Setup (Development)

For local development, use ngrok to expose your webhook endpoints:

```bash
ngrok http 3001
```

Configure your webhook URLs in the Meta Developer Console:
- WhatsApp: `https://<ngrok-url>/api/webhooks/whatsapp`
- Messenger: `https://<ngrok-url>/api/webhooks/messenger`

## 📊 Database Schema

The database uses PostgreSQL with the following main tables:

- `organizations` - Multi-tenant organization data
- `users` - Agent accounts
- `channels` - WhatsApp/Messenger channel configs
- `contacts` - Customer contacts
- `conversations` - Conversation threads
- `messages` - Message history
- `attachments` - Media file metadata
- `conversation_events` - Audit trail
- `agent_sessions` - WebSocket session tracking

## 🔐 Environment Variables

| Variable                 | Required | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `DATABASE_URL`           | ✅        | PostgreSQL connection string             |
| `VALKEY_URL`             | ✅        | Valkey/Redis connection string           |
| `AUTH_SECRET`            | ✅        | Session encryption secret (32+ chars)    |
| `AUTH_URL`               | ✅        | Backend URL for auth                     |
| `FRONTEND_URL`           | ✅        | Frontend URL for CORS                    |
| `WHATSAPP_VERIFY_TOKEN`  | ✅        | WhatsApp webhook verification            |
| `WHATSAPP_APP_SECRET`    | ✅        | WhatsApp signature validation            |
| `MESSENGER_VERIFY_TOKEN` | ✅        | Messenger webhook verification           |
| `MESSENGER_APP_SECRET`   | ✅        | Messenger signature validation           |
| `STORAGE_TYPE`           | ❌        | `local` (default)                        |
| `STORAGE_PATH`           | ❌        | File storage path (default: `./uploads`) |
| `PORT`                   | ❌        | Server port (default: 3001)              |
| `NODE_ENV`               | ❌        | Environment (default: development)       |

## 📄 License

UNLICENSED - Private repository

---

Built with ❤️ using NestJS and Bun
