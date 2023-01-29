import * as dom from 'mote/base/browser/dom';
import * as browser from 'mote/base/browser/browser';
import { IKeyboardEvent, printKeyboardEvent, printStandardKeyboardEvent, StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { ResolvedKeybinding, ScanCodeBinding, SimpleKeybinding } from 'mote/base/common/keybindings';
import { KeyCode, KeyMod, ScanCode } from 'mote/base/common/keyCodes';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IContextKey, IContextKeyService } from 'mote/platform/contextkey/common/contextkey';

import { AbstractKeybindingService } from 'mote/platform/keybinding/common/abstractKeybindingService';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { KeybindingResolver } from 'mote/platform/keybinding/common/keybindingResolver';
import { IKeybindingItem, KeybindingsRegistry } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { ResolvedKeybindingItem } from 'mote/platform/keybinding/common/resolvedKeybindingItem';
import { registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ILogService } from 'mote/platform/log/common/log';
import { BrowserFeatures, KeyboardSupport } from 'mote/base/browser/canIUse';
import { OperatingSystem, OS } from 'mote/base/common/platform';
import { IKeyboardLayoutService } from 'mote/platform/keyboardLayout/common/keyboardLayoutService';
import { IKeyboardMapper } from 'mote/platform/keyboardLayout/common/keyboardMapper';

export class WorkbenchKeybindingService extends AbstractKeybindingService {

	private isComposingGlobalContextKey: IContextKey<boolean>;
	private cachedResolver: KeybindingResolver | null;
	private keyboardMapper: IKeyboardMapper;

	constructor(
		@ILogService logService: ILogService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService commandService: ICommandService,
		@IKeyboardLayoutService private readonly keyboardLayoutService: IKeyboardLayoutService
	) {
		super(logService, contextKeyService, commandService);

		this.isComposingGlobalContextKey = contextKeyService.createKey('isComposing', false);

		this.cachedResolver = null;
		this.keyboardMapper = this.keyboardLayoutService.getKeyboardMapper();

		// for standard keybindings
		this._register(dom.addDisposableListener(window, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			this.isComposingGlobalContextKey.set(e.isComposing);
			const keyEvent = new StandardKeyboardEvent(e);
			this._log(`/ Received  keydown event - ${printKeyboardEvent(e)}`);
			this._log(`| Converted keydown event - ${printStandardKeyboardEvent(keyEvent)}`);
			const shouldPreventDefault = this.dispatch(keyEvent, keyEvent.target);
			if (shouldPreventDefault) {
				keyEvent.preventDefault();
			}
			this.isComposingGlobalContextKey.set(false);
		}));
	}

	protected getResolver(): KeybindingResolver {
		if (!this.cachedResolver) {
			const defaults = this.resolveKeybindingItems(KeybindingsRegistry.getDefaultKeybindings(), true);
			//const overrides = this._resolveUserKeybindingItems(this.userKeybindings.keybindings.map((k) => KeybindingIO.readUserKeybindingItem(k)), false);
			this.cachedResolver = new KeybindingResolver(defaults, [], (str) => this._log(str));
		}
		return this.cachedResolver;
	}

	private resolveKeybindingItems(items: IKeybindingItem[], isDefault: boolean): ResolvedKeybindingItem[] {
		const result: ResolvedKeybindingItem[] = [];
		let resultLen = 0;
		for (const item of items) {
			const when = item.when || undefined;
			const keybinding = item.keybinding;
			if (!keybinding) {
				// This might be a removal keybinding item in user settings => accept it
				result[resultLen++] = new ResolvedKeybindingItem(undefined, item.command, item.commandArgs, when, isDefault, item.extensionId, item.isBuiltinExtension);
			} else {
				if (this._assertBrowserConflicts(keybinding, item.command)) {
					continue;
				}

				const resolvedKeybindings = this.keyboardMapper.resolveUserBinding(keybinding);
				for (let i = resolvedKeybindings.length - 1; i >= 0; i--) {
					const resolvedKeybinding = resolvedKeybindings[i];
					result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, item.extensionId, item.isBuiltinExtension);
				}
			}
		}

		return result;
	}

	private _assertBrowserConflicts(kb: (SimpleKeybinding | ScanCodeBinding)[], commandId: string | null): boolean {
		if (BrowserFeatures.keyboard === KeyboardSupport.Always) {
			return false;
		}

		if (BrowserFeatures.keyboard === KeyboardSupport.FullScreen && browser.isFullscreen()) {
			return false;
		}

		for (const part of kb) {
			if (!part.metaKey && !part.altKey && !part.ctrlKey && !part.shiftKey) {
				continue;
			}

			const modifiersMask = KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift;

			let partModifiersMask = 0;
			if (part.metaKey) {
				partModifiersMask |= KeyMod.CtrlCmd;
			}

			if (part.shiftKey) {
				partModifiersMask |= KeyMod.Shift;
			}

			if (part.altKey) {
				partModifiersMask |= KeyMod.Alt;
			}

			if (part.ctrlKey && OS === OperatingSystem.Macintosh) {
				partModifiersMask |= KeyMod.WinCtrl;
			}

			if ((partModifiersMask & modifiersMask) === (KeyMod.CtrlCmd | KeyMod.Alt)) {
				if (part instanceof ScanCodeBinding && (part.scanCode === ScanCode.ArrowLeft || part.scanCode === ScanCode.ArrowRight)) {
					// console.warn('Ctrl/Cmd+Arrow keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
				if (part instanceof SimpleKeybinding && (part.keyCode === KeyCode.LeftArrow || part.keyCode === KeyCode.RightArrow)) {
					// console.warn('Ctrl/Cmd+Arrow keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
			}

			if ((partModifiersMask & modifiersMask) === KeyMod.CtrlCmd) {
				if (part instanceof ScanCodeBinding && (part.scanCode >= ScanCode.Digit1 && part.scanCode <= ScanCode.Digit0)) {
					// console.warn('Ctrl/Cmd+Num keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
				if (part instanceof SimpleKeybinding && (part.keyCode >= KeyCode.Digit0 && part.keyCode <= KeyCode.Digit9)) {
					// console.warn('Ctrl/Cmd+Num keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
			}
		}

		return false;
	}

	public resolveKeyboardEvent(keyboardEvent: IKeyboardEvent): ResolvedKeybinding {
		//this.keyboardLayoutService.validateCurrentKeyboardMapping(keyboardEvent);
		return this.keyboardMapper.resolveKeyboardEvent(keyboardEvent);
	}
}


registerSingleton(IKeybindingService, WorkbenchKeybindingService);
