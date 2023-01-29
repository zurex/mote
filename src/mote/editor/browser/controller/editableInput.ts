import * as dom from 'mote/base/browser/dom';
import * as strings from 'mote/base/common/strings';
import { serializeNode } from 'mote/editor/common/textSerialize';
import { Emitter, Event } from 'mote/base/common/event';
import { getSelectionFromRange, TextSelection } from 'mote/editor/common/core/selectionUtils';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { IKeyboardEvent, StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { EditableState, IEditableWrapper, ITypeData, _debugComposition } from 'mote/editor/browser/controller/editableState';
import { OperatingSystem } from 'mote/base/common/platform';
import { KeyCode } from 'mote/base/common/keyCodes';
import { generateUuid } from 'mote/base/common/uuid';
import { inputLatency } from 'mote/base/browser/performance';
import { DomEmitter } from 'mote/base/browser/event';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { RangeUtils } from 'mote/editor/common/core/rangeUtils';

export interface ICompositionData {
	data: string;
}

interface EditableOptions {
	getSelection?(): TextSelection | undefined;
	placeholder?: string;
}

export interface ClipboardStoredMetadata {
	version: 1;
	isFromEmptySelection: boolean | undefined;
	multicursorText: string[] | null | undefined;
	mode: string | null;
}

export interface IPasteData {
	text: string;
	metadata: ClipboardStoredMetadata | null;
}

export interface ClipboardDataToCopy {
	isFromEmptySelection: boolean;
	multicursorText: string[] | null | undefined;
	text: string;
	html: string | null | undefined;
	mode: string | null;
}

export interface IEditableInputHost {
	getDataToCopy(): ClipboardDataToCopy;
	//getScreenReaderContent(currentState: TextAreaState): TextAreaState;
	//deduceModelPosition(viewAnchorPosition: Position, deltaOffset: number, lineFeedCnt: number): Position;
}

interface InMemoryClipboardMetadata {
	lastCopiedValue: string;
	data: ClipboardStoredMetadata;
}

/**
 * Every time we write to the clipboard, we record a bit of extra metadata here.
 * Every time we read from the cipboard, if the text matches our last written text,
 * we can fetch the previous metadata.
 */
export class InMemoryClipboardMetadataManager {
	public static readonly INSTANCE = new InMemoryClipboardMetadataManager();

	private _lastState: InMemoryClipboardMetadata | null;

	constructor() {
		this._lastState = null;
	}

	public set(lastCopiedValue: string, data: ClipboardStoredMetadata): void {
		this._lastState = { lastCopiedValue, data };
	}

	public get(pastedText: string): ClipboardStoredMetadata | null {
		if (this._lastState && this._lastState.lastCopiedValue === pastedText) {
			// match!
			return this._lastState.data;
		}
		this._lastState = null;
		return null;
	}
}

export interface ICompositionStartEvent {
	data: string;
}

export interface ICompleteEditableWrapper extends IEditableWrapper {
	readonly onInput: Event<InputEvent>;
	readonly onClick: Event<MouseEvent>;
	readonly onKeyDown: Event<KeyboardEvent>;
	readonly onKeyUp: Event<KeyboardEvent>;
	readonly onCompositionStart: Event<CompositionEvent>;
	readonly onCompositionUpdate: Event<CompositionEvent>;
	readonly onCompositionEnd: Event<CompositionEvent>;
	readonly onFocus: Event<FocusEvent>;
	readonly onBlur: Event<FocusEvent>;

	setIgnoreSelectionChangeTime(reason: string): void;
	getIgnoreSelectionChangeTime(): number;
	resetSelectionChangeTime(): void;

	hasFocus(): boolean;
}

export interface IBrowser {
	isAndroid: boolean;
	isFirefox: boolean;
	isChrome: boolean;
	isSafari: boolean;
}

class CompositionContext {

	private _lastTypeTextLength: number;

	constructor() {
		this._lastTypeTextLength = 0;
	}

	public handleCompositionUpdate(text: string | null | undefined): ITypeData {
		text = text || '';
		const typeInput: ITypeData = {
			text: text,
			replacePrevCharCnt: this._lastTypeTextLength,
			replaceNextCharCnt: 0,
			positionDelta: 0,
			type: ''
		};
		this._lastTypeTextLength = text.length;
		return typeInput;
	}
}

export class EditableInput extends Disposable {

	private id: string = generateUuid();

	//#region events

	private _onFocus = this._register(new Emitter<void>());
	public readonly onFocus: Event<void> = this._onFocus.event;

	private _onBlur = this._register(new Emitter<void>());
	public readonly onBlur: Event<void> = this._onBlur.event;

	private _onKeyDown = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyDown: Event<IKeyboardEvent> = this._onKeyDown.event;

	private _onKeyUp = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyUp: Event<IKeyboardEvent> = this._onKeyUp.event;

	private _onCut = this._register(new Emitter<void>());
	public readonly onCut: Event<void> = this._onCut.event;

	private _onPaste = this._register(new Emitter<IPasteData>());
	public readonly onPaste: Event<IPasteData> = this._onPaste.event;

	private _onType = this._register(new Emitter<ITypeData>());
	public readonly onType: Event<ITypeData> = this._onType.event;

	private _onClick = this._register(new Emitter<void>());
	public readonly onClick: Event<void> = this._onClick.event;

	private _onCompositionStart = this._register(new Emitter<ICompositionStartEvent>());
	public readonly onCompositionStart: Event<ICompositionStartEvent> = this._onCompositionStart.event;

	private _onCompositionUpdate = this._register(new Emitter<ICompositionData>());
	public readonly onCompositionUpdate: Event<ICompositionData> = this._onCompositionUpdate.event;

	private _onCompositionEnd = this._register(new Emitter<void>());
	public readonly onCompositionEnd: Event<void> = this._onCompositionEnd.event;


	private _onSelectionChange = this._register(new Emitter<TextSelection>());
	public readonly onSelectionChange: Event<TextSelection> = this._onSelectionChange.event;

	//#endregion

	private _onDidChange = this._register(new Emitter<string>());
	public readonly onDidChange: Event<string> = this._onDidChange.event;

	private editableStates: EditableState[] = [EditableState.EMPTY];
	private selectionChangeListener: IDisposable | null = null;

	private hasFocus: boolean = false;
	private currentComposition: CompositionContext | null = null;

	constructor(
		host: IEditableInputHost,
		private readonly editable: ICompleteEditableWrapper,
		private readonly OS: OperatingSystem,
		private readonly browser: IBrowser,
		options: EditableOptions
	) {
		super();

		this.registerListener();
	}

	get editableState(): EditableState {
		const selection = this.editable.getSelection();
		return this.editableStates[selection.lineNumber] || EditableState.EMPTY;
	}

	set editableState(state: EditableState) {
		const selection = this.editable.getSelection();
		this.editableStates[selection.lineNumber] = state;
	}

	private registerListener() {
		let lastKeyDown: IKeyboardEvent | null = null;

		this._register(this.editable.onInput((e) => {
			if (_debugComposition) {
				console.log(`[input]`, e);
			}

			if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
				return;
			}

			this._onType.fire({ text: this.editable.getValue() } as any);
		}));

		this._register(this.editable.onKeyDown((e) => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.KEY_IN_COMPOSITION
				|| (this.currentComposition && event.keyCode === KeyCode.Backspace)) {
				// Stop propagation for keyDown events if the IME is processing key input
				event.stopPropagation();
			}
			if (event.equals(KeyCode.Escape)) {
				// Prevent default always for `Esc`, otherwise it will generate a keypress
				// See https://msdn.microsoft.com/en-us/library/ie/ms536939(v=vs.85).aspx
				event.preventDefault();
			}

			lastKeyDown = event;
			this._onKeyDown.fire(event);
		}));

		this._register(this.editable.onCompositionStart((e) => {
			if (_debugComposition) {
				console.log(`[compositionstart]`, e);
			}

			const currentComposition = new CompositionContext();
			if (this.currentComposition) {
				// simply reset the composition context
				this.currentComposition = currentComposition;
				return;
			}
			this.currentComposition = currentComposition;

			if (
				this.OS === OperatingSystem.Macintosh
				&& lastKeyDown
				&& lastKeyDown.equals(KeyCode.KEY_IN_COMPOSITION)
				&& this.editableState.selectionStart === this.editableState.selectionEnd
				&& this.editableState.selectionStart > 0
				&& this.editableState.value.substr(this.editableState.selectionStart - 1, 1) === e.data
				&& (lastKeyDown.code === 'ArrowRight' || lastKeyDown.code === 'ArrowLeft')
			) {
				// Handling long press case on Chromium/Safari macOS + arrow key => pretend the character was selected
				if (_debugComposition) {
					console.log(`[compositionstart] Handling long press case on macOS + arrow key`, e);
				}
				// Pretend the previous character was composed (in order to get it removed by subsequent compositionupdate events)
				currentComposition.handleCompositionUpdate('x');
				this._onCompositionStart.fire({ data: e.data });
				return;
			}

			if (this.browser.isAndroid) {
				// when tapping on the editor, Android enters composition mode to edit the current word
				// so we cannot clear the textarea on Android and we must pretend the current word was selected
				this._onCompositionStart.fire({ data: e.data });
				return;
			}

			this._onCompositionStart.fire({ data: e.data });
		}));

		this._register(this.editable.onCompositionUpdate((e) => {
			if (_debugComposition) {
				console.log(`[compositionupdate]`, e);
			}
			const currentComposition = this.currentComposition;
			if (!currentComposition) {
				// should not be possible to receive a 'compositionupdate' without a 'compositionstart'
				return;
			}
			if (this.browser.isAndroid) {
				// On Android, the data sent with the composition update event is unusable.
				// For example, if the cursor is in the middle of a word like Mic|osoft
				// and Microsoft is chosen from the keyboard's suggestions, the e.data will contain "Microsoft".
				// This is not really usable because it doesn't tell us where the edit began and where it ended.
				const newState = EditableState.readFromEditable(this.editable, this.editableState);
				this.editableState = newState;
				this._onCompositionUpdate.fire(e);
				return;
			}
			this.editableState = EditableState.readFromEditable(this.editable, this.editableState);
			this._onCompositionUpdate.fire(e);
		}));

		this._register(this.editable.onCompositionEnd((e) => {
			if (_debugComposition) {
				console.log(`[compositionend]`, e);
			}
			const currentComposition = this.currentComposition;
			if (!currentComposition) {
				// https://github.com/microsoft/monaco-editor/issues/1663
				// On iOS 13.2, Chinese system IME randomly trigger an additional compositionend event with empty data
				return;
			}
			this.currentComposition = null;

			if (this.browser.isAndroid) {
				// On Android, the data sent with the composition update event is unusable.
				// For example, if the cursor is in the middle of a word like Mic|osoft
				// and Microsoft is chosen from the keyboard's suggestions, the e.data will contain "Microsoft".
				// This is not really usable because it doesn't tell us where the edit began and where it ended.
				const newState = EditableState.readFromEditable(this.editable, this.editableState);
				this.editableState = newState;

				this._onCompositionEnd.fire();
				return;
			}

			this.editableState = EditableState.readFromEditable(this.editable, this.editableState);
			this._onCompositionEnd.fire();
		}));

		this._register(this.editable.onFocus(() => {
			this.setHasFocus(true);
		}));
		this._register(this.editable.onBlur(() => {
			this.setHasFocus(false);
		}));
		this._register(this.editable.onClick(() => {
			this._onClick.fire();
		}));

		if (lastKeyDown) {

		}
	}

	private installSelectionChangeListener(): IDisposable {
		// See https://github.com/microsoft/vscode/issues/27216 and https://github.com/microsoft/vscode/issues/98256
		// When using a Braille display, it is possible for users to reposition the
		// system caret. This is reflected in Chrome as a `selectionchange` event.
		//
		// The `selectionchange` event appears to be emitted under numerous other circumstances,
		// so it is quite a challenge to distinguish a `selectionchange` coming in from a user
		// using a Braille display from all the other cases.
		//
		// The problems with the `selectionchange` event are:
		//  * the event is emitted when the textarea is focused programmatically -- textarea.focus()
		//  * the event is emitted when the selection is changed in the textarea programmatically -- textarea.setSelectionRange(...)
		//  * the event is emitted when the value of the textarea is changed programmatically -- textarea.value = '...'
		//  * the event is emitted when tabbing into the textarea
		//  * the event is emitted asynchronously (sometimes with a delay as high as a few tens of ms)
		//  * the event sometimes comes in bursts for a single logical textarea operation

		// `selectionchange` events often come multiple times for a single logical change
		// so throttle multiple `selectionchange` events that burst in a short period of time.
		let previousSelectionChangeEventTime = 0;
		return dom.addDisposableListener(document, 'selectionchange', (e) => {
			inputLatency.onSelectionChange();

			if (!this.hasFocus) {
				return;
			}

			const now = Date.now();

			const delta1 = now - previousSelectionChangeEventTime;
			previousSelectionChangeEventTime = now;
			if (delta1 < 5) {
				// received another `selectionchange` event within 5ms of the previous `selectionchange` event
				// => ignore it
				return;
			}

			const delta2 = now - this.editable.getIgnoreSelectionChangeTime();
			this.editable.resetSelectionChangeTime();
			if (delta2 < 100) {
				// received a `selectionchange` event within 100ms since we touched the textarea
				// => ignore it, since we caused it
				return;
			}

			const selectionWithOptions = getSelectionFromRange();

			if (selectionWithOptions) {
				const lineNumber = selectionWithOptions.selection.lineNumber;
				let editableState = this.editableStates[lineNumber] || EditableState.EMPTY;
				if (!editableState.value) {
					this.editableStates[lineNumber] = EditableState.readFromEditable(this.editable, editableState);
					editableState = this.editableStates[lineNumber];
				}

				this._onSelectionChange.fire(selectionWithOptions.selection);
			}
		});
	}

	public focusEditable(): void {
		// Setting this.hasFocus and writing the screen reader content
		// will result in a focus() and setSelectionRange() in the textarea
		this.setHasFocus(true);

		// If the editor is off DOM, focus cannot be really set, so let's double check that we have managed to set the focus
		//this.refreshFocusState();
	}

	public isFocused(): boolean {
		return this.hasFocus;
	}

	private setHasFocus(newHasFocus: boolean): void {
		if (this.hasFocus === newHasFocus) {
			// no change
			return;
		}
		this.hasFocus = newHasFocus;

		if (this.selectionChangeListener) {
			this.selectionChangeListener.dispose();
			this.selectionChangeListener = null;
		}
		if (this.hasFocus) {
			this.selectionChangeListener = this.installSelectionChangeListener();
		}

		if (this.hasFocus) {
			this._onFocus.fire();
		} else {
			this._onBlur.fire();
		}
	}

	public ensureSelection(selection: TextSelection) {
	}

	public override dispose(): void {
		super.dispose();
		if (this.selectionChangeListener) {
			this.selectionChangeListener.dispose();
			this.selectionChangeListener = null;
		}
	}

}

