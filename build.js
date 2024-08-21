// build.js
require('dotenv').config();

const { execSync } = require('child_process');

// Check if environment variables are loaded (debugging)
console.log('Building with environment:', process.env);

// Run the electron-builder command
execSync('electron-builder', { stdio: 'inherit', env: process.env });
