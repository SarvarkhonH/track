#!/usr/bin/env node
/**
 * Smoke Test Script
 * Verifies that the local backend at http://localhost:3000 is reachable
 * and responds to basic API calls.
 */

const API_BASE = 'http://localhost:3000/api';

const endpoints = {
  SHTABS: `${API_BASE}/v1/shtabs`,
  USERS: `${API_BASE}/v1/users`,
  LOGIN: `${API_BASE}/v1/users/login`,
};

async function test(name, url, options = {}) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log(`   ✅ Status: ${response.status} ${response.statusText}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 Smoke Test Suite for Geo Tracker API');
  console.log(`📍 Backend: ${API_BASE}\n`);

  const results = {
    passed: 0,
    failed: 0,
  };

  // Test SHTABS endpoint
  if (await test('GET /v1/shtabs', endpoints.SHTABS)) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test USERS endpoint
  if (await test('GET /v1/users', endpoints.USERS)) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test LOGIN endpoint (POST, will fail without credentials but endpoint exists)
  if (await test('POST /v1/users/login', endpoints.LOGIN, { method: 'POST' })) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    console.log(
      '\n⚠️  Some endpoints failed. Ensure your backend is running at http://localhost:3000\n'
    );
    process.exit(1);
  } else {
    console.log('\n✨ All tests passed! Backend is reachable.\n');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
