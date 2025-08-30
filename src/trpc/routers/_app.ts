import { createTRPCRouter } from '../init';
import { messagesRouter } from '@/modules/messages/server/procedures';
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  messages: messagesRouter,

});
// export type definition of API
export type AppRouter = typeof appRouter;