import { inngest } from "./client";
import { Sandbox } from 'e2b';
import { Agent, createAgent, anthropic, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { getSandbox } from "./utils";

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
            system: "You are an expert nextjs developer. You write readable and maintainable code. You write simple NextJs & React Snippets",
            model: anthropic({
                model: "claude-3-haiku-20240307",
                defaultParameters: {
                    temperature: 0.7,
                    max_tokens: 4096
                }
            }),
            tools: [
                createTool({
                    name: "terminal",
                    description: "Use the terminal to run commands",
                    handler: async ({ command }: { command: string }, { step }) => {
                        return await step?.run("terminal", async () => {
                            const buffers = {
                                stdout: "",
                                stderr: ""
                            };

                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const result = await sandbox.commands.run(command, {
                                    onStdout: (data: string) => {
                                        buffers.stdout += data;
                                    },
                                    onStderr: (data: string) => {
                                        buffers.stderr += data;
                                    }
                                });
                                return result.stdout;
                            } catch (err) {
                                console.error("Error running command", err);
                                console.error("Error details:", buffers.stderr);
                                return `Command failed ${err} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`;
                            }
                        });
                    }
                }),
                createTool({
                    name: "createOrUpdateFiles",
                    description: "Interact with the file system in the sandbox",
                    handler: async ({ files }: { files: Array<{ path: string; content: string }> }, { step }) => {
                        return await step?.run("createOrUpdateFiles", async () => {
                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const updatedFiles: Record<string, string> = {};

                                for (const file of files) {
                                    await sandbox.files.write(file.path, file.content);
                                    updatedFiles[file.path] = file.content;
                                }

                                return updatedFiles;
                            } catch (err) {
                                console.error("Error creating/updating files", err);
                                throw err;
                            }
                        });
                    }
                }),

                createTool({
                    name: "readFiles",
                    description: "Read files from the file system in the sandbox",
                    handler: async ({ paths }: { paths: string[] }, { step }) => {
                        return await step?.run("readFiles", async () => {
                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const contents = [];
                                for (const path of paths) {
                                    const content = await sandbox.files.read(path);
                                    contents.push({ path, content });
                                }
                                return JSON.stringify(contents);
                            } catch (err) {
                                console.error("Error reading files", err);
                                return JSON.stringify([]);
                            }
                        });
                    }
                })

            ]
        });

        const { output } = await codeAgent.run(
            `Write the following snippet: ${event?.data?.value || "Hello World"}`
        );

        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            return `https://${host}`;
        });

        return { output, sandboxUrl };
    }
);