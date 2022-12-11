import { IKeybindingService, IKeyboardEvent } from 'mote/platform/keybinding/common/keybinding';
import { ChordKeybinding, ResolvedKeybinding } from 'vs/base/common/keybindings';
import { Disposable } from 'vs/base/common/lifecycle';
import { IContextKeyServiceTarget } from 'vs/platform/contextkey/common/contextkey';

export abstract class AbstractKeybindingService extends Disposable implements IKeybindingService {

	public _serviceBrand: undefined;

	resolveKeybinding(keybinding: ChordKeybinding): ResolvedKeybinding[] {
		throw new Error('Method not implemented.');
	}
	resolveKeyboardEvent(keyboardEvent: IKeyboardEvent): ResolvedKeybinding {
		throw new Error('Method not implemented.');
	}
	resolveUserBinding(userBinding: string): ResolvedKeybinding[] {
		throw new Error('Method not implemented.');
	}
	dispatchEvent(e: IKeyboardEvent, target: IContextKeyServiceTarget): boolean {
		throw new Error('Method not implemented.');
	}

}
