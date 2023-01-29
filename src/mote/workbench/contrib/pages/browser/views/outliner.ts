/* eslint-disable code-no-unexternalized-strings */
import { setStyles } from "mote/base/browser/jsx/createElement";
import fonts from "mote/base/browser/ui/fonts";
import RecordStore from "mote/platform/store/common/recordStore";
import { $ } from "mote/base/browser/dom";
import { IDisposable } from "mote/base/common/lifecycle";


export class NameFromStore {

	public element!: HTMLElement;

	private shouldWrap?: boolean;
	private placeholder?: string;
	private _store!: RecordStore;
	private listener!: IDisposable;

	private domNode!: Text;

	constructor(store: RecordStore) {
		this.store = store;
		this.create();
	}

	create() {
		this.element = $("");
		setStyles(this.element, this.getStyle());
		this.domNode = document.createTextNode(this.getTitle());
		this.element.appendChild(this.domNode);
	}

	set store(value: RecordStore) {
		if (this.listener) {
			this.listener.dispose();
		}
		this._store = value;
		this.listener = this._store.onDidChange(this.update);
	}

	private update = () => {
		this.domNode.textContent = this.getTitle();
	};

	getStyle = () => {
		return Object.assign({}, !this.shouldWrap && fonts.textOverflowStyle || {});
	};

	getTitle = () => {
		const title = this._store.getValue() || [];
		if (title.length > 0) {
			return title.join("");
		}
		return this.getEmptyTitle();
	};

	getEmptyTitle = () => {
		if (this.placeholder) {
			return this.placeholder;
		} else {
			return "Untitled";
		}
	};
}
