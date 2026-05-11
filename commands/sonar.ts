/**
 * `af sonar` — read-only inspection of SonarQube quality gates, issues,
 * measures, and pull requests on a self-hosted SonarQube instance.
 *
 * Configuration: SONAR_TOKEN (required), SONAR_BASE_URL (env or
 * sonar-project.properties), project key (--project flag or
 * sonar-project.properties). See sonar/lib/config.ts.
 *
 * PR auto-detection (when no id is passed) calls into bitbucket/lib/ via
 * sonar/lib/pr-detect.ts.
 */

import chalk from 'chalk';
import { error } from '../utils/output.ts';
import {
    buildDashboardUrl,
    DEFAULT_PR_METRICS,
    getIssues,
    getMeasures,
    getQualityGate,
    listPullRequests,
} from '../sonar/lib/client.ts';
import { getSonarConfig, SonarConfigError, type SonarConfig } from '../sonar/lib/config.ts';
import {
    detectPullRequestForCurrentBranch,
    explainDetectFailure,
    type DetectedPR,
} from '../sonar/lib/pr-detect.ts';
import {
    formatGateSummary,
    formatIssuesHeading,
    formatIssuesList,
    formatMeasures,
    formatPrList,
    formatTopIssues,
    summarizeIssues,
    totalFromIssuesResponse,
} from '../sonar/lib/formatters.ts';
import {
    SonarPRNotAnalyzedError,
    SonarProjectNotFoundError,
    SonarRequestError,
} from '../sonar/lib/request.ts';
import type {
    SonarIssue,
    SonarIssuesResponse,
    SonarMeasuresResponse,
    SonarPullRequestsResponse,
    SonarQualityGateResponse,
} from '../sonar/lib/types.ts';

interface SonarOptions {
    json: boolean;
    issues: boolean;
    project?: string;
}

interface ParsedArgs {
    subcommand: string;
    positional: string[];
    options: SonarOptions;
}

function parseArgs(argv: string[]): ParsedArgs {
    const positional: string[] = [];
    const options: SonarOptions = { json: false, issues: false };

    let i = 0;
    while (i < argv.length) {
        const a = argv[i];
        if (a === '--json') {
            options.json = true;
        } else if (a === '--issues') {
            options.issues = true;
        } else if (a === '--project') {
            const value = argv[++i];
            if (value === undefined) {
                throw new Error('--project requires a value');
            }
            options.project = value;
        } else if (a.startsWith('--project=')) {
            options.project = a.slice('--project='.length);
        } else if (a.startsWith('--')) {
            throw new Error(`Unknown option: ${a}`);
        } else {
            positional.push(a);
        }
        i++;
    }

    const subcommand = positional[0] ?? '';
    return { subcommand, positional: positional.slice(1), options };
}

function showHelp(): void {
    console.log(`
SonarQube CLI - Read-only SonarQube inspection

USAGE:
  af sonar <command> [arguments] [options]

COMMANDS:
  pr [pr-id]            Quality gate, top new issues, and key measures for a PR.
                        Auto-detects the PR id from the current branch's open
                        Bitbucket pull request when omitted.
  pr [pr-id] --issues   Show the full list of new issues on the PR.
  gate                  Quality gate status for the project's main branch.
  prs                   List pull requests SonarQube has analyzed for the project.

OPTIONS:
  --project KEY         Override the project key (default: sonar.projectKey
                        from sonar-project.properties).
  --json                Output raw API responses as JSON.

CONFIGURATION (environment variables):
  SONAR_TOKEN           Required. User token for SonarQube.
  SONAR_BASE_URL        Optional. Falls back to sonar.host.url in
                        sonar-project.properties.

EXAMPLES:
  af sonar pr 42                  # gate + top issues + measures for PR 42
  af sonar pr                     # auto-detect PR id from current branch
  af sonar pr 42 --issues         # full list of new issues for PR 42
  af sonar gate                   # main branch gate
  af sonar prs                    # all PRs SonarQube knows about
  af sonar pr 42 --json           # raw JSON for scripting
`);
}

function printError(message: string, json: boolean): void {
    if (json) {
        console.log(JSON.stringify({ error: message }));
    } else {
        error(message);
    }
}

/**
 * Resolve the PR id: explicit positional arg wins; otherwise auto-detect.
 * Returns a numeric id on success, null on failure (after printing an error).
 */
async function resolvePullRequestId(
    explicit: string | undefined,
    json: boolean,
): Promise<string | null> {
    if (explicit) {
        return explicit;
    }
    const result: DetectedPR = await detectPullRequestForCurrentBranch();
    if (result.kind === 'single') {
        return String(result.id);
    }
    printError(explainDetectFailure(result), json);
    return null;
}

