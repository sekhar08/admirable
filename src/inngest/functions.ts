import { inngest } from "./client";
import { Agent, createAgent, anthropic } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event }) => {
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
        return output
    },
);