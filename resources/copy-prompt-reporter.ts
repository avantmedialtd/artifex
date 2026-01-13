import type {
    FullConfig,
    FullResult,
    Reporter,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';

interface TestInfo {
    title: string;
    file: string;
    line: number;
    column: number;
    duration: number;
    status: string;
    error?: TestResult['error'];
    stdout: TestResult['stdout'];
    stderr: TestResult['stderr'];
    steps: TestResult['steps'];
    attachments: TestResult['attachments'];
}

class CopyPromptReporter implements Reporter {
    private config: FullConfig | null = null;
    private suite: Suite | null = null;
    private results: {
        passed: TestInfo[];
        failed: TestInfo[];
        skipped: TestInfo[];
        timedOut: TestInfo[];
    } = {
        passed: [],
        failed: [],
        skipped: [],
        timedOut: [],
    };
    private totalTests = 0;
    private completedTests = 0;
    private currentTest: string | null = null;
    private startTime: number | null = null;

    // Convert Docker container paths to host paths for AI agent access
    private toHostPath(containerPath: string | undefined): string | undefined {
        if (!containerPath) return containerPath;
        return containerPath.replace(/^\/workspace\//, './');
    }

    onBegin(config: FullConfig, suite: Suite): void {
        this.config = config;
        this.suite = suite;
        this.startTime = Date.now();

        const { total, willRun, willSkip } = this.countTests(suite);
        this.totalTests = total;

        console.log('\n🎭 Playwright Test Run Started');
        if (willSkip > 0) {
            console.log(
                `📊 Running ${willRun} test${willRun === 1 ? '' : 's'} (${willSkip} skipped)\n`,
            );
        } else {
            console.log(`📊 Running ${total} test${total === 1 ? '' : 's'}\n`);
        }
    }

    private countTests(suite: Suite): { total: number; willRun: number; willSkip: number } {
        let total = 0;
        let willSkip = 0;
        for (const test of suite.allTests()) {
            total++;
            // Tests with expectedStatus 'skipped' won't run
            if (test.expectedStatus === 'skipped') {
                willSkip++;
            }
        }
        return { total, willRun: total - willSkip, willSkip };
    }

    onTestBegin(test: TestCase, _result: TestResult): void {
        this.currentTest = test.title;
        // this.updateProgressBar();
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const testInfo: TestInfo = {
            title: test.title,
            file: test.location.file,
            line: test.location.line,
            column: test.location.column,
            duration: result.duration,
            status: result.status,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr,
            steps: result.steps,
            attachments: result.attachments,
        };

        if (result.status === 'passed') {
            this.results.passed.push(testInfo);
        } else if (result.status === 'failed') {
            this.results.failed.push(testInfo);
        } else if (result.status === 'timedOut') {
            this.results.timedOut.push(testInfo);
        } else {
            this.results.skipped.push(testInfo);
        }

        this.completedTests++;
        this.currentTest = null;
        // this.updateProgressBar();

        // Show test result immediately after a brief pause for progress bar visibility
        setTimeout(() => {
            const status =
                result.status === 'passed'
                    ? '✅'
                    : result.status === 'failed'
                      ? '❌'
                      : result.status === 'timedOut'
                        ? '⏲️'
                        : '⏭️';
            const duration = result.duration ? `(${result.duration}ms)` : '';
            const suiteName = test.parent.title ? `${test.parent.title} › ` : '';
            if (status === '✅') {
                console.log(`\r\x1b[K${status} ${suiteName}${test.title} ${duration}`);
            } else if (status === '❌') {
                console.log(`\r\x1b[K${status} ${suiteName}${test.title} ${duration}`);
            } else if (status === '⏲️') {
                console.log(
                    `\r\x1b[K\x1b[31m${status} Timeout: ${suiteName}${test.title} ${duration}\x1b[0m`,
                );
            } else {
                console.log(`\r\x1b[K${status} ${suiteName}${test.title} ${duration}`);
            }
            // If test failed, show brief error info
            if (result.status !== 'passed' && result.status !== 'skipped') {
                const t: TestInfo = {
                    title: test.title,
                    file: test.location.file,
                    line: test.location.line,
                    column: test.location.column,
                    duration: result.duration,
                    status: result.status,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    steps: result.steps,
                    attachments: result.attachments,
                };
                const banner = result.status === 'timedOut' ? 'Timeout Details' : 'Failure Details';
                console.log(
                    `   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ${banner} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                );
                console.log(`   📁 File: ${this.getRelativePath(t.file)}:${t.line}:${t.column}`);
                if (typeof t.duration === 'number') console.log(`   ⏱️  Duration: ${t.duration}ms`);

                if (t.error) {
                    const errMsg = t.error.message
                        ? t.error.message.split('\n')[0]
                        : 'Unknown error';
                    console.log(`   💥 Error: ${errMsg}`);

                    if (t.error.stack) {
                        const stackLines = t.error.stack.split('\n');
                        const relevantStack = stackLines
                            .filter(line => line.includes('.spec.') || line.includes('test-'))
                            .slice(0, 3);

                        if (relevantStack.length > 0) {
                            console.log('   📍 Stack trace:');
                            relevantStack.forEach(line => {
                                const cleanLine = line.trim().replace(/^\s*at\s*/, '');
                                console.log(`      ${cleanLine}`);
                            });
                        }

                        // Extract specific location within the failing spec file
                        const rel = this.getRelativePath(t.file);
                        const relevantLine = stackLines.find(line => line.includes(rel));
                        if (relevantLine) {
                            const loc = relevantLine.match(/:(\d+):(\d+)/);
                            if (loc)
                                console.log(`   📌 Location: Line ${loc[1]}, Column ${loc[2]}`);
                        }
                    }
                }

                // Extract failed steps (if any)
                if (Array.isArray(t.steps) && t.steps.length > 0) {
                    const failedSteps = t.steps.filter(s => s && s.error);
                    if (failedSteps.length > 0) {
                        console.log('   🔍 Failed steps:');
                        failedSteps.forEach(s => {
                            console.log(`      • ${s.title}`);
                            if (s.error?.message) console.log(`        Error: ${s.error.message}`);
                        });
                    }

                    // Show the last few steps for quick context
                    console.log('   🔄 Test execution flow:');
                    t.steps.slice(-3).forEach(s => {
                        const st = s.error ? '❌' : '✅';
                        const d = typeof s.duration === 'number' ? `${s.duration}ms` : '—';
                        console.log(`      ${st} ${s.title} (${d})`);
                        if (s.error?.message) console.log(`         💥 ${s.error.message}`);
                    });
                }

                // Show stdout/stderr if available
                if (Array.isArray(t.stdout) && t.stdout.length > 0) {
                    console.log(`   📤 Output: ${t.stdout.join(' ')}`);
                }
                if (Array.isArray(t.stderr) && t.stderr.length > 0) {
                    console.log(`   ❗ Errors: ${t.stderr.join(' ')}`);
                }

                // Show attachments (screenshots, traces, etc.)
                if (Array.isArray(t.attachments) && t.attachments.length > 0) {
                    console.log('   📎 Attachments (use Read tool to view screenshots):');
                    t.attachments.forEach(att => {
                        console.log(`      • ${att.name}: ${att.contentType}`);
                        if (att.path) console.log(`        Path: ${this.toHostPath(att.path)}`);
                    });
                }

                console.log(
                    '   💡 Tip: Read error-context.md for DOM snapshot, or trace.zip for full trace.',
                );
                console.log(
                    '   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                );
            }
        }, 100);
    }

    private updateProgressBar(): void {
        const percentage =
            this.totalTests > 0 ? Math.round((this.completedTests / this.totalTests) * 100) : 0;
        const elapsed = this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
        const currentTestText = this.currentTest
            ? ` | Running: ${this.currentTest.slice(0, 50)}${this.currentTest.length > 50 ? '...' : ''}`
            : '';

        // Use \r to overwrite the current line, \x1b[K to clear to end of line
        process.stdout.write(
            `\r\x1b[K${percentage}% (${this.completedTests}/${this.totalTests}) | ${elapsed}s${currentTestText}`,
        );

        if (this.completedTests === this.totalTests || this.currentTest === null) {
            process.stdout.write('\n');
        }
    }

    onEnd(_result: FullResult): void {
        // Clear progress bar and add some space
        process.stdout.write('\r\x1b[K');

        const { passed, failed, skipped, timedOut } = this.results;
        const total = passed.length + failed.length + skipped.length + timedOut.length;

        console.log('\n📊 Test Results Summary');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (failed.length > 0) {
            console.log(`\n🚨 ${failed.length} test${failed.length === 1 ? '' : 's'} failed\n`);

            failed.forEach((test, index) => {
                console.log(`${index + 1}. ❌ ${test.title}`);
                console.log(
                    `   📁 File: ${this.getRelativePath(test.file)}:${test.line}:${test.column}`,
                );
                console.log(`   ⏱️  Duration: ${test.duration}ms`);

                if (test.error) {
                    console.log(`   💥 Error: ${test.error.message || 'Unknown error'}`);

                    if (test.error.stack) {
                        const stackLines = test.error.stack.split('\n');
                        const relevantStack = stackLines
                            .filter(line => line.includes('.spec.') || line.includes('test-'))
                            .slice(0, 3);

                        if (relevantStack.length > 0) {
                            console.log(`   📍 Stack trace:`);
                            relevantStack.forEach(line => {
                                const cleanLine = line.trim().replace(/^\s*at\s*/, '');
                                console.log(`      ${cleanLine}`);
                            });
                        }
                    }
                }

                // Extract test steps and failures
                if (test.steps && test.steps.length > 0) {
                    const failedSteps = test.steps.filter(step => step.error);
                    if (failedSteps.length > 0) {
                        console.log(`   🔍 Failed steps:`);
                        failedSteps.forEach(step => {
                            console.log(`      • ${step.title}`);
                            if (step.error) {
                                console.log(`        Error: ${step.error.message}`);
                            }
                        });
                    }
                }

                // Show stdout/stderr if available
                if (test.stdout && test.stdout.length > 0) {
                    console.log(`   📤 Output: ${test.stdout.join(' ')}`);
                }
                if (test.stderr && test.stderr.length > 0) {
                    console.log(`   ❗ Errors: ${test.stderr.join(' ')}`);
                }

                console.log('');
            });

            // Provide Copy Prompt-style debugging context
            console.log('🤖 AI Debugging Context:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            failed.slice(0, 3).forEach((test, index) => {
                console.log(`\n📋 Test ${index + 1}: ${test.title}`);
                console.log(`   📁 File: ${this.getRelativePath(test.file)}:${test.line}`);

                if (test.error) {
                    console.log(`   📝 Message: ${test.error.message || 'Unknown error'}`);

                    // Extract meaningful error context
                    if (test.error.stack) {
                        const relevantLine = test.error.stack
                            .split('\n')
                            .find(line => line.includes(this.getRelativePath(test.file)));
                        if (relevantLine) {
                            const location = relevantLine.match(/:(\d+):(\d+)/);
                            if (location) {
                                console.log(
                                    `   📍 Location: Line ${location[1]}, Column ${location[2]}`,
                                );
                            }
                        }
                    }
                }

                // Show test context (last few steps before failure)
                if (test.steps && test.steps.length > 0) {
                    console.log(`   🔄 Test execution flow:`);
                    test.steps.slice(-3).forEach(step => {
                        const status = step.error ? '❌' : '✅';
                        console.log(`      ${status} ${step.title} (${step.duration}ms)`);
                        if (step.error) {
                            console.log(`         💥 ${step.error.message}`);
                        }
                    });
                }

                // Show attachments (screenshots, traces, etc.)
                if (test.attachments && test.attachments.length > 0) {
                    console.log(`   📎 Attachments (use Read tool to view screenshots):`);
                    test.attachments.forEach(attachment => {
                        console.log(`      • ${attachment.name}: ${attachment.contentType}`);
                        if (attachment.path) {
                            console.log(`        Path: ${this.toHostPath(attachment.path)}`);
                        }
                    });
                }
            });

            console.log('\n💡 Complete Debugging Information:');
            console.log(
                '   • DOM Snapshot: Read error-context.md in ./test-results/ for page state',
            );
            console.log('   • HTML Report: Open playwright-report/index.html for full traces');
        }

        if (timedOut.length > 0) {
            console.log(
                `\n\x1b[31m⏲️  ${timedOut.length} test${timedOut.length === 1 ? '' : 's'} timed out\x1b[0m\n`,
            );

            timedOut.forEach((test, index) => {
                console.log(`\x1b[31m${index + 1}. ⏲️ ${test.title}\x1b[0m`);
                console.log(
                    `   📁 File: ${this.getRelativePath(test.file)}:${test.line}:${test.column}`,
                );
                if (typeof test.duration === 'number')
                    console.log(`   ⏱️  Duration: ${test.duration}ms`);

                if (test.error) {
                    console.log(`   💥 Error: ${test.error.message || 'Timeout exceeded'}`);
                }

                // Show last steps for context
                if (Array.isArray(test.steps) && test.steps.length > 0) {
                    console.log('   🔄 Test execution flow:');
                    test.steps.slice(-3).forEach(step => {
                        const status = step.error ? '❌' : '✅';
                        const d = typeof step.duration === 'number' ? `${step.duration}ms` : '—';
                        console.log(`      ${status} ${step.title} (${d})`);
                        if (step.error?.message) console.log(`         💥 ${step.error.message}`);
                    });
                }

                console.log('');
            });
        }

        if (passed.length > 0) {
            console.log(`\n✅ ${passed.length} test${passed.length === 1 ? '' : 's'} passed`);
        }

        if (skipped.length > 0) {
            console.log(`\n⏭️  ${skipped.length} test${skipped.length === 1 ? '' : 's'} skipped`);
        }

        const totalElapsed = this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
        const failedText =
            failed.length > 0 ? `\x1b[31m${failed.length} failed\x1b[0m` : '0 failed';
        const timedOutText =
            timedOut.length > 0 ? `\x1b[31m${timedOut.length} timed out\x1b[0m` : '0 timed out';
        console.log(
            `\n🎯 Summary: ${passed.length} passed, ${failedText}, ${timedOutText}, ${skipped.length} skipped (${total} total)`,
        );
        console.log(`⏱️  Total time: ${totalElapsed}s\n`);
    }

    private getRelativePath(fullPath: string): string {
        // Convert absolute path to relative path for cleaner output
        const projectRoot = process.cwd();
        if (fullPath.startsWith(projectRoot)) {
            return fullPath.substring(projectRoot.length + 1);
        }
        return fullPath;
    }

    printsToStdio(): boolean {
        return true;
    }
}

export default CopyPromptReporter;
