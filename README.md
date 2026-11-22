# TaskMaster: A Collaborative Task Tracking System

TaskMaster is an enterprise-ready, collaborative task tracking and team management backend system built with Node.js, Express, and SQLite. It provides secure user authentication, fine-grained project membership, task lifecycle management with filtering and search, comments, file attachments, real-time push notifications via WebSockets & SSE, and Generative AI-powered task description synthesis.

## 🚀 Key Features

- **Authentication & Security**:
  - Secure user registration and login with bcrypt password hashing.
  - Stateless JSON Web Token (JWT) session management.
  - Protected endpoints with role-based authorization.
- **Task Management**:
  - Full CRUD operations with lifecycle states (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`).
  - Priority levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) and due dates.
  - Multi-attribute filtering (`status`, `priority`, `assigned_to`, `project_id`).
  - Full-text search across titles and descriptions.
  - Dynamic sorting by due date, priority, title, or creation timestamp.
- **Team & Project Collaboration**:
  - Create projects and manage team members with roles (`OWNER`, `ADMIN`, `MEMBER`).
  - Task assignment to team members with automatic notification dispatch.
  - Threaded discussion comments on tasks.
  - File attachments with multipart upload and secure download.
- **Real-Time Notifications (Optional Extension)**:
  - Dual real-time delivery: WebSocket (`/ws?token=<JWT>`) and Server-Sent Events (`/api/notifications/stream`).
  - Instant dispatch on task assignment, status transitions, and team comments.
- **Generative AI Assistant (Optional Extension)**:
  - Automated task description and acceptance criteria synthesis (`POST /api/tasks/ai-generate`).
  - Executive task summary generation (`GET /api/tasks/:id/ai-summary`).

---

## 🛠️ Tech Stack & Architecture

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Persistence**: SQLite (via Node.js `DatabaseSync` engine with WAL mode and foreign key constraints)
- **Security**: `bcryptjs`, `jsonwebtoken`
- **Real-Time Communication**: `ws` (WebSockets) & SSE (Server-Sent Events)
- **File Handling**: `multer`
- **Testing**: Built-in `node:test` runner with HTTP integration tests

---

## 📋 RESTful API Specification

### Authentication & Users
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT | No |
| `GET` | `/api/auth/profile` | Get logged-in user profile | Yes |
| `PUT` | `/api/auth/profile` | Update profile information | Yes |
| `POST` | `/api/auth/logout` | Invalidate client session | Yes |

### Projects & Teams
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects` | Create a new project | Yes |
| `GET` | `/api/projects` | List projects where user is a member | Yes |
| `GET` | `/api/projects/:id` | Get project details and team members | Yes |
| `POST` | `/api/projects/:id/members` | Invite/add a team member | Yes (Owner/Admin) |

### Task Management
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/tasks` | Create a new task | Yes |
| `GET` | `/api/tasks` | Query tasks with filtering, search, and sorting | Yes |
| `GET` | `/api/tasks/:id` | Get task details, comments, and attachments | Yes |
| `PUT` | `/api/tasks/:id` | Update task status, priority, or assignee | Yes |
| `DELETE` | `/api/tasks/:id` | Delete a task | Yes |

### Collaboration & Attachments
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/tasks/:id/comments` | Post a comment on a task | Yes |
| `GET` | `/api/tasks/:id/comments` | List all comments on a task | Yes |
| `POST` | `/api/tasks/:id/attachments` | Upload a file attachment (multipart/form-data) | Yes |
| `GET` | `/api/tasks/:id/attachments` | List attachments for a task | Yes |
| `GET` | `/api/tasks/:id/attachments/:attachmentId/download` | Download attachment file | Yes |

### Real-Time & AI Features
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/notifications/stream` | Server-Sent Events notification stream | Yes |
| `GET` | `/ws?token=<JWT>` | WebSocket connection for real-time events | Yes |
| `POST` | `/api/tasks/ai-generate` | Synthesize description from title and context | Yes |
| `GET` | `/api/tasks/:id/ai-summary` | Generate task executive summary | Yes |

---

## 🏃 Getting Started

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/ManishKVish/TaskMaster.git
   cd TaskMaster
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Start the server:
   ```bash
   npm start
   ```
   The API will be running at `http://localhost:5000`.

### Docker Setup
To run using Docker Compose:
```bash
docker compose up -d --build
```

---

## 🧪 Verification & Test Results
Run the automated test suite with:
```bash
npm test
```
Result: **15/15 tests passing** covering registration, login, JWT authorization, project management, task CRUD, multi-criteria filtering, comment threading, AI synthesis, and notification queues.
