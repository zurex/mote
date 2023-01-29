/* eslint-disable code-no-unexternalized-strings */
import { CSSProperties } from 'mote/base/browser/jsx';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import * as DOM from 'mote/base/browser/dom';
import { addDisposableListener, EventType, IFocusTracker, trackFocus } from 'mote/base/browser/dom';
import { EventType as TouchEventType, Gesture, GestureEvent } from 'mote/base/browser/touch';
import { Color } from 'mote/base/common/color';
import { Emitter, Event as BaseEvent } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IDragAndDropData } from 'mote/base/browser/dnd';
import { IKeyboardEvent } from 'mote/base/browser/keyboardEvent';

export interface IListVirtualDelegate<T> {
	getHeight(element: T): number;
	getTemplateId(element: T): string;
	hasDynamicHeight?(element: T): boolean;
	getDynamicHeight?(element: T): number | null;
	setDynamicHeight?(element: T, height: number): void;
}

export interface IListRenderer<T, TTemplateData> {
	readonly templateId: string;
	renderTemplate(container: HTMLElement): TTemplateData;
	renderElement(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
	disposeElement?(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
	disposeTemplate(templateData: TTemplateData): void;
}

export interface IListEvent<T> {
	elements: T[];
	indexes: number[];
	browserEvent?: UIEvent;
}

export interface IListMouseEvent<T> {
	browserEvent: MouseEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListTouchEvent<T> {
	browserEvent: TouchEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListGestureEvent<T> {
	browserEvent: GestureEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListDragEvent<T> {
	browserEvent: DragEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListContextMenuEvent<T> {
	browserEvent: UIEvent;
	element: T | undefined;
	index: number | undefined;
	anchor: HTMLElement | { x: number; y: number };
}

export interface IIdentityProvider<T> {
	getId(element: T): { toString(): string };
}

export interface IKeyboardNavigationLabelProvider<T> {

	/**
	 * Return a keyboard navigation label(s) which will be used by
	 * the list for filtering/navigating. Return `undefined` to make
	 * an element always match.
	 */
	getKeyboardNavigationLabel(element: T): { toString(): string | undefined } | { toString(): string | undefined }[] | undefined;
}

export interface IKeyboardNavigationDelegate {
	mightProducePrintableCharacter(event: IKeyboardEvent): boolean;
}

export const enum ListDragOverEffect {
	Copy,
	Move
}

export interface IListDragOverReaction {
	accept: boolean;
	effect?: ListDragOverEffect;
	feedback?: number[]; // use -1 for entire list
}

export const ListDragOverReactions = {
	reject(): IListDragOverReaction { return { accept: false }; },
	accept(): IListDragOverReaction { return { accept: true }; },
};

export interface IListDragAndDrop<T> {
	getDragURI(element: T): string | null;
	getDragLabel?(elements: T[], originalEvent: DragEvent): string | undefined;
	onDragStart?(data: IDragAndDropData, originalEvent: DragEvent): void;
	onDragOver(data: IDragAndDropData, targetElement: T | undefined, targetIndex: number | undefined, originalEvent: DragEvent): boolean | IListDragOverReaction;
	onDragLeave?(data: IDragAndDropData, targetElement: T | undefined, targetIndex: number | undefined, originalEvent: DragEvent): void;
	drop(data: IDragAndDropData, targetElement: T | undefined, targetIndex: number | undefined, originalEvent: DragEvent): void;
	onDragEnd?(originalEvent: DragEvent): void;
}

export class ListError extends Error {

	constructor(user: string, message: string) {
		super(`ListError [${user}] ${message}`);
	}
}

export abstract class CachedListVirtualDelegate<T extends object> implements IListVirtualDelegate<T> {

	private cache = new WeakMap<T, number>();

	getHeight(element: T): number {
		return this.cache.get(element) ?? this.estimateHeight(element);
	}

	protected abstract estimateHeight(element: T): number;
	abstract getTemplateId(element: T): string;

	setDynamicHeight(element: T, height: number): void {
		if (height > 0) {
			this.cache.set(element, height);
		}
	}
}



export interface ListItemOptions {
	enableClick: boolean;
	style?: CSSProperties;
	isMobile?: boolean;
}

interface IListItemStyles {
	hoverBackground: Color;
}

export class ListItem extends Disposable {

	private options: ListItemOptions;

	protected _element: HTMLElement;

	private leftContainer?: HTMLElement;
	private rightContainer?: HTMLElement;
	private iconContainer?: HTMLElement;
	private childContainer?: HTMLElement;

	private hoverBackground: Color | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(element: HTMLElement, options: ListItemOptions) {
		super();

		this.options = options;

		this._element = element;
		setStyles(this._element, this.getStyle());

		this._register(Gesture.addTarget(this._element));

		// Click event
		[DOM.EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(DOM.addDisposableListener(this._element, eventType, e => {
				if (!options.enableClick) {
					DOM.EventHelper.stop(e);
					return;
				}
				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.updateByState(true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.updateByState(false); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => this.updateByState(true)));
		this._register(this.focusTracker.onDidBlur(() => this.updateByState(false))); // restore standard styles
	}

	public create() {
		if (this.leftContainer) {
			this._element.append(this.leftContainer);
		}
		if (this.iconContainer) {
			setStyles(this.iconContainer, this.getIconStyle());
			this._element.append(this.iconContainer);
		}
		if (this.childContainer) {
			this._element.append(this.childContainer);
		}
		if (this.rightContainer) {
			this._element.append(this.rightContainer);
		}
	}

	public set left(value: HTMLElement) {
		if (!this.leftContainer) {
			this.leftContainer = DOM.$("");
		}
		if (this.leftContainer.lastChild) {
			this.leftContainer.removeChild(this.leftContainer.lastChild);
		}
		this.leftContainer.append(value);
	}

	public set icon(value: HTMLElement) {
		if (!this.iconContainer) {
			this.iconContainer = DOM.$("");
		}
		if (this.iconContainer.lastChild) {
			this.iconContainer.removeChild(this.iconContainer.lastChild);
		}
		this.iconContainer.append(value);
	}

	public set right(value: HTMLElement) {

	}

	public set child(value: HTMLElement) {
		if (!this.childContainer) {
			this.childContainer = DOM.$('');
		}
		this.update(this.childContainer, value);
	}

	private update(container: HTMLElement, value: HTMLElement) {
		if (container.lastChild) {
			container.removeChild(container.lastChild);
		}
		container.append(value);
	}

	private updateByState(focused: boolean) {
		if (focused && this.hoverBackground) {
			this._element.style.backgroundColor = this.hoverBackground.toString();
		} else {
			this._element.style.backgroundColor = '';
		}
	}

	public style(styles: IListItemStyles) {
		this.hoverBackground = styles.hoverBackground;
		//this.applyStyles();
	}

	getStyle() {
		const style = Object.assign({}, styles.column_wrapStyle) as CSSProperties;
		if (this.options.style?.paddingLeft && "number" === typeof (this.options.style.paddingLeft)) {
			style.paddingLeft = this.options.style.paddingLeft;
		}
		return Object.assign({}, style, this.options.style);
	}

	getLeftStyle() {
		return {
			flexShrink: 0,
			flexGrow: 0,
			borderRadius: '3px',
			//color: themedStyles.mediumTextColor,
			width: this.options.isMobile ? '26px' : '22px',
			height: this.options.isMobile ? '24px' : '22px',
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			//marginRight: props.icon ? 0 : 8
		};
	}

	getIconStyle() {
		return {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			flexGrow: 0,
			width: this.options.isMobile ? "28px" : "22px",
			height: this.options.isMobile ? "24px" : "18px",
			marginRight: "4px"
		};
	}
}

const styles = {
	column_wrapStyle: {
		display: "flex",
		alignItems: "center",
		minHeight: "27px",
		fontSize: "14px",
		paddingTop: "2px",
		paddingBottom: "2px",
		paddingLeft: "14px",
		paddingRight: "14px",
		cursor: "pointer"
	}
}
