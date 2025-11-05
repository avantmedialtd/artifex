import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractProposalTitle } from './titleExtractor';

/**
 * Unit tests for titleExtractor
 *
 * Note: These tests can be run using a test framework like Mocha or Jest.
 * To run manually, execute: node -r ts-node/register titleExtractor.test.ts
 */

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

// Helper to create temporary proposal file
function createTempProposal(content: string): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'titleExtractor-test-'));
    const proposalPath = path.join(tmpDir, 'proposal.md');
    fs.writeFileSync(proposalPath, content, 'utf-8');
    return proposalPath;
}

// Helper to clean up temp file
function cleanupTempProposal(proposalPath: string) {
    const tmpDir = path.dirname(proposalPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Test: Extract title from standard format
test('extracts title from standard format', () => {
    const proposalPath = createTempProposal('# Add New Feature\n\nThis proposal describes...');
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, 'Add New Feature');
    cleanupTempProposal(proposalPath);
});

// Test: Extract title and strip "Proposal: " prefix
test('strips "Proposal: " prefix', () => {
    const proposalPath = createTempProposal(
        '# Proposal: Fix Authentication Bug\n\nThis proposal describes...',
    );
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, 'Fix Authentication Bug');
    cleanupTempProposal(proposalPath);
});

// Test: Extract title with case-insensitive "Proposal: " prefix
test('handles case-insensitive "Proposal: " prefix', () => {
    const proposalPath = createTempProposal(
        '# proposal: Improve Database Performance\n\nThis proposal describes...',
    );
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, 'Improve Database Performance');
    cleanupTempProposal(proposalPath);
});

// Test: Handle missing file
test('returns null when file is missing', () => {
    const title = extractProposalTitle('/nonexistent/path/proposal.md');
    assert.strictEqual(title, null);
});

// Test: Handle empty first line
test('returns null when first line is empty', () => {
    const proposalPath = createTempProposal('\n# Title on second line');
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, null);
    cleanupTempProposal(proposalPath);
});

// Test: Handle multiple # characters
test('strips multiple # characters', () => {
    const proposalPath = createTempProposal('### Deep Heading Title');
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, 'Deep Heading Title');
    cleanupTempProposal(proposalPath);
});

// Test: Handle whitespace around title
test('trims whitespace around title', () => {
    const proposalPath = createTempProposal('#   Title with Spaces   ');
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, 'Title with Spaces');
    cleanupTempProposal(proposalPath);
});

// Test: Return null for empty title after processing
test('returns null for empty title after processing', () => {
    const proposalPath = createTempProposal('#   ');
    const title = extractProposalTitle(proposalPath);
    assert.strictEqual(title, null);
    cleanupTempProposal(proposalPath);
});

console.log('\nAll tests completed!');
