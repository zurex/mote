import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { QuickInputService } from 'mote/platform/quickinput/browser/quickInput';
import { IQuickInputService } from 'mote/platform/quickinput/common/quickInput';

export class WorkbenchQuickInputService extends QuickInputService {

}

registerSingleton(IQuickInputService, QuickInputService, InstantiationType.Delayed);
