import * as dom from 'mote/base/browser/dom';
import * as browser from 'mote/base/browser/browser';
import { IKeyboardEvent, printKeyboardEvent, printStandardKeyboardEvent, StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { Keybinding, KeyCodeChord, ResolvedKeybinding, ScanCodeChord } from 'mote/base/common/keybindings';
import { KeyCode, KeyMod, ScanCode } from 'mote/base/common/keyCodes';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IContextKey, IContextKeyService } from 'mote/platform/contextkey/common/contextkey';

import { AbstractKeybindingService } from 'mote/platform/keybinding/common/abstractKeybindingService';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { KeybindingResolver } from 'mote/platform/keybinding/common/keybindingResolver';
import { IKeybindingItem, KeybindingsRegistry } from 'mote/platform/keybinding/common/keybindingsRegistry';
import { ResolvedKeybindingItem } from 'mote/platform/keybinding/common/resolvedKeybindingItem';
import { InstantiationType, registerSingleton } from 'mote/platform/instantiation/common/extensions';
import { ILogService } from 'mote/platform/log/common/log';
import { BrowserFeatures, KeyboardSupport } from 'mote/base/browser/canIUse';
import { OperatingSystem, OS } from 'mote/base/common/platform';
import { IKeyboardMapper } from 'mote/platform/keyboardLayout/common/keyboardMapper';
import { IKeyboardLayoutService } from 'mote/platform/keyboardLayout/common/keyboardLayout';
import { INotificationService } from 'mote/platform/notification/common/notification';

export class WorkbenchKeybindingService extends AbstractKeybindingService {

	private isComposingGlobalContextKey: IContextKey<boolean>;
	private cachedResolver: KeybindingResolver | null;
	private keyboardMapper: IKeyboardMapper;

	constructor(
		@ILogService logService: ILogService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService commandService: ICommandService,
		@IKeyboardLayoutService private readonly keyboardLayoutService: IKeyboardLayoutService,
		@INotificationService notificationService: INotificationService,
	) {
		super(contextKeyService, commandService, notificationService, logService);

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

				const resolvedKeybindings = this.keyboardMapper.resolveKeybinding(keybinding);
				for (let i = resolvedKeybindings.length - 1; i >= 0; i--) {
					const resolvedKeybinding = resolvedKeybindings[i];
					result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, item.extensionId, item.isBuiltinExtension);
				}
			}
		}

		return result;
	}

	private _assertBrowserConflicts(keybinding: Keybinding, commandId: string | null): boolean {
		if (BrowserFeatures.keyboard === KeyboardSupport.Always) {
			return false;
		}

		if (BrowserFeatures.keyboard === KeyboardSupport.FullScreen && browser.isFullscreen()) {
			return false;
		}

		for (const chord of keybinding.chords) {
			if (!chord.metaKey && !chord.altKey && !chord.ctrlKey && !chord.shiftKey) {
				continue;
			}

			const modifiersMask = KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift;

			let partModifiersMask = 0;
			if (chord.metaKey) {
				partModifiersMask |= KeyMod.CtrlCmd;
			}

			if (chord.shiftKey) {
				partModifiersMask |= KeyMod.Shift;
			}

			if (chord.altKey) {
				partModifiersMask |= KeyMod.Alt;
			}

			if (chord.ctrlKey && OS === OperatingSystem.Macintosh) {
				partModifiersMask |= KeyMod.WinCtrl;
			}

			if ((partModifiersMask & modifiersMask) === (KeyMod.CtrlCmd | KeyMod.Alt)) {
				if (chord instanceof ScanCodeChord && (chord.scanCode === ScanCode.ArrowLeft || chord.scanCode === ScanCode.ArrowRight)) {
					// console.warn('Ctrl/Cmd+Arrow keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
				if (chord instanceof KeyCodeChord && (chord.keyCode === KeyCode.LeftArrow || chord.keyCode === KeyCode.RightArrow)) {
					// console.warn('Ctrl/Cmd+Arrow keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
			}

			if ((partModifiersMask & modifiersMask) === KeyMod.CtrlCmd) {
				if (chord instanceof ScanCodeChord && (chord.scanCode >= ScanCode.Digit1 && chord.scanCode <= ScanCode.Digit0)) {
					// console.warn('Ctrl/Cmd+Num keybindings should not be used by default in web. Offender: ', kb.getHashCode(), ' for ', commandId);
					return true;
				}
				if (chord instanceof KeyCodeChord && (chord.keyCode >= KeyCode.Digit0 && chord.keyCode <= KeyCode.Digit9)) {
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

registerSingleton(IKeybindingService, WorkbenchKeybindingService, InstantiationType.Eager);
