import { CSSProperties } from 'mote/base/browser/jsx';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { ThemedColors } from 'mote/base/common/themes';
import { $, addDisposableListener, EventHelper, EventType, IFocusTracker, reset, trackFocus } from 'mote/base/browser/dom';
import { Gesture, EventType as TouchEventType } from 'mote/base/browser/touch';
import { Color } from 'mote/base/common/color';
import { Emitter, Event as BaseEvent } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { mixin } from 'mote/base/common/objects';
import { IThemable } from 'mote/base/common/styler';
import { StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { KeyCode } from 'mote/base/common/keyCodes';
import { ThemeIcon } from 'mote/base/common/themables';
import { renderLabelWithIcons } from 'mote/base/browser/ui/iconLabel/iconLabels';

export interface IButton extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidClick: BaseEvent<Event | undefined>;
}

export interface IButtonOptions extends IButtonStyles {
	readonly title?: boolean | string;
	readonly supportIcons?: boolean;
	readonly supportShortLabel?: boolean;
	readonly secondary?: boolean;
}

export interface IButtonStyles {
	readonly buttonBackground: string | undefined;
	readonly buttonHoverBackground: string | undefined;
	readonly buttonForeground: string | undefined;
	readonly buttonSeparator: string | undefined;
	readonly buttonSecondaryBackground: string | undefined;
	readonly buttonSecondaryHoverBackground: string | undefined;
	readonly buttonSecondaryForeground: string | undefined;
	readonly buttonBorder: string | undefined;
}

export interface IButtonWithDescription extends IButton {
	description: string;
}

export class Button extends Disposable implements IButton {

	protected options: IButtonOptions;
	protected _element: HTMLElement;
	protected _labelElement: HTMLElement | undefined;
	protected _labelShortElement: HTMLElement | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(container: HTMLElement, options: IButtonOptions) {
		super();

		this.options = options;

		this._element = document.createElement('a');
		this._element.classList.add('monaco-button');
		this._element.tabIndex = 0;
		this._element.setAttribute('role', 'button');

		const background = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
		const foreground = options.secondary ? options.buttonSecondaryForeground : options.buttonForeground;

		this._element.style.color = foreground || '';
		this._element.style.backgroundColor = background || '';

		if (options.supportShortLabel) {
			this._labelShortElement = document.createElement('div');
			this._labelShortElement.classList.add('monaco-button-label-short');
			this._element.appendChild(this._labelShortElement);

			this._labelElement = document.createElement('div');
			this._labelElement.classList.add('monaco-button-label');
			this._element.appendChild(this._labelElement);

			this._element.classList.add('monaco-text-button-with-short-label');
		}

		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = false;
			if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
				this._onDidClick.fire(e);
				eventHandled = true;
			} else if (event.equals(KeyCode.Escape)) {
				this._element.blur();
				eventHandled = true;
			}

			if (eventHandled) {
				EventHelper.stop(event, true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.updateBackground(true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.updateBackground(false); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => { if (this.enabled) { this.updateBackground(true); } }));
		this._register(this.focusTracker.onDidBlur(() => { if (this.enabled) { this.updateBackground(false); } }));
	}

	private getContentElements(content: string): HTMLElement[] {
		const elements: HTMLSpanElement[] = [];
		for (let segment of renderLabelWithIcons(content)) {
			if (typeof (segment) === 'string') {
				segment = segment.trim();

				// Ignore empty segment
				if (segment === '') {
					continue;
				}

				// Convert string segments to <span> nodes
				const node = document.createElement('span');
				node.textContent = segment;
				elements.push(node);
			} else {
				elements.push(segment);
			}
		}

		return elements;
	}

	private updateBackground(hover: boolean): void {
		let background;
		if (this.options.secondary) {
			background = hover ? this.options.buttonSecondaryHoverBackground : this.options.buttonSecondaryBackground;
		} else {
			background = hover ? this.options.buttonHoverBackground : this.options.buttonBackground;
		}
		if (background) {
			this._element.style.backgroundColor = background;
		}
	}

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string) {
		this._element.classList.add('monaco-text-button');
		const labelElement = this.options.supportShortLabel ? this._labelElement! : this._element;

		if (this.options.supportIcons) {
			reset(labelElement, ...this.getContentElements(value));
		} else {
			labelElement.textContent = value;
		}

		if (typeof this.options.title === 'string') {
			this._element.title = this.options.title;
		} else if (this.options.title) {
			this._element.title = value;
		}
	}

	set labelShort(value: string) {
		if (!this.options.supportShortLabel || !this._labelShortElement) {
			return;
		}

		if (this.options.supportIcons) {
			reset(this._labelShortElement, ...this.getContentElements(value));
		} else {
			this._labelShortElement.textContent = value;
		}
	}

	set icon(icon: ThemeIcon) {
		this._element.classList.add(...ThemeIcon.asClassNameArray(icon));
	}

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
		}
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}

	focus(): void {
		this._element.focus();
	}

	hasFocus(): boolean {
		return this._element === document.activeElement;
	}
}

interface ISwitchButtonStyles extends IButtonStyles {
	switchTurnOnBackground?: Color;
	switchTurnOffBackground?: Color;
	switchShadow?: Color;
	circleBackground?: Color;
	circleShadow?: Color;
}


export class SwitchButton extends Disposable implements IThemable {

	private button: Button;

	public onDidSwitch: BaseEvent<Event>;

	private _turnOn: boolean;

	private switcherDomNode: HTMLElement;
	private circleDomNode: HTMLElement;

	private styles: ISwitchButtonStyles = {};

