import { Disposable, IDisposable } from "vs/base/common/lifecycle";
import { $ } from "vs/base/browser/dom";
import { CSSProperties } from "mote/base/browser/jsx";
import { setStyles } from "mote/base/browser/jsx/createElement";
import { Widget } from "vs/base/browser/ui/widget";
import { nodeToString } from "../common/textSerialize";
import { Emitter, Event } from "vs/base/common/event";
import { TextSelection } from "../common/core/selectionUtils";
import { RangeUtils } from 'mote/editor/common/core/rangeUtils';

interface EditableOptions {
	getSelection?(): TextSelection | undefined;
	placeholder?: string;
}

export class Editable extends Widget {
	private options: EditableOptions;

	private input: HTMLElement;
	private testDiv = $('div');

	private selection: TextSelection | undefined;

	private _onDidChange = this._register(new Emitter<string>());
	public readonly onDidChange: Event<string> = this._onDidChange.event;

	constructor(container: HTMLElement, options: EditableOptions) {
		super();
		this.options = options;
		this.input = $("");
		this.input.contentEditable = "true";
		this.input.setAttribute("data-root", "");
		this.input.tabIndex = 0;
		if (options.placeholder) {
			this.input.setAttribute("placeholder", options.placeholder);
		}

		this.oninput(this.input, () => this.onValueChange());

		container.append(this.input);
	}

	public get value(): string {
		return nodeToString(this.input);
	}

	public get element() {
		return this.input;
	}

	public set value(newValue: string) {
		this.testDiv.innerHTML = newValue;
		if (this.input.innerHTML != this.testDiv.innerHTML) {
			this.input.innerHTML = newValue;

		}
		if (this.options.getSelection) {
			this.selection = this.options.getSelection();
		}
		if (this.selection) {
			const rangeFromElement = RangeUtils.create(this.input, this.selection);
			const rangeFromDocument = RangeUtils.get();
			if (!RangeUtils.ensureRange(rangeFromDocument, rangeFromElement)) {
				RangeUtils.set(rangeFromElement);
			}
		}
	}

	private onValueChange() {
		this._onDidChange.fire(this.value);
	}

	style(value: CSSProperties) {
		this.input.removeAttribute("style");
		setStyles(this.input, value);
	}
}