export class EditableWrapper extends Disposable implements ICompleteEditableWrapper {
	//#region events

	public readonly onKeyDown = this._register(new DomEmitter(this._actual, 'keydown')).event;
	public readonly onKeyPress = this._register(new DomEmitter(this._actual, 'keypress')).event;
	public readonly onKeyUp = this._register(new DomEmitter(this._actual, 'keyup')).event;
	public readonly onCompositionStart = this._register(new DomEmitter(this._actual, 'compositionstart')).event;
	public readonly onCompositionUpdate = this._register(new DomEmitter(this._actual, 'compositionupdate')).event;
	public readonly onCompositionEnd = this._register(new DomEmitter(this._actual, 'compositionend')).event;
	public readonly onBeforeInput = this._register(new DomEmitter(this._actual, 'beforeinput')).event;
	public readonly onInput = <Event<InputEvent>>this._register(new DomEmitter(this._actual, 'input')).event;
	public readonly onCut = this._register(new DomEmitter(this._actual, 'cut')).event;
	public readonly onCopy = this._register(new DomEmitter(this._actual, 'copy')).event;
	public readonly onPaste = this._register(new DomEmitter(this._actual, 'paste')).event;
	public readonly onFocus = this._register(new DomEmitter(this._actual, 'focus')).event;
	public readonly onBlur = this._register(new DomEmitter(this._actual, 'blur')).event;
	public readonly onClick = this._register(new DomEmitter(this._actual, 'click')).event;

