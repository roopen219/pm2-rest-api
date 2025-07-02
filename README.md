# PM2 REST API

A RESTful API wrapper for PM2 process manager, built with Bun and Hono. This API allows you to manage your PM2 processes remotely through HTTP endpoints.

## Features

- 🔒 Secure API with Bearer token authentication
- 🏷️ **NEW: Namespace support for multi-tenant isolation**
- 🌐 CORS enabled
- 📝 Process management (start, stop, restart, reload, delete)
- 📊 Process monitoring and status information
- 📋 Log retrieval and streaming

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- [PM2](https://pm2.keymetrics.io/) installed globally (`npm install -g pm2`)

## Installation

### Option 1: From Source

1. Clone the repository:
```sh
git clone https://github.com/roopen219/pm2-rest-api.git
cd pm2-rest-api
```

2. Install dependencies:
```sh
bun install
```

3. Create a `.env` file in the root directory:
```sh
API_TOKEN=your-secure-token-here
PORT=3000  # Optional, defaults to 3000
```

### Option 2: Using Pre-built Releases

1. Go to the [Releases](https://github.com/roopen219/pm2-rest-api/releases) page
2. Download the appropriate executable for your platform:
   - For macOS (ARM64): `pm2-rest-api-v<version>` (e.g., `pm2-rest-api-v1.0.0`)
   - For Linux (x64): `pm2-rest-api-linux-v<version>` (e.g., `pm2-rest-api-linux-v1.0.0`)
3. Make the file executable:
```sh
# For macOS
chmod +x pm2-rest-api-v<version>

# For Linux
chmod +x pm2-rest-api-linux-v<version>
```
4. Create a `.env` file in the same directory as the executable:
```sh
API_TOKEN=your-secure-token-here
PORT=3000  # Optional, defaults to 3000
```

Note: The release files follow the naming convention `pm2-rest-api-v<version>` for macOS and `pm2-rest-api-linux-v<version>` for Linux, where `<version>` matches the release tag (e.g., v1.0.0). This is different from the local build output names which remain as `pm2-rest-api` and `pm2-rest-api-linux` respectively.

## Running the Application

### Development Mode
```sh
bun run dev
```

The server will start at http://localhost:3000

### Standalone Executable

You can either use the pre-built releases or build the executable yourself:

#### Building from Source

##### For macOS (ARM64)
```sh
bun run build
```
This will create a `pm2-rest-api` executable in the root directory.

##### For Linux (x64)
```sh
bun run build-linux
```
This will create a `pm2-rest-api-linux` executable in the root directory.

#### Running the Executable

1. Run the executable:
```sh
# For macOS
./pm2-rest-api

# For Linux
./pm2-rest-api-linux
```

The server will start at http://localhost:3000 (or the port specified in your .env file).

## API Endpoints

All endpoints are prefixed with `/api/pm2` and require Bearer token authentication.

### Namespace Feature

The API now supports namespaces for multi-tenant isolation. See [NAMESPACE_FEATURE.md](./NAMESPACE_FEATURE.md) for detailed documentation.

**Quick Start:**
1. Use the root token to create namespace tokens: `POST /api/namespace`
2. Use namespace tokens to manage isolated PM2 processes
3. Each namespace token can only access processes within its namespace

### Authentication
Include your API token in the request header:
```
Authorization: Bearer your-secure-token-here
```

### Process Identification
All endpoints that require a process identifier (`:name` in the URL) can use either:
- The process name (as specified when starting the process)
- The PM2 process ID (numeric ID assigned by PM2)

For example, both of these will work:
```http
GET /api/pm2/my-app
GET /api/pm2/0
```

### Available Endpoints

#### List All Processes
```http
GET /api/pm2
```
Returns a list of all PM2 processes.

#### Get Process Details
```http
GET /api/pm2/:name
```
Returns detailed information about a specific process.

#### Start a New Process
```http
POST /api/pm2
Content-Type: application/json

{
  "name": "my-app",
  "script": "./app.js",
  "instances": 1,
  "exec_mode": "fork"
}
```
Starts a new PM2 process with the specified configuration.

#### Stop a Process
```http
POST /api/pm2/:name/stop
```
Stops the specified process.

#### Restart a Process
```http
POST /api/pm2/:name/restart
```
Restarts the specified process.

#### Reload a Process
```http
POST /api/pm2/:name/reload
```
Reloads the specified process (zero-downtime reload).

#### Delete a Process
```http
DELETE /api/pm2/:name
```
Deletes the specified process from PM2.

#### Get Process Logs
```http
GET /api/pm2/:name/logs?lines=100
```
Retrieves the last N lines of logs for the specified process.

#### Stream Process Logs
```http
GET /api/pm2/:name/logs/stream
```
Streams real-time logs for the specified process using Server-Sent Events (SSE).

### Health Check
```http
GET /
```
Returns the API health status.

## Error Handling

All endpoints return appropriate HTTP status codes and error messages in the following format:
```json
{
  "error": "Error message description"
}
```

## Development

- `bun run dev` - Start development server with hot reload
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix ESLint issues
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting
- `bun run build` - Build for macOS ARM64
- `bun run build-linux` - Build for Linux x64

## Security

- All API endpoints are protected with Bearer token authentication
- CORS is enabled for cross-origin requests
- Secure headers are implemented for enhanced security

## License

MIT
