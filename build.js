const { execSync } = require('child_process');

try {
    // Run the electron-builder command
    execSync('electron-builder', {
        stdio: 'inherit',
        env: {
            ...process.env,
            CSC_IDENTITY_AUTO_DISCOVERY: 'false' // Disable code signing for testing
        }
    });

    console.log('Build completed successfully.');
} catch (error) {
    console.error('Error during build process:', error);
}
