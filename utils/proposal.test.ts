import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { extractProposalTitle, getLatestChangeId } from './proposal.ts';

describe('extractProposalTitle', () => {
    const testDir = 'test/tmp/proposal-test';
    const testFile = `${testDir}/proposal.md`;

    beforeEach(() => {
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it('should extract title from "# Proposal: Title" format', () => {
        writeFileSync(testFile, '# Proposal: Show help page if no argument is provided\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Show help page if no argument is provided');
    });

    it('should extract title from "# Title" format', () => {
        writeFileSync(testFile, '# Auto-commit proposals after creation\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Auto-commit proposals after creation');
    });

    it('should handle extra whitespace', () => {
        writeFileSync(testFile, '#   Proposal:   Extra whitespace title   \n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Extra whitespace title');
    });

    it('should handle multiple # symbols', () => {
        writeFileSync(testFile, '### Proposal: Multiple hash marks\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Multiple hash marks');
    });

    it('should handle case-insensitive "Proposal:" prefix', () => {
        writeFileSync(testFile, '# proposal: lowercase prefix\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('lowercase prefix');
    });

    it('should handle "PROPOSAL:" in uppercase', () => {
        writeFileSync(testFile, '# PROPOSAL: Uppercase prefix\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Uppercase prefix');
    });

    it('should return null for empty file', () => {
        writeFileSync(testFile, '');
        const title = extractProposalTitle(testFile);
        expect(title).toBe(null);
    });

    it('should return null for file with only whitespace', () => {
        writeFileSync(testFile, '   \n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe(null);
    });

    it('should return null for non-existent file', () => {
        const title = extractProposalTitle('non-existent-file.md');
        expect(title).toBe(null);
    });

    it('should handle title without # prefix', () => {
        writeFileSync(testFile, 'Proposal: Title without hash\n');
        const title = extractProposalTitle(testFile);
        expect(title).toBe('Title without hash');
    });
});

describe('getLatestChangeId', () => {
    const testDir = 'test/tmp/changes-test/openspec/changes';

    beforeEach(() => {
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync('test/tmp/changes-test', { recursive: true, force: true });
    });

    it('should return the most recently created change directory', async () => {
        // Create multiple change directories with different timestamps
        mkdirSync(`${testDir}/older-change`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        mkdirSync(`${testDir}/newer-change`);

        const latestId = getLatestChangeId(testDir);
        expect(latestId).toBe('newer-change');
    });

    it('should return null when changes directory does not exist', () => {
        rmSync('test/tmp/changes-test', { recursive: true, force: true });
        const latestId = getLatestChangeId('test/tmp/changes-test/openspec/changes');
        expect(latestId).toBe(null);
    });

    it('should return null when changes directory is empty', () => {
        const latestId = getLatestChangeId(testDir);
        expect(latestId).toBe(null);
    });
});
