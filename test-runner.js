const fs = require('fs');
const path = require('path');

// Global test harness for running TypeScript tests compiled to JS
const suites = [];
let currentSuite = null;

global.describe = function (name, fn) {
  const suite = { name, tests: [], beforeEaches: [] };
  suites.push(suite);
  currentSuite = suite;
  fn();
  currentSuite = null;
};

global.beforeEach = function (fn) {
  if (currentSuite) {
    currentSuite.beforeEaches.push(fn);
  }
};

global.it = function (name, fn) {
  if (currentSuite) {
    currentSuite.tests.push({ name, fn });
  }
};

async function runAllTests() {
  console.log('\n========================================');
  console.log('   AI Error Checklister Test Suite');
  console.log('========================================\n');

  const testDir = path.join(__dirname, 'dist', 'test');
  if (!fs.existsSync(testDir)) {
    console.error('Test directory not found:', testDir);
    process.exit(1);
  }

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
  for (const file of files) {
    require(path.join(testDir, file));
  }

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const suite of suites) {
    console.log(`\n  \x1b[1m\x1b[36m${suite.name}\x1b[0m`);
    for (const test of suite.tests) {
      for (const be of suite.beforeEaches) {
        await be();
      }
      try {
        await test.fn();
        console.log(`    \x1b[32m✔\x1b[0m ${test.name}`);
        passed++;
      } catch (err) {
        console.log(`    \x1b[31m✖\x1b[0m ${test.name}`);
        console.error(`      \x1b[31m${err.message}\x1b[0m`);
        if (err.stack) {
          console.error(err.stack.split('\n').slice(1, 4).join('\n'));
        }
        failed++;
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log('\n----------------------------------------');
  console.log(`  Tests: \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m`);
  console.log(`  Total: ${passed + failed} tests (${totalTime}ms)`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});

