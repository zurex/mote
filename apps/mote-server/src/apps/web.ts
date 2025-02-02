import { Server } from 'hyper-express';
import { apiRouter } from 'mote/routes/api/apiRouter.js';

export function initService(server: Server) {
    server.use('/api', apiRouter);
}