async function handlePr(
    config: SonarConfig,
    prArg: string | undefined,
    options: SonarOptions,
): Promise<number> {
    const prId = await resolvePullRequestId(prArg, options.json);
    if (prId === null) return 1;

    const [gate, issuesResponse, measures] = await Promise.all([
        getQualityGate(config, { pullRequest: prId }),
        getIssues(config, { pullRequest: prId, pageSize: options.issues ? 100 : 100 }),
        getMeasures(config, {
            pullRequest: prId,
            metricKeys: DEFAULT_PR_METRICS,
        }),
    ]);

    if (options.json) {
        const payload = {
            project: config.projectKey,
            pullRequest: prId,
            gate,
            issues: issuesResponse,
            measures,
            dashboardUrl: buildDashboardUrl(config.baseUrl, config.projectKey, prId),
        };
        console.log(JSON.stringify(payload, null, 2));
    } else {
        renderPrView({
            config,
            prId,
            gate,
            issuesResponse,
            measures,
            showAllIssues: options.issues,
        });
    }

    return gate.projectStatus.status === 'ERROR' ? 1 : 0;
}

interface PrViewArgs {
    config: SonarConfig;
    prId: string;
    gate: SonarQualityGateResponse;
    issuesResponse: SonarIssuesResponse;
    measures: SonarMeasuresResponse;
    showAllIssues: boolean;
}

function renderPrView(args: PrViewArgs): void {
    const { config, prId, gate, issuesResponse, measures, showAllIssues } = args;
    const issues: SonarIssue[] = issuesResponse.issues;

    console.log('');
    console.log(formatGateSummary(gate, { projectKey: config.projectKey, pullRequest: prId }));

    console.log('');
    console.log(formatIssuesHeading(summarizeIssues(issues)));
    if (issues.length > 0) {
        console.log('');
        if (showAllIssues) {
            console.log(formatIssuesList(issues));
        } else {
            console.log(formatTopIssues(issues, 4, totalFromIssuesResponse(issuesResponse)));
        }
    }

    const measuresOut = formatMeasures(measures);
    if (measuresOut) {
        console.log('');
        console.log('  Measures:');
        console.log(measuresOut);
    }

    console.log('');
    console.log(
        `  ${chalk.gray('→')} ${buildDashboardUrl(config.baseUrl, config.projectKey, prId)}`,
    );
    console.log('');
}

async function handleGate(config: SonarConfig, options: SonarOptions): Promise<number> {
    const gate = await getQualityGate(config);
    if (options.json) {
        console.log(JSON.stringify(gate, null, 2));
    } else {
        console.log('');
        console.log(formatGateSummary(gate, { projectKey: config.projectKey }));
        console.log('');
        console.log(`  ${chalk.gray('→')} ${buildDashboardUrl(config.baseUrl, config.projectKey)}`);
        console.log('');
    }
    return gate.projectStatus.status === 'ERROR' ? 1 : 0;
}

async function handlePrs(config: SonarConfig, options: SonarOptions): Promise<number> {
    const prs: SonarPullRequestsResponse = await listPullRequests(config);
    if (options.json) {
        console.log(JSON.stringify(prs, null, 2));
    } else {
        console.log('');
        console.log(formatPrList(prs));
        console.log('');
    }
    return 0;
}

export async function handleSonar(args: string[]): Promise<number> {
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return 0;
    }

    let parsed: ParsedArgs;
    try {
        parsed = parseArgs(args);
    } catch (err) {
        error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    const { subcommand, positional, options } = parsed;

    if (!subcommand) {
        showHelp();
        return 0;
    }

    let config: SonarConfig;
    try {
        config = getSonarConfig({ projectFlag: options.project });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof SonarConfigError) {
            printError(message, options.json);
        } else {
            printError(`Error: ${message}`, options.json);
        }
        return 1;
    }

    try {
        switch (subcommand) {
            case 'pr':
                return await handlePr(config, positional[0], options);
            case 'gate':
                return await handleGate(config, options);
            case 'prs':
                return await handlePrs(config, options);
            default:
                error(`Unknown sonar subcommand: ${subcommand}`);
                console.error("Run 'af sonar --help' for available subcommands.");
                return 1;
        }
    } catch (err) {
        const message =
            err instanceof SonarPRNotAnalyzedError ||
            err instanceof SonarProjectNotFoundError ||
            err instanceof SonarRequestError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err);
        printError(message, options.json);
        return 1;
    }
}