	constructor(parent: HTMLElement, turnOn = false) {
		super();

		this.button = new Button(parent, {});
		this.onDidSwitch = this.button.onDidClick;
		this._turnOn = turnOn;

		this.button.onDidClick(() => {
			this._turnOn = !this._turnOn;
			this.update();
		});

		this.switcherDomNode = document.createElement('div');
		this.circleDomNode = document.createElement('div');
		this.switcherDomNode.appendChild(this.circleDomNode);
		this.button.element.appendChild(this.switcherDomNode);

		setStyles(this.switcherDomNode, this.getStyle());
		setStyles(this.circleDomNode, this.getCircleStyle());
	}

	public style(styles: ISwitchButtonStyles) {
		this.styles = styles;
		//this.button.style(styles);
		this.update();
	}

	private update() {
		const translateXArg = this.turnOn ? 16 - 2 * this.getCircleSpacing() : 0;

		const swictherBackground = this.turnOn ? `${this.styles.switchTurnOnBackground}` : `${this.styles.switchTurnOffBackground}`;
		//const circleBackground = this.turnOn ? ThemedColors.blue : ThemedColors.white;
		const switchBoxShadow = this.turnOn ? '' : `inset 0 0 0 1px ${this.styles.switchShadow}`;

		this.switcherDomNode.style.background = swictherBackground;
		this.switcherDomNode.style.boxShadow = switchBoxShadow;

		//this.circleDomNode.style.background = circleBackground;
		this.circleDomNode.style.transform = `translateX(${translateXArg}px)`;

	}

	private getStyle(): CSSProperties {
		return {
			display: 'flex',
			flexShrink: 0,
			height: `${18 - 2 * this.getCircleSpacing()}px`,
			width: `${30 - 2 * this.getCircleSpacing()}px`,
			borderRadius: '44px',
			padding: `${this.getCircleSpacing()}px`,
			boxSizing: 'content-box',
			boxShadow: this._turnOn ? '' : `inset 0 0 0 1px ${this.styles.switchShadow}`,
			transition: 'background 200ms, box-shadow 200ms'
		};
	}

	private getCircleStyle() {
		const translateXArg = this.turnOn ? 16 - 2 * this.getCircleSpacing() : 0;
		const size = 18 - 2 * this.getCircleSpacing();
		return {
			width: `${size}px`,
			height: `${size}px`,
			borderRadius: '44px',
			background: ThemedColors.white,
			transition: 'transform 200ms ease-out, background 200ms ease-out',
			transform: `translateX(${translateXArg}px)`
		};
	}

	private getCircleSpacing() {
		return 2;
	}

	get turnOn() {
		return this._turnOn;
	}

	getContainer() {
		return this.button.element;
	}
}

export class ButtonWithDescription implements IButtonWithDescription {
	private _button: Button;
	private _element: HTMLElement;
	private _descriptionElement: HTMLElement;

	constructor(container: HTMLElement, private readonly options: IButtonOptions) {
		this._element = document.createElement('div');
		this._element.classList.add('monaco-description-button');
		this._button = new Button(this._element, options);

		this._descriptionElement = document.createElement('div');
		this._descriptionElement.classList.add('monaco-button-description');
		this._element.appendChild(this._descriptionElement);

		container.appendChild(this._element);
	}

	get onDidClick(): BaseEvent<Event | undefined> {
		return this._button.onDidClick;
	}

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string) {
		this._button.label = value;
	}

	set icon(icon: ThemeIcon) {
		this._button.icon = icon;
	}

	get enabled(): boolean {
		return this._button.enabled;
	}

	set enabled(enabled: boolean) {
		this._button.enabled = enabled;
	}

	focus(): void {
		this._button.focus();
	}
	hasFocus(): boolean {
		return this._button.hasFocus();
	}
	dispose(): void {
		this._button.dispose();
	}

	set description(value: string) {
		if (this.options.supportIcons) {
			reset(this._descriptionElement, ...renderLabelWithIcons(value));
		} else {
			this._descriptionElement.textContent = value;
		}
	}
}

export class ButtonBar extends Disposable {

	private _buttons: IButton[] = [];

	constructor(private readonly container: HTMLElement) {
		super();
	}

	get buttons(): IButton[] {
		return this._buttons;
	}

	addButton(options: IButtonOptions): IButton {
		const button = this._register(new Button(this.container, options));
		this.pushButton(button);
		return button;
	}

	addButtonWithDescription(options: IButtonOptions): IButtonWithDescription {
		const button = this._register(new ButtonWithDescription(this.container, options));
		this.pushButton(button);
		return button;
	}

	addButtonWithDropdown(options: IButtonWithDropdownOptions): IButton {
		const button = this._register(new ButtonWithDropdown(this.container, options));
		this.pushButton(button);
		return button;
	}

	private pushButton(button: IButton): void {
		this._buttons.push(button);

		const index = this._buttons.length - 1;
		this._register(addDisposableListener(button.element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = true;

			// Next / Previous Button
			let buttonIndexToFocus: number | undefined;
			if (event.equals(KeyCode.LeftArrow)) {
				buttonIndexToFocus = index > 0 ? index - 1 : this._buttons.length - 1;
			} else if (event.equals(KeyCode.RightArrow)) {
				buttonIndexToFocus = index === this._buttons.length - 1 ? 0 : index + 1;
			} else {
				eventHandled = false;
			}

			if (eventHandled && typeof buttonIndexToFocus === 'number') {
				this._buttons[buttonIndexToFocus].focus();
				EventHelper.stop(e, true);
			}

		}));
	}
}
