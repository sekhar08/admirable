import { inngest } from "./client";
import { Sandbox } from 'e2b'
import { Agent, createAgent, anthropic } from "@inngest/agent-kit";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        const sandboxId = await step.run("get-sandbox-id", async () => {
            const sandbox = await Sandbox.create("adorable-nextjs-test2")
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
        });

        const { output } = await codeAgent.run(
            `Write the following snippet: ${event.data.value}`
        )

        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            return `https://${host}`;
        });

        return { output, sandboxUrl }
    },
);