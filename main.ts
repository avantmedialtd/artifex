import { route } from './router.ts';

// Parse command-line arguments
const args = process.argv.slice(2);

// Route to appropriate command handler
const exitCode = await route(args);
process.exit(exitCode);
