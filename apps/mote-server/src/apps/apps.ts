import * as web from './web.js';

export const MoteApps = {
    'web': web
}

export type MoteApp = typeof MoteApps[keyof typeof MoteApps];
