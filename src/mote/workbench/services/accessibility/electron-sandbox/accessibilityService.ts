import { AccessibilityService } from 'mote/platform/accessibility/browser/accessibilityService';
import { IAccessibilityService } from 'mote/platform/accessibility/common/accessibility';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';

export class NativeAccessibilityService extends AccessibilityService {

}

registerSingleton(IAccessibilityService, NativeAccessibilityService, InstantiationType.Delayed);
