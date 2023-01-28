import { Keybinding, ResolvedKeybinding } from 'mote/base/common/keybindings';
import { KeyCode } from 'mote/base/common/keyCodes';
import { IContextKeyServiceTarget } from 'mote/platform/contextkey/common/contextkey';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export interface IKeyboardEvent {
	readonly _standardKeyboardEventBrand: true;

	readonly ctrlKey: boolean;
	readonly shiftKey: boolean;
	readonly altKey: boolean;
	readonly metaKey: boolean;
	readonly altGraphKey: boolean;
	readonly keyCode: KeyCode;
	readonly code: string;
}

export const IKeybindingService = createDecorator<IKeybindingService>('keybindingService');

export interface IKeybindingService {
	readonly _serviceBrand: undefined;

	/**
	 * Returns none, one or many (depending on keyboard layout)!
	 */
	resolveKeybinding(keybinding: Keybinding): ResolvedKeybinding[];

	resolveKeyboardEvent(keyboardEvent: IKeyboardEvent): ResolvedKeybinding;

	resolveUserBinding(userBinding: string): ResolvedKeybinding[];

	/**
	 * Resolve and dispatch `keyboardEvent` and invoke the command.
	 */
	dispatchEvent(e: IKeyboardEvent, target: IContextKeyServiceTarget): boolean;
}
