import { existsSync, writeFileSync } from 'node:fs';
import { error, success } from '../utils/output.ts';

/**
 * Docker Compose overlay file content for E2E testing.
 * Adds migrate-seed init container that runs migrations before services start.
 */
const TEST_COMPOSE_CONTENT = `# Docker Compose overlay for E2E testing
# Adds migrate-seed init container that runs migrations before services start
#
# Usage: docker compose -f docker-compose.yml -f docker-compose.test.yml --profile testing up -d --wait

services:
  migrate-seed:
    profiles:
      - testing
    build:
      context: .
      dockerfile: Dockerfile.worker
    command:
      - bun
      - run
      - migrate-and-seed
    working_dir: /code/apps/worker
    restart: "no"
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: postgres
      DB_USER: postgres
      DB_PASSWORD: u7-6wAaIR.2S
      DB_NO_SSL: 1
    networks:
      - app-network

  # Override hosting-server to wait for migrations
  hosting-server:
    depends_on:
      db:
        condition: service_healthy
      migrate-seed:
        condition: service_completed_successfully

  # Override e2e to wait for migrations
  e2e:
    depends_on:
      db:
        condition: service_healthy
      hosting-server:
        condition: service_healthy
      migrate-seed:
        condition: service_completed_successfully
    volumes:
      - ./e2e/tests/visual-baselines:/workspace/tests/visual-baselines
`;

const OUTPUT_FILE = 'docker-compose.test.yml';

/**
 * Handle the 'scaffold test-compose' command.
 * Generates a docker-compose.test.yml file for E2E testing.
 *
 * @returns Exit code (0 for success, 1 for error)
 */
export function handleScaffoldTestCompose(): number {
    // Check if file already exists
    if (existsSync(OUTPUT_FILE)) {
        error(`${OUTPUT_FILE} already exists`);
        return 1;
    }

    // Write the file
    writeFileSync(OUTPUT_FILE, TEST_COMPOSE_CONTENT);
    success(`Created ${OUTPUT_FILE}`);
    return 0;
}

/**
 * Handle the 'scaffold' command.
 * Routes to the appropriate subcommand handler.
 *
 * @param args - Command arguments (subcommand and additional args)
 * @returns Exit code (0 for success, 1 for error)
 */
export function handleScaffold(args: string[]): number {
    const [subcommand] = args;

    if (!subcommand) {
        error('Error: scaffold command requires a subcommand');
        console.error("Run 'af help scaffold' for more information.");
        return 1;
    }

    if (subcommand === 'test-compose') {
        return handleScaffoldTestCompose();
    }

    error(`Error: Unknown scaffold subcommand: ${subcommand}`);
    console.error("Run 'af help scaffold' for available subcommands.");
    return 1;
}
