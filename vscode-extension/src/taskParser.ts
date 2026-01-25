import * as path from 'path';
import * as vscode from 'vscode';
import { ChangeData, Section, Task, WorkspaceFolderRef } from './types';
import { extractProposalTitle } from './titleExtractor';

/**
 * Parse a tasks.md file and extract structured task data.
 *
 * @param filePath - Path to the tasks.md file
 * @returns Parsed task data with sections and completion counts
 */
export async function parseTasksFile(filePath: string): Promise<{
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}> {
    try {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf-8');
        const lines = text.split('\n');

        const sections: Section[] = [];
        let currentSection: Section | null = null;
        let totalTasks = 0;
        let completedTasks = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lineNumber = lineIndex + 1; // 1-indexed line numbers

            // Match section headers (## Header)
            const sectionMatch = line.match(/^## (.+)$/);
            if (sectionMatch) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: sectionMatch[1].trim(),
                    tasks: [],
                };
                continue;
            }

            // Match task items (- [ ] or - [x])
            const taskMatch = line.match(/^(\s*)- \[([ xX])\] (.+)$/);
            if (taskMatch) {
                const [, indentStr, checkbox, text] = taskMatch;
                const indent = indentStr.length;
                const isCompleted = checkbox.toLowerCase() === 'x';

                const task: Task = {
                    text: text.trim(),
                    completed: isCompleted,
                    indent,
                    lineNumber,
                };

                if (currentSection) {
                    currentSection.tasks.push(task);
                }

                totalTasks++;
                if (isCompleted) {
                    completedTasks++;
                }
            }
        }

        // Push the last section
        if (currentSection) {
            sections.push(currentSection);
        }

        return { sections, totalTasks, completedTasks };
    } catch (error) {
        // If file doesn't exist or can't be read, return empty data
        console.error(`Error parsing tasks file ${filePath}:`, error);
        return { sections: [], totalTasks: 0, completedTasks: 0 };
    }
}

/**
 * Get all active change directories (excluding archive)
 *
 * @param workspaceRoot - The workspace root path
 * @returns Array of change directory names
 */
export async function getActiveChanges(workspaceRoot: string): Promise<string[]> {
    try {
        const changesDir = path.join(workspaceRoot, 'openspec', 'changes');
        const uri = vscode.Uri.file(changesDir);
        const entries = await vscode.workspace.fs.readDirectory(uri);

        return entries
            .filter(([name, type]) => type === vscode.FileType.Directory && name !== 'archive')
            .map(([name]) => name);
    } catch (error) {
        console.error('Error reading changes directory:', error);
        return [];
    }
}

/**
 * Get task data for a specific change
 *
 * @param workspaceRoot - The workspace root path
 * @param changeId - The change directory name
 * @param workspaceFolder - Reference to the workspace folder this change belongs to
 * @returns ChangeData with parsed tasks
 */
export async function getChangeData(
    workspaceRoot: string,
    changeId: string,
    workspaceFolder: WorkspaceFolderRef,
): Promise<ChangeData> {
    const tasksFilePath = path.join(workspaceRoot, 'openspec', 'changes', changeId, 'tasks.md');
    const { sections, totalTasks, completedTasks } = await parseTasksFile(tasksFilePath);

    // Extract title from proposal.md
    const proposalPath = path.join(workspaceRoot, 'openspec', 'changes', changeId, 'proposal.md');
    const title = extractProposalTitle(proposalPath);

    return {
        changeId,
        title: title || undefined,
        sections,
        totalTasks,
        completedTasks,
        workspaceFolder,
    };
}

/**
 * Get task data for all active changes in a specific workspace folder
 *
 * @param workspaceRoot - The workspace root path
 * @param workspaceFolder - Reference to the workspace folder
 * @returns Array of ChangeData for all active changes in the workspace folder
 */
export async function getAllChangeData(
    workspaceRoot: string,
    workspaceFolder: WorkspaceFolderRef,
): Promise<ChangeData[]> {
    const changes = await getActiveChanges(workspaceRoot);
    const changeDataPromises = changes.map(changeId =>
        getChangeData(workspaceRoot, changeId, workspaceFolder),
    );
    return Promise.all(changeDataPromises);
}

/**
 * Get task data for all active changes across all workspace folders
 *
 * @returns Array of ChangeData for all active changes across all workspace folders
 */
export async function getAllChangeDataFromAllWorkspaces(): Promise<ChangeData[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
    }

    const allChanges: ChangeData[] = [];

    for (const folder of workspaceFolders) {
        const workspaceRoot = folder.uri.fsPath;
        const changesDir = path.join(workspaceRoot, 'openspec', 'changes');

        // Check if openspec/changes directory exists in this workspace folder
        try {
            const uri = vscode.Uri.file(changesDir);
            await vscode.workspace.fs.stat(uri);

            const workspaceFolderRef: WorkspaceFolderRef = {
                uri: folder.uri.fsPath,
                name: folder.name,
                index: folder.index,
            };

            const changes = await getAllChangeData(workspaceRoot, workspaceFolderRef);
            allChanges.push(...changes);
        } catch {
            // Directory doesn't exist in this workspace folder, skip it
            continue;
        }
    }

    return allChanges;
}

/**
 * Get all workspace folders that contain OpenSpec changes
 *
 * @returns Array of workspace folder references that have openspec/changes directories
 */
export async function getWorkspaceFoldersWithOpenSpec(): Promise<WorkspaceFolderRef[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
    }

    const foldersWithOpenSpec: WorkspaceFolderRef[] = [];

    for (const folder of workspaceFolders) {
        const workspaceRoot = folder.uri.fsPath;
        const changesDir = path.join(workspaceRoot, 'openspec', 'changes');

        try {
            const uri = vscode.Uri.file(changesDir);
            await vscode.workspace.fs.stat(uri);

            foldersWithOpenSpec.push({
                uri: folder.uri.fsPath,
                name: folder.name,
                index: folder.index,
            });
        } catch {
            // Directory doesn't exist in this workspace folder, skip it
            continue;
        }
    }

    return foldersWithOpenSpec;
}
