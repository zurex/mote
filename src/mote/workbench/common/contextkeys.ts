import { localize } from 'vs/nls';

//#region < --- Status Bar --- >

import { RawContextKey } from 'mote/platform/contextkey/common/contextkey';

export const StatusBarFocused = new RawContextKey<boolean>('statusBarFocused', false, localize('statusBarFocused', "Whether the status bar has keyboard focus"));

//#endregion
