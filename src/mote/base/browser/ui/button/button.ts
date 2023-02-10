import { CSSProperties } from 'mote/base/browser/jsx';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { ThemedColors } from 'mote/base/common/themes';
import { $, addDisposableListener, EventHelper, EventType, reset } from 'mote/base/browser/dom';
import { Gesture, EventType as TouchEventType } from 'mote/base/browser/touch';
import { Color } from 'mote/base/common/color';
import { Emitter, Event as BaseEvent } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { mixin } from 'mote/base/common/objects';
import { IThemable } from 'mote/base/common/styler';
import { StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { KeyCode } from 'mote/base/common/keyCodes';

export interface IButton extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidClick: BaseEvent<Event | undefined>;
}

export interface IButtonOptions extends IButtonStyles {
	style?: CSSProperties;
	hoverStyle?: CSSProperties;
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

const defaultOptions: IButtonStyles = {
	//buttonBackground: Color.fromHex('#0E639C'),
	buttonHoverBackground: Color.fromHex('#37352f14'),
	buttonForeground: Color.white,
};

export interface IButtonWithDescription extends IButton {
	description: string;
}

export class Button extends Disposable implements IButton {

	protected _element: HTMLElement;
	protected options: IButtonOptions;

	private buttonHoverBackground: Color | undefined;
	private buttonBackground: Color | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super();

		this.options = options || Object.create(null);
		mixin(this.options, defaultOptions, false);
		this.buttonHoverBackground = this.options.buttonHoverBackground;
		this.buttonBackground = this.options.buttonBackground;

		this._element = $('div');

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

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.setHoverBackground();
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.applyStyles(); // restore standard styles
		}));

		this.applyStyles();
	}

	public style(style: IButtonStyles) {
		this.buttonHoverBackground = style.buttonHoverBackground;
		if (style.buttonBorderColor) {
			this.element.style.border = `1px solid ${style.buttonBorderColor}`;
		}

		this.applyStyles();
	}

	private setHoverBackground(): void {
		const style = Object.assign({
			backgroundColor: this.buttonHoverBackground?.toString()
		}, this.options.hoverStyle);
		setStyles(this._element, style);
	}

	private applyStyles(): void {
		if (this._element) {
			const style = Object.assign({
				cursor: 'pointer',
				backgroundColor: this.buttonBackground || '',
				transition: 'background 20ms ease-in 0s'
			}, this.options.style);
			setStyles(this._element, style);
		}
	}

	setChildren(...value: Array<Node | string>) {
		reset(this._element, ...value);
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

	get element(): HTMLElement {
		return this._element;
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

		this.button = new Button(parent);
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
		this.button.style(styles);
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
