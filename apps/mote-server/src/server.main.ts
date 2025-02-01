import throng from 'throng';
import morgan from 'morgan';
import HyperExpress from 'hyper-express';
import { environment } from '@mote/platform/environment/common/environment';

import { getArgAsNumber } from './common/args.js';
import { setupServerServices } from './serverService.js';
import { MoteApps } from './apps/apps.js';

// This function will only be called once in the original process
async function master() {

}

// This function will only be called in each forked process
async function worker(_id: number, disconnect: () => void) {

    await setupServerServices();

    // If a --port flag is passed then it takes priority over the env variable
    const normalizedPort = getArgAsNumber('port', 'p') || environment.PORT;

    const server = new HyperExpress.Server();

    server.get('/_health', (req, res) => {
        res.json({ status: 'ok' });
    });

    server.use(morgan('tiny') as any);

    type typeName = keyof typeof MoteApps;
    Object.keys(MoteApps).forEach((appName: any) => {
        MoteApps[appName as typeName].initService(server);
    });

    // Activate webserver by calling .listen(port, callback);
    server.listen(normalizedPort)
    .then((socket) => console.log(`Webserver started on port ${normalizedPort}`))
    .catch((error) => console.log(`Failed to start webserver on port ${normalizedPort}`));
}

void throng({
    master,
    worker,
    count: 1,
});
