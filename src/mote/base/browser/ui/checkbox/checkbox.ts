import { addDisposableListener, EventHelper, EventType } from 'mote/base/browser/dom';
import { Emitter, Event as BaseEvent } from 'mote/base/common/event';
import { Gesture, EventType as TouchEventType } from 'mote/base/browser/touch';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';


export interface ICheckBox extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidClick: BaseEvent<Event | undefined>;
}

export class CheckBox extends Disposable implements ICheckBox {
	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	protected _element: HTMLInputElement;

	constructor(container: HTMLElement) {
		super();

		this._element = document.createElement('input');
		this._element.setAttribute('type', 'checkbox');

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

		container.appendChild(this._element);
	}

	checked(value: boolean) {
		this._element.checked = value;
	}

	hasChecked() {
		return this._element.checked;
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

	get element(): HTMLElement {
		return this._element;
	}
}
