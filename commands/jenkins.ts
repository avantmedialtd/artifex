import { error } from '../utils/output.ts';

interface JenkinsOptions {
    json?: boolean;
    limit?: number;
}

function parseArgs(argv: string[]): {
    subcommand: string;
    args: string[];
    options: JenkinsOptions;
} {
    const args: string[] = [];
    const options: JenkinsOptions = {};

    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];

        if (arg === '--json') {
            options.json = true;
        } else if (arg.startsWith('--')) {
            const key = arg.slice(2) as keyof JenkinsOptions;
            const value = argv[++i];
            if (value === undefined) {
                throw new Error(`Option ${arg} requires a value`);
            }
            if (key === 'limit') {
                options.limit = parseInt(value, 10);
            } else {
                (options as Record<string, string>)[key] = value;
            }
        } else {
            args.push(arg);
        }
        i++;
    }

    const subcommand = args[0] ?? '';
    return { subcommand, args: args.slice(1), options };
}

function showJenkinsHelp(): void {
    console.log(`
Jenkins CLI - Read-only Jenkins build visibility

USAGE:
  af jenkins <command> [arguments] [options]

COMMANDS:
  jobs [folder]                          List jobs (optionally in a folder)
  job <name>                             Get job details and recent builds
  branches <pipeline>                    List branches for a multibranch pipeline
  build <name> [number|latest]           Get build details (default: latest)
  log <name> [number|latest]             Get full console output (default: latest)
  queue                                  List queued build items
  stages <name> [number|latest]          Get pipeline stage breakdown (default: latest)
  stage-log <name> <stage> [number|latest]  Get log for a specific pipeline stage

JOB PATHS:
  Use / to separate folder/pipeline/branch segments.
  Example: my-folder/my-pipeline/feature-branch

OPTIONS:
  --json                    Output as JSON instead of markdown

EXAMPLES:
  af jenkins jobs                              # List all jobs
  af jenkins jobs my-folder                    # List jobs in a folder
  af jenkins job my-app                        # Get job details
  af jenkins branches my-pipeline              # List branch build statuses
  af jenkins build my-app/main                 # Latest build info
  af jenkins build my-app/main 142             # Specific build info
  af jenkins log my-app/main                   # Latest build log
  af jenkins log my-app/main | tail -50        # Last 50 lines of log
  af jenkins queue                             # Show build queue
  af jenkins stages my-app/main                # Pipeline stage breakdown
  af jenkins stage-log my-app/main "Test"      # Log for Test stage
`);
}

export async function handleJenkins(args: string[]): Promise<number> {
    if (args.includes('--help') || args.includes('-h')) {
        showJenkinsHelp();
        return 0;
    }

    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs(args);
    } catch (err) {
        error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    const { subcommand, args: subArgs, options } = parsed;
    const json = options.json ?? false;

    if (!subcommand) {
        showJenkinsHelp();
        return 0;
    }

    const client = await import('../jenkins/lib/client.ts');
    const fmt = await import('../jenkins/lib/formatters.ts');

    try {
        switch (subcommand) {
            case 'jobs': {
                const folder = subArgs[0];
                const data = await client.getJobs(folder);
                fmt.output(json ? data : fmt.formatJobs(data.jobs), json);
                break;
            }

            case 'job': {
                const name = subArgs[0];
                if (!name) {
                    error('Error: Job name required. Usage: af jenkins job <name>');
                    return 1;
                }
                const data = await client.getJob(name);
                fmt.output(json ? data : fmt.formatJob(data), json);
                break;
            }

            case 'branches': {
                const pipeline = subArgs[0];
                if (!pipeline) {
                    error('Error: Pipeline name required. Usage: af jenkins branches <pipeline>');
                    return 1;
                }
                const data = await client.getBranches(pipeline);
                if (!data.jobs?.length) {
                    error('No branches found. Is this a multibranch pipeline?');
                    return 1;
                }
                fmt.output(json ? data : fmt.formatBranches(data.jobs), json);
                break;
            }

            case 'build': {
                const name = subArgs[0];
                if (!name) {
                    error(
                        'Error: Job name required. Usage: af jenkins build <name> [number|latest]',
                    );
                    return 1;
                }
                const buildNumber = subArgs[1];
                const data = await client.getBuild(name, buildNumber);
                fmt.output(json ? data : fmt.formatBuild(data), json);
                break;
            }

            case 'log': {
                const name = subArgs[0];
                if (!name) {
                    error('Error: Job name required. Usage: af jenkins log <name> [number|latest]');
                    return 1;
                }
                const buildNumber = subArgs[1];
                const text = await client.getConsoleOutput(name, buildNumber);
                if (json) {
                    console.log(JSON.stringify({ output: text }));
                } else {
                    process.stdout.write(text);
                }
                break;
            }

            case 'queue': {
                const data = await client.getQueue();
                fmt.output(json ? data : fmt.formatQueue(data), json);
                break;
            }

            case 'stages': {
                const name = subArgs[0];
                if (!name) {
                    error(
                        'Error: Job name required. Usage: af jenkins stages <name> [number|latest]',
                    );
                    return 1;
                }
                const buildNumber = subArgs[1];
                const data = await client.getStages(name, buildNumber);
                fmt.output(json ? data : fmt.formatStages(data), json);
                break;
            }

            case 'stage-log': {
                const name = subArgs[0];
                const stageName = subArgs[1];
                if (!name || !stageName) {
                    error(
                        'Error: Job name and stage name required. Usage: af jenkins stage-log <name> <stage> [number|latest]',
                    );
                    return 1;
                }
                const buildNumber = subArgs[2];
                const data = await client.getStageLog(name, stageName, buildNumber);
                if (json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    process.stdout.write(data.text);
                }
                break;
            }

            default:
                error(`Unknown jenkins command: ${subcommand}`);
                console.error("Run 'af help jenkins' for available subcommands.");
                return 1;
        }
    } catch (err) {
        if (json) {
            console.log(
                JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            );
        } else {
            error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        return 1;
    }

    return 0;
}
