import { ContextMenuService } from 'mote/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'mote/platform/contextview/browser/contextView';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';

registerSingleton(IContextMenuService, ContextMenuService, InstantiationType.Delayed);
