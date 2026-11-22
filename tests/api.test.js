const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test environment
const testDbPath = path.join(__dirname, 'test_taskmaster.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
process.env.DB_PATH = testDbPath;
process.env.PORT = '5055';

const app = require('../src/app');
let server;
let baseUrl;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }

    req.end();
  });
}

describe('TaskMaster End-to-End API Test Suite', () => {
  let userToken1 = null;
  let user1Id = null;
  let userToken2 = null;
  let user2Id = null;
  let projectId = null;
  let taskId = null;

  before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(5055, resolve));
    baseUrl = 'http://localhost:5055';
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  test('GET /health returns 200 UP', async () => {
    const res = await makeRequest('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'UP');
  });

  test('POST /api/auth/register creates user Alice', async () => {
    const res = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'password123',
        bio: 'Lead Engineer'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    userToken1 = res.body.data.token;
    user1Id = res.body.data.user.id;
  });

  test('POST /api/auth/register creates user Bob', async () => {
    const res = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Bob Jones',
        email: 'bob@example.com',
        password: 'password123',
        bio: 'Backend Developer'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    userToken2 = res.body.data.token;
    user2Id = res.body.data.user.id;
  });

  test('POST /api/auth/login logs in user Alice', async () => {
    const res = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'alice@example.com',
        password: 'password123'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
  });

  test('GET /api/auth/profile returns authenticated user profile', async () => {
    const res = await makeRequest('/api/auth/profile', {
      headers: { Authorization: `Bearer ${userToken1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.user.email, 'alice@example.com');
  });

  test('POST /api/projects creates a project with Alice as OWNER', async () => {
    const res = await makeRequest('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken1}` },
      body: {
        name: 'Alpha Core Platform',
        description: 'Next-gen backend infrastructure'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    projectId = res.body.data.project.id;
  });

  test('POST /api/projects/:id/members adds Bob to the project', async () => {
    const res = await makeRequest(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken1}` },
      body: {
        email: 'bob@example.com',
        role: 'MEMBER'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
  });

  test('POST /api/tasks/ai-generate synthesizes task description', async () => {
    const res = await makeRequest('/api/tasks/ai-generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken1}` },
      body: {
        title: 'Implement OAuth2 Authorization Server',
        context: 'Support JWT access tokens and refresh token rotation.'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.generated_description.includes('Objective'));
  });

  test('POST /api/tasks creates a task and assigns to Bob', async () => {
    const res = await makeRequest('/api/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken1}` },
      body: {
        title: 'Design distributed database schema',
        description: 'Partition schemas into isolated shards with replication.',
        priority: 'HIGH',
        status: 'TODO',
        due_date: '2026-12-31',
        project_id: projectId,
        assigned_to: user2Id
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    taskId = res.body.data.task.id;
    assert.strictEqual(res.body.data.task.assigned_to, user2Id);
  });

  test('GET /api/tasks filters by assigned_to=me for Bob', async () => {
    const res = await makeRequest('/api/tasks?assigned_to=me', {
      headers: { Authorization: `Bearer ${userToken2}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.data.tasks[0].id, taskId);
  });

  test('GET /api/tasks searches by keyword in title/desc', async () => {
    const res = await makeRequest('/api/tasks?search=distributed', {
      headers: { Authorization: `Bearer ${userToken1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 1);
  });

  test('PUT /api/tasks/:id updates status to IN_PROGRESS', async () => {
    const res = await makeRequest(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken2}` },
      body: {
        status: 'IN_PROGRESS'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.task.status, 'IN_PROGRESS');
  });

  test('POST /api/tasks/:id/comments adds comment from Bob', async () => {
    const res = await makeRequest(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken2}` },
      body: {
        content: 'Initial schema draft completed and verified.'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.comment.content, 'Initial schema draft completed and verified.');
  });

  test('GET /api/tasks/:id/ai-summary summarizes task and activity', async () => {
    const res = await makeRequest(`/api/tasks/${taskId}/ai-summary`, {
      headers: { Authorization: `Bearer ${userToken1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.summary.executiveSummary.includes('IN_PROGRESS'));
  });

  test('GET /api/notifications returns assigned notification for Bob', async () => {
    const res = await makeRequest('/api/notifications', {
      headers: { Authorization: `Bearer ${userToken2}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.notifications.length >= 1);
  });
});
