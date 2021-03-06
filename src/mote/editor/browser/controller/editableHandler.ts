import * as browser from 'vs/base/browser/browser';
import * as platform from 'vs/base/common/platform';
import { ClipboardDataToCopy, EditableInput, EditableWrapper, IEditableInputHost } from 'mote/editor/browser/controller/editableInput';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { ITypeData, _debugComposition } from 'mote/editor/browser/controller/editableState';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ThemedStyles } from 'mote/base/common/themes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { RangeUtils, TextSelection } from 'mote/editor/common/core/rangeUtils';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { setStyles } from 'mote/base/browser/jsx/createElement';

interface EditableHandlerOptions {
	placeholder?: string;
}

export class EditableHandler extends ViewPart {

	public readonly editable: FastDomNode<HTMLDivElement>;
	private editableInput: EditableInput;
	private editableWrapper: EditableWrapper;

	constructor(
		private readonly lineNumber: number,
		context: ViewContext,
		private readonly viewController: ViewController,
		private readonly options: EditableHandlerOptions,
	) {
		super(context);
		this.editable = createFastDomNode(document.createElement('div'));
		this.editable.setAttribute('contenteditable', '');

		const editableInputHost: IEditableInputHost = {
			getDataToCopy: (): ClipboardDataToCopy => {
				return null as any;
			}
		};

		this.editableWrapper = this._register(new EditableWrapper(this.editable.domNode));
		this.editableInput = this._register(new EditableInput(editableInputHost, this.editableWrapper, platform.OS, browser, {}));

		this.registerListener();
	}

	public prepareRender(): void {
		throw new Error('Method not implemented.');
	}
	public render(): void {
		throw new Error('Method not implemented.');
	}

	public applyStyles(style: CSSProperties) {
		setStyles(this.editable.domNode, style);
	}

	public focusEditable(): void {
		this.editableInput.focusEditable();
	}

	public setValue(value: string) {
		this.editableWrapper.setValue('', value);
		const selection = this.viewController.getSelection();
		if (this.editableInput.isFocused() && selection.startIndex > 0) {
			this.ensureSelection(selection);
		}
	}

	private isEmpty() {
		return this.viewController.isEmpty(this.lineNumber);
	}

	//#region view event handlers

	//#endregion

	private registerListener() {
		this._register(this.editableInput.onType((e: ITypeData) => {
			if (e.replacePrevCharCnt || e.replaceNextCharCnt || e.positionDelta) {
				// must be handled through the new command
				if (_debugComposition) {
					console.log(` => compositionType: <<${e.type}>>, ${e.replacePrevCharCnt}, ${e.replaceNextCharCnt}, ${e.positionDelta}`);
				}
				this.viewController.compositionType(e.text, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
			} else {
				if (_debugComposition) {
					console.log(` => type: <<${e.type}>>`);
				}
				this.viewController.type(e.text);
			}
			if (!this.isEmpty() && this.options.placeholder) {
				// remove placeholder text style
				this.editable.domNode.style.webkitTextFillColor = '';
			}
		}));
		this._register(this.editableInput.onKeyDown((e) => {
			const event = e as StandardKeyboardEvent;
			if (event.equals(KeyCode.Enter)) {
				this.viewController.enter();
			}
			if (event.equals(KeyCode.Backspace)) {
				this.viewController.backspace();
			}
		}));
		this._register(this.editableInput.onSelectionChange((e) => {
			e.lineNumber = this.lineNumber;
			this.viewController.select(e);
		}));
		this._register(this.editableInput.onFocus((e) => {
			setTimeout(() => {
				// force focus to set range
				this.editable.domNode.focus();
				const selection = this.viewController.getSelection();
				// line number less than 0 means view controller not initialized yet
				if (selection.lineNumber >= 0 && selection.startIndex >= 0) {
					this.ensureSelection(selection);
				}
			}, 0);

			if (this.options.placeholder && this.isEmpty()) {
				// add placeholder and placeholder text style
				this.editable.setAttribute('placeholder', this.options.placeholder);
				this.editable.domNode.style.webkitTextFillColor = ThemedStyles.lightTextColor.dark;
			}
		}));
		this._register(this.editableInput.onBlur((e) => {
			if (this.options.placeholder) {
				this.editable.removeAttribute('placeholder');
			}
		}));
	}

	private ensureSelection(selection: TextSelection) {
		const rangeFromElement = RangeUtils.create(this.editable.domNode, selection);
		const rangeFromDocument = RangeUtils.get();
		if (!RangeUtils.ensureRange(rangeFromDocument, rangeFromElement)) {
			RangeUtils.set(rangeFromElement);
		}
	}
}
