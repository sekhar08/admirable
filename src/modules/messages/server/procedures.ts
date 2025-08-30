import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";

export const messagesRouter = createTRPCRouter({

    getMany: baseProcedure
        .query(async ({ ctx }) => {
            const messages = await prisma.message.findMany({
                orderBy: {
                    updatedAt: "desc"
                }
            });
            return messages;
        }),

    create: baseProcedure
        .input(
            z.object({
                value: z.string().min(2).max(10000, { message: "Message must be between 2 and 10000 characters" })
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { value } = input;
            // Your mutation logic here
            const createdMessage = await prisma.message.create({
                data: {
                    content: value,
                    role: "USER",
                    type: "RESULT"
                }
            });
            await inngest.send({
                name: "code-agent/run",
                data: { value: input.value }
            })

            return createdMessage;
        })

});
