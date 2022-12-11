import { AbstractKeybindingService } from 'mote/platform/keybinding/common/abstractKeybindingService';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

export class WorkbenchKeybindingService extends AbstractKeybindingService {

}


registerSingleton(IKeybindingService, WorkbenchKeybindingService);
