import { BrowserContextMenuService } from 'mote/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';

registerSingleton(IContextMenuService, BrowserContextMenuService, true);