	//#endregion

	private _ignoreSelectionChangeTime: number = 0;

	constructor(
		private readonly _actual: HTMLDivElement
	) {
		super();
	}

	public hasFocus(): boolean {
		const shadowRoot = dom.getShadowRoot(this._actual);
		if (shadowRoot) {
			return shadowRoot.activeElement === this._actual;
		} else if (dom.isInDOM(this._actual)) {
			return document.activeElement === this._actual;
		} else {
			return false;
		}
	}

	public setIgnoreSelectionChangeTime(reason: string): void {
		this._ignoreSelectionChangeTime = Date.now();
	}

	public getIgnoreSelectionChangeTime(): number {
		return this._ignoreSelectionChangeTime;
	}

	public resetSelectionChangeTime(): void {
		this._ignoreSelectionChangeTime = 0;
	}

	getDomNode() {
		return this._actual;
	}

	getValue(): string {
		const selection = this.getSelection();
		if (selection.lineNumber > 0 && this._actual.childNodes.length > 0) {
			return serializeNode(this._actual.childNodes[selection.lineNumber - 1]);
		}
		return serializeNode(this._actual);
	}

	setValue(reason: string, value: string): void {
		const editable = this._actual;
		if (editable.innerHTML === value) {
			// No change
			return;
		}
		editable.innerHTML = value;
	}
	getSelection(): TextSelection {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection;
		}
		return { startIndex: 0, endIndex: 0, lineNumber: -1 };
	}

	getSelectionStart(): number {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection.startIndex;
		}
		return 0;
	}

	getSelectionEnd(): number {
		const selectionWithOptions = getSelectionFromRange();
		if (selectionWithOptions) {
			return selectionWithOptions?.selection.endIndex;
		}
		return 0;
	}
	setSelectionRange(reason: string, selectionStart: number, selectionEnd: number): void {
		throw new Error('Method not implemented.');
	}
}
