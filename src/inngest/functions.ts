import { inngest } from "./client";
import { Sandbox } from 'e2b';
import { Agent, createAgent, anthropic, createTool, createNetwork } from "@inngest/agent-kit";
import { z, ZodAny } from "zod";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        const sandboxId = await step.run("get-sandbox-id", async () => {
            const sandbox = await Sandbox.create("adorable-nextjs-test2");
            return sandbox.sandboxId;
        });

        const codeAgent = createAgent({
            name: "code-agent",
            description: "An expert coding AI Agent",
            system: PROMPT,
            model: anthropic({
                model: "claude-3-5-haiku-latest",
                defaultParameters: {
                    temperature: 0.5,
                    max_tokens: 4096
                }
            }),
            tools: [
                createTool({
                    name: "terminal",
                    description: "Use the terminal to run commands",
                    handler: async (params: { command: string }, { step }) => {
                        const { command } = params;
                        return await step?.run("terminal", async () => {
                            const buffers = { stdout: "", stderr: "" };
                            try {
                                const sandbox = await getSandbox(sandboxId)
                                const result = await sandbox.commands.run(command, {
                                    onStdout: (data: string) => {
                                        buffers.stdout += data;
                                    },
                                    onStderr: (data: String) => {
                                        buffers.stderr += data;
                                    }
                                });
                                return result.stdout
                            }
                            catch (err) {
                                console.error(`Command failed: ${err} \stdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`);
                                return `Command failed: ${err} \stdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
                            }
                        });
                    }
                }),
                createTool({
                    name: "createOrUpdateFiles",
                    description: "Create or update files in the Sandbox. Expects an array of files with path and content properties.",
                    handler: async (params: any, { step, network }) => {
                        console.log("Received params:", params);

                        // Handle different parameter formats the AI might send
                        let files = params.files || params;

                        // Parse string if needed
                        if (typeof files === 'string') {
                            try {
                                files = JSON.parse(files);
                                console.log("Parsed files from JSON string:", files);
                            } catch (err) {
                                console.log("JSON parse failed, trying manual extraction...");

                                // Handle template literal format like `content`
                                const pathMatch = files.match(/"path":\s*"([^"]+)"/);
                                const contentMatch = files.match(/"content":\s*[`"]([\s\S]*?)[`"]\s*(?:\n\s*}|\})/);

                                if (pathMatch && contentMatch) {
                                    files = [{
                                        path: pathMatch[1],
                                        content: contentMatch[1]
                                            .replace(/\\n/g, '\n')
                                            .replace(/\\"/g, '"')
                                            .replace(/\\'/g, "'")
                                            .replace(/\\t/g, '\t')
                                            .replace(/\\`/g, '`')  // Add backtick unescaping
                                    }];
                                    console.log("Successfully extracted file:", files);
                                } else {
                                    console.error("Could not extract file data");
                                    return "Error: Could not parse file data";
                                }
                            }
                        }

                        // Ensure files is an array
                        if (!Array.isArray(files)) {
                            if (typeof files === 'object' && files.path && files.content) {
                                // Single file object, convert to array
                                files = [files];
                            } else {
                                console.error("Invalid files parameter:", params);
                                return "Error: Files parameter must be an array of objects with path and content properties";
                            }
                        }

                        // Validate each file object
                        const validFiles = files.filter((file: any) => {
                            if (!file || typeof file !== 'object') {
                                console.error("Invalid file object:", file);
                                return false;
                            }
                            if (!file.path || file.content === undefined) {  // Allow empty string content
                                console.error("File missing path or content:", file);
                                return false;
                            }
                            return true;
                        });

                        if (validFiles.length === 0) {
                            return "Error: No valid files provided. Each file must have 'path' and 'content' properties.";
                        }

                        // Enhanced JavaScript/JSX Syntax Validation
                        const jsFiles = validFiles.filter((file: any) =>
                            file.path.endsWith('.tsx') || file.path.endsWith('.jsx') ||
                            file.path.endsWith('.ts') || file.path.endsWith('.js')
                        );

                        for (const file of jsFiles) {
                            const content = file.content;
                            const syntaxIssues = [];

                            // Critical: Check for unterminated strings and template literals
                            const lines = content.split('\n');
                            let inMultiLineString = false;
                            let stringType = '';

                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                const trimmedLine = line.trim();

                                // Skip empty lines and comments
                                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                                    continue;
                                }

                                // Check for unterminated template literals (most critical)
                                const backtickCount = (line.match(/`/g) || []).length;
                                if (backtickCount % 2 !== 0) {
                                    // Check if this starts or ends a multiline template literal
                                    if (!inMultiLineString) {
                                        inMultiLineString = true;
                                        stringType = 'template';
                                    } else if (stringType === 'template') {
                                        inMultiLineString = false;
                                        stringType = '';
                                    } else {
                                        syntaxIssues.push(`Line ${i + 1}: Unterminated template literal - missing closing backtick (\`)`);
                                    }
                                }

                                // Only check quote balance if not in a multiline template literal
                                if (!inMultiLineString || stringType !== 'template') {
                                    // Check for unterminated double quotes
                                    const doubleQuoteMatches = line.match(/"/g) || [];
                                    const doubleQuoteCount = doubleQuoteMatches.length;
                                    if (doubleQuoteCount % 2 !== 0 && !line.includes('//')) {
                                        // Check if it's starting a multiline string
                                        if (!inMultiLineString && (line.trim().endsWith('"') === false)) {
                                            syntaxIssues.push(`Line ${i + 1}: Unterminated string - missing closing double quote (")`);
                                        }
                                    }

                                    // Check for unterminated single quotes (excluding contractions)
                                    const singleQuoteMatches = line.match(/'/g) || [];
                                    const singleQuoteCount = singleQuoteMatches.length;
                                    if (singleQuoteCount % 2 !== 0 && !line.includes('//') &&
                                        !line.includes("'t") && !line.includes("'s") && !line.includes("'re") &&
                                        !line.includes("'ll") && !line.includes("'ve") && !line.includes("'d")) {
                                        syntaxIssues.push(`Line ${i + 1}: Unterminated string - missing closing single quote (')`);
                                    }
                                }
                            }

                            // Check if file ends while still in a multiline string
                            if (inMultiLineString) {
                                syntaxIssues.push(`File ends with unterminated multiline ${stringType} literal`);
                            }

                            // JSX-specific checks for .tsx/.jsx files
                            if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
                                // Check for return statements without parentheses around JSX
                                const returnJsxPattern = /return\s+<[^(]/g;
                                if (returnJsxPattern.test(content)) {
                                    syntaxIssues.push("JSX return statements should be wrapped in parentheses: return ( <div>... )");
                                }

                                // Check for HTML attributes instead of JSX
                                if (/\s+class=[^N]/.test(content)) {  // class= but not className=
                                    syntaxIssues.push("Use 'className' instead of 'class' in JSX");
                                }
                                if (/\s+for=[^="]*"/.test(content)) {  // for= but not htmlFor=
                                    syntaxIssues.push("Use 'htmlFor' instead of 'for' in JSX");
                                }

                                // Check for missing "use client" in files that likely need it
                                const clientSidePatterns = [
                                    'useState', 'useEffect', 'useReducer', 'useContext',
                                    'onClick', 'onChange', 'onSubmit', 'onFocus', 'onBlur',
                                    'onKeyDown', 'onKeyUp', 'onMouseDown', 'onMouseUp'
                                ];

                                const needsUseClient = clientSidePatterns.some(pattern => content.includes(pattern));
                                const hasUseClient = content.includes('"use client"') || content.includes("'use client'");

                                if (needsUseClient && !hasUseClient) {
                                    syntaxIssues.push("File uses React hooks or event handlers but missing 'use client' directive at the top");
                                }
                            }

                            // General JavaScript syntax checks
                            const brackets = {
                                '{': (content.match(/\{/g) || []).length,
                                '}': (content.match(/\}/g) || []).length,
                                '(': (content.match(/\(/g) || []).length,
                                ')': (content.match(/\)/g) || []).length,
                                '[': (content.match(/\[/g) || []).length,
                                ']': (content.match(/\]/g) || []).length
                            };

                            if (brackets['{'] !== brackets['}']) {
                                syntaxIssues.push("Mismatched curly braces { } - check object syntax and JSX expressions");
                            }
                            if (brackets['('] !== brackets[')']) {
                                syntaxIssues.push("Mismatched parentheses ( ) - check function calls and JSX");
                            }
                            if (brackets['['] !== brackets[']']) {
                                syntaxIssues.push("Mismatched square brackets [ ] - check array syntax");
                            }

                            if (syntaxIssues.length > 0) {
                                console.error(`Syntax validation failed for ${file.path}:`, syntaxIssues);
                                return `Error: Syntax validation failed for ${file.path}:\n${syntaxIssues.join('\n')}\n\nPlease fix these issues before proceeding.`;
                            }
                        }

                        const newFiles = await step?.run("createOrUpdateFiles", async () => {
                            try {
                                const updatedFiles = network.state.data.files || {};
                                const sandbox = await getSandbox(sandboxId);

                                for (const file of validFiles) {
                                    console.log(`Writing file: ${file.path}`);

                                    // Create directory if it doesn't exist
                                    const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
                                    if (dirPath) {
                                        try {
                                            await sandbox.files.makeDir(dirPath);
                                        } catch (err) {
                                            // Directory might already exist, ignore error
                                        }
                                    }

                                    await sandbox.files.write(file.path, file.content);
                                    updatedFiles[file.path] = file.content;
                                }

                                return updatedFiles;
                            }
                            catch (err) {
                                console.error("Error creating/updating files:", err);
                                return "Error: " + String(err);
                            }
                        });

                        if (typeof newFiles === "object") {
                            network.state.data.files = newFiles;
                            return `Successfully created/updated ${validFiles.length} files: ${validFiles.map((f: any) => f.path).join(', ')}`;
                        }

                        return newFiles; // Return error message if not object
                    }
                }),
                createTool({
                    name: "readFiles",
                    description: "Read files from the sandbox",
                    handler: async (params: { files: string[] }, { step }) => {
                        const { files } = params;
                        return await step?.run("readFiles", async () => {
                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const contents = [];
                                for (const file of files) {
                                    const content = await sandbox.files.read(file);
                                    contents.push({ path: file, content })
                                }
                                return JSON.stringify(contents);
                            }
                            catch (err) {
                                return "Error" + err
                            }
                        })
                    }
                })

            ],
            lifecycle: {
                onResponse: async ({ result, network }) => {
                    const lastAssistantMessageText = lastAssistantTextMessageContent(result);
                    if (lastAssistantMessageText && network) {
                        if (lastAssistantMessageText.includes("<task_summary>")) {
                            network.state.data.summary = lastAssistantMessageText;
                        }
                    }
                    return result;
                }
            }
        });


        const network = createNetwork({
            name: "code-agent-network",
            agents: [codeAgent],
            maxIter: 15,
            router: async ({ network }) => {
                const summary = network.state.data.summary;

                if (summary) {
                    return;
                }
                return codeAgent;
            }
        });

        const result = await network.run(event.data.value)

        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            let baseUrl = `https://${host}`;

            return baseUrl;
        });

        return {
            url: sandboxUrl,
            title: "Fragment",
            files: result.state.data.files,
            summary: result.state.data.summary
        };
    }
);