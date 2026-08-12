const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Set dummy API key for offline integration test if not set
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'dummy_test_key_for_offline_validation';
}

const { app } = require('./server');

let server;
const TEST_PORT = 4099;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(resData);
          resolve({ status: res.statusMessage, statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusMessage, statusCode: res.statusCode, text: resData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runIntegrationTests() {
  console.log('====================================================');
  console.log(' RUNNING END-TO-END RAG API INTEGRATION TESTS');
  console.log('====================================================\n');

  server = app.listen(TEST_PORT, () => {
    console.log(`Test server running on port ${TEST_PORT}`);
  });

  try {
    // Test 1: Health Status Endpoint
    console.log('--- 1. Testing GET /api/status ---');
    const statusRes = await request('GET', '/api/status');
    assert.strictEqual(statusRes.statusCode, 200, 'Status should be 200');
    assert.strictEqual(statusRes.data.status, 'online', 'Service must be online');
    assert.strictEqual(statusRes.data.securityFeatures.layer1_querySanitization, 'active');
    assert.strictEqual(statusRes.data.securityFeatures.layer2_contextIsolation, 'active');
    assert.strictEqual(statusRes.data.securityFeatures.layer3_outputValidation, 'active');
    console.log('  [PASS] /api/status returns active security layers and status online.');

    // Test 2: Validation of empty question on /api/ask
    console.log('\n--- 2. Testing POST /api/ask with missing question ---');
    const emptyRes = await request('POST', '/api/ask', {});
    assert.strictEqual(emptyRes.statusCode, 400, 'Should return 400 for empty question');
    console.log('  [PASS] /api/ask correctly rejects missing question payload.');

    console.log('\n====================================================');
    console.log(' ALL INTEGRATION API TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Integration test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runIntegrationTests();
