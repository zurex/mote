import * as browser from 'mote/base/browser/browser';
import * as platform from 'mote/base/common/platform';
import { ClipboardDataToCopy, EditableInput, EditableWrapper, IEditableInputHost } from 'mote/editor/browser/controller/editableInput';
import { ViewPart } from 'mote/editor/browser/view/viewPart';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { ITypeData, _debugComposition } from 'mote/editor/browser/controller/editableState';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { RangeUtils, TextSelection } from 'mote/editor/common/core/rangeUtils';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { Color } from 'mote/base/common/color';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { KeyCode } from 'mote/base/common/keyCodes';

export interface EditableHandlerOptions {
	placeholder?: string;
	forcePlaceholder?: boolean;
}

export interface ICommandDelegate {

	isEmpty(lineNumber: number): boolean;
	getSelection(): EditorSelection;
	type(text: string): void;
	compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): void;
	select(e: TextSelection): void;
	backspace(): void;
	enter(): boolean;
}

interface IEditableHandlerStyles {
	textFillColor: Color;
}

export class EditableHandler extends ViewPart {

	public readonly editable: FastDomNode<HTMLDivElement>;
	private editableInput: EditableInput;
	private editableWrapper: EditableWrapper;

	private textFillColor: Color | undefined;

	constructor(
		private readonly lineNumber: number,
		context: ViewContext,
		private readonly viewController: ViewController,
		private readonly options: EditableHandlerOptions,
		domNode?: HTMLDivElement,
	) {
		super(context);
		this.editable = createFastDomNode(domNode ? domNode : document.createElement('div'));
		this.editable.setAttribute('contenteditable', '');

		const editableInputHost: IEditableInputHost = {
			getDataToCopy: (): ClipboardDataToCopy => {
				return null as any;
			}
		};

		this.editableWrapper = this._register(new EditableWrapper(this.editable.domNode));
		this.editableInput = this._register(new EditableInput(editableInputHost, this.editableWrapper, platform.OS, browser, {}));
		this._applyStyles();
		this.registerListener();
	}

	public prepareRender(): void {

	}
	public render(): void {

	}

	/**
	 * Todo remove it later, use style instead
	 * @param style
	 */
	public applyStyles(style: CSSProperties) {
		setStyles(this.editable.domNode, style);
	}

	public style(style: IEditableHandlerStyles) {
		this.textFillColor = style.textFillColor;
		this._applyStyles();
	}

	private _applyStyles() {
		if (this.options.forcePlaceholder && this.options.placeholder) {
			this.editable.setAttribute('placeholder', this.options.placeholder);
			if (this.isEmpty() && this.textFillColor) {
				this.editable.domNode.style.webkitTextFillColor = this.textFillColor.toString();
			}
		}
	}

	public isFocused(): boolean {
		return this.editableInput.isFocused();
	}

	public focusEditable(): void {
		this.editableInput.focusEditable();
	}

	public setEnabled(enabled: boolean) {
		if (enabled) {
			this.editable.setAttribute('contenteditable', 'true');
		} else {
			this.editable.setAttribute('contenteditable', 'false');
		}
	}

	public setValue(value: string) {
		this.editableWrapper.setValue('', value);
		const selection = this.viewController.getSelection();
		if (this.editableInput.isFocused() && selection.startColumn > 0) {
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
				this.viewController.editableCompositionType(e.type, e.replacePrevCharCnt, e.replaceNextCharCnt, e.positionDelta);
			} else {
				if (_debugComposition) {
					console.log(` => type: <<${e.type}>>`);
				}
				this.viewController.editableType(e.type);
			}
			if (!this.isEmpty() && this.options.placeholder) {
				// remove placeholder text style
				this.editable.domNode.style.webkitTextFillColor = '';
			}
		}));

		this._register(this.editableInput.onKeyDown((e) => {
			this.viewController.emitKeyDown(e);
			if (e.keyCode === KeyCode.Enter) {
				// a hot fix plan for onType doesn't works well when type enter
				this.viewController.type('\n');
				e.preventDefault();
			}
			/*
			const event = e as StandardKeyboardEvent;

			if (event.equals(KeyCode.Backspace)) {
				this.viewController.backspace();
			}
			*/
		}));

		this._register(this.editableInput.onSelectionChange((e) => {
			e.lineNumber = e.lineNumber - 1;
			this.viewController.select(e);
		}));
		this._register(this.editableInput.onFocus((e) => {
			// wait 10ms for selection change
			setTimeout(() => {
				// force focus to set range
				this.editable.domNode.focus();
				const selection = this.viewController.getSelection();
				// line number less than 0 means view controller not initialized yet
				if (selection.startLineNumber > 0 && selection.startColumn > 0 && this.lineNumber > 0) {
					this.ensureSelection(selection);
				}
			}, 10);

			if (this.options.placeholder && this.isEmpty()) {
				// add placeholder and placeholder text style
				this.editable.setAttribute('placeholder', this.options.placeholder);
				if (this.textFillColor) {
					this.editable.domNode.style.webkitTextFillColor = this.textFillColor.toString();
				}
			}
			this.context.viewModel.setHasFocus(true);
		}));
		this._register(this.editableInput.onBlur((e) => {
			if (this.options.placeholder && !(this.options.forcePlaceholder === true)) {
				this.editable.removeAttribute('placeholder');
			}
			this.context.viewModel.setHasFocus(false);
		}));
	}

	public ensureSelection(selection?: EditorSelection) {
		if (!selection) {
			selection = this.viewController.getSelection();
		}
		this.editableInput.ensureSelection(selection);
	}
}
