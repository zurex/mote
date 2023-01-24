import { IKeybindingService, IKeyboardEvent } from 'mote/platform/keybinding/common/keybinding';
import { ChordKeybinding, ResolvedKeybinding } from 'mote/base/common/keybindings';
import { Disposable } from 'mote/base/common/lifecycle';
import { IContextKeyService, IContextKeyServiceTarget } from 'mote/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';
import { KeybindingResolver } from 'mote/platform/keybinding/common/keybindingResolver';
import { ICommandService } from 'mote/platform/commands/common/commands';

interface CurrentChord {
	keypress: string;
	label: string | null;
}

export abstract class AbstractKeybindingService extends Disposable implements IKeybindingService {

	public _serviceBrand: undefined;

	private _currentChord: CurrentChord | null;

	protected _logging: boolean;

	constructor(
		protected logService: ILogService,
		private contextKeyService: IContextKeyService,
		protected commandService: ICommandService,
	) {
		super();

		this._currentChord = null;


		this._logging = false;
	}

	protected abstract getResolver(): KeybindingResolver;

	public abstract resolveKeyboardEvent(keyboardEvent: IKeyboardEvent): ResolvedKeybinding;

	resolveKeybinding(keybinding: ChordKeybinding): ResolvedKeybinding[] {
		throw new Error('Method not implemented.');
	}

	resolveUserBinding(userBinding: string): ResolvedKeybinding[] {
		throw new Error('Method not implemented.');
	}
	dispatchEvent(e: IKeyboardEvent, target: IContextKeyServiceTarget): boolean {
		throw new Error('Method not implemented.');
	}

	protected _log(str: string): void {
		if (this._logging) {
			this.logService.info(`[KeybindingService]: ${str}`);
		}
	}

	protected dispatch(e: IKeyboardEvent, target: IContextKeyServiceTarget): boolean {
		return this.doDispatch(this.resolveKeyboardEvent(e), target, /*isSingleModiferChord*/false);
	}

	private doDispatch(keybinding: ResolvedKeybinding, target: IContextKeyServiceTarget, isSingleModiferChord = false): boolean {
		let shouldPreventDefault = false;

		if (keybinding.isChord()) {
			console.warn('Unexpected keyboard event mapped to a chord');
			return false;
		}

		let firstPart: string | null = null; // the first keybinding i.e. Ctrl+K
		let currentChord: string | null = null;// the "second" keybinding i.e. Ctrl+K "Ctrl+D"

		if (isSingleModiferChord) {
			const [dispatchKeyname,] = keybinding.getSingleModifierDispatchParts();
			firstPart = dispatchKeyname;
			currentChord = dispatchKeyname;
		} else {
			[firstPart,] = keybinding.getDispatchParts();
			currentChord = this._currentChord ? this._currentChord.keypress : null;
		}

		if (firstPart === null) {
			this._log(`\\ Keyboard event cannot be dispatched in keydown phase.`);
			// cannot be dispatched, probably only modifier keys
			return shouldPreventDefault;
		}

		const contextValue = this.contextKeyService.getContext(target);
		const keypressLabel = keybinding.getLabel();
		const resolveResult = this.getResolver().resolve(contextValue, currentChord, firstPart);

		this.logService.trace('KeybindingService#dispatch', keypressLabel, resolveResult?.commandId);

		if (resolveResult && resolveResult.enterChord) {
			shouldPreventDefault = true;
			//this._enterChordMode(firstPart, keypressLabel);
			this._log(`+ Entering chord mode...`);
			return shouldPreventDefault;
		}

		if (resolveResult && resolveResult.commandId) {
			if (!resolveResult.bubble) {
				shouldPreventDefault = true;
			}
			this._log(`+ Invoking command ${resolveResult.commandId}.`);
			if (typeof resolveResult.commandArgs === 'undefined') {
				this.commandService.executeCommand(resolveResult.commandId).then(undefined, err => console.error(err));
			} else {
				this.commandService.executeCommand(resolveResult.commandId, resolveResult.commandArgs).then(undefined, err => console.error(err));
			}
		}

		return shouldPreventDefault;
	}
}
