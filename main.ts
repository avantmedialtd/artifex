import { route } from './router.ts';
import { loadEnv } from './utils/env.ts';

// Load environment variables from .env in current working directory
loadEnv();

// Parse command-line arguments
const args = process.argv.slice(2);

// Route to appropriate command handler
const exitCode = await route(args);
process.exitCode = exitCode;
