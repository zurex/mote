import { Event } from 'mote/base/common/event';
import { IJSONSchema } from 'mote/base/common/jsonSchema';
import { Keybinding, ResolvedKeybinding } from 'mote/base/common/keybindings';
import { KeyCode } from 'mote/base/common/keyCodes';
import { IContextKeyService, IContextKeyServiceTarget } from 'mote/platform/contextkey/common/contextkey';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export interface IUserFriendlyKeybinding {
	key: string;
	command: string;
	args?: any;
	when?: string;
}

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

export interface KeybindingsSchemaContribution {
	readonly onDidChange?: Event<void>;

	getSchemaAdditions(): IJSONSchema[];
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

	/**
	 * Look up keybindings for a command.
	 * Use `lookupKeybinding` if you are interested in the preferred keybinding.
	 */
	lookupKeybindings(commandId: string): ResolvedKeybinding[];

	/**
	 * Look up the preferred (last defined) keybinding for a command.
	 * @returns The preferred keybinding or null if the command is not bound.
	 */
	lookupKeybinding(commandId: string, context?: IContextKeyService): ResolvedKeybinding | undefined;
}
