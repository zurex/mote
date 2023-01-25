import { Emitter } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { ViewEvent } from 'mote/editor/common/viewEvents';
import { OutgoingViewModelEvent, ViewModelEventsCollector } from 'mote/editor/common/viewModelEventsCollector';

export class ViewModelEventDispatcher extends Disposable {

	private readonly _onEvent = this._register(new Emitter<OutgoingViewModelEvent>());
	public readonly onEvent = this._onEvent.event;

	private readonly _eventHandlers: ViewEventHandler[];
	private _viewEventQueue: ViewEvent[] | null;
	private _isConsumingViewEventQueue: boolean;
	private _collector: ViewModelEventsCollector | null;
	private _collectorCnt: number;
	private _outgoingEvents: OutgoingViewModelEvent[];

	constructor() {
		super();
		this._eventHandlers = [];
		this._viewEventQueue = null;
		this._isConsumingViewEventQueue = false;
		this._collector = null;
		this._collectorCnt = 0;
		this._outgoingEvents = [];
	}

	public emitOutgoingEvent(e: OutgoingViewModelEvent): void {
		//console.log('[ViewModelEventDispatcher] emitOutgoingEvent', e);
		this._addOutgoingEvent(e);
		this._emitOutgoingEvents();
	}

	private _addOutgoingEvent(e: OutgoingViewModelEvent): void {
		for (let i = 0, len = this._outgoingEvents.length; i < len; i++) {
			const mergeResult = (this._outgoingEvents[i].kind === e.kind ? this._outgoingEvents[i].attemptToMerge(e) : null);
			if (mergeResult) {
				this._outgoingEvents[i] = mergeResult;
				return;
			}
		}
		// not merged
		this._outgoingEvents.push(e);
	}

	private _emitOutgoingEvents(): void {
		while (this._outgoingEvents.length > 0) {
			if (this._collector || this._isConsumingViewEventQueue) {
				// right now collecting or emitting view events, so let's postpone emitting
				return;
			}
			const event = this._outgoingEvents.shift()!;
			if (event.isNoOp()) {
				continue;
			}
			this._onEvent.fire(event);
		}
	}

	public addViewEventHandler(eventHandler: ViewEventHandler): void {
		for (let i = 0, len = this._eventHandlers.length; i < len; i++) {
			if (this._eventHandlers[i] === eventHandler) {
				console.warn('Detected duplicate listener in ViewEventDispatcher', eventHandler);
			}
		}
		this._eventHandlers.push(eventHandler);
	}

	public removeViewEventHandler(eventHandler: ViewEventHandler): void {
		for (let i = 0; i < this._eventHandlers.length; i++) {
			if (this._eventHandlers[i] === eventHandler) {
				this._eventHandlers.splice(i, 1);
				break;
			}
		}
	}

	public beginEmitViewEvents(): ViewModelEventsCollector {
		this._collectorCnt++;
		if (this._collectorCnt === 1) {
			this._collector = new ViewModelEventsCollector();
		}
		return this._collector!;
	}

	public endEmitViewEvents(): void {
		this._collectorCnt--;
		if (this._collectorCnt === 0) {
			const outgoingEvents = this._collector!.outgoingEvents;
			const viewEvents = this._collector!.viewEvents;
			this._collector = null;

			for (const outgoingEvent of outgoingEvents) {
				this._addOutgoingEvent(outgoingEvent);
			}

			if (viewEvents.length > 0) {
				this._emitMany(viewEvents);
			}
		}
		this._emitOutgoingEvents();
	}

	public emitSingleViewEvent(event: ViewEvent): void {
		try {
			const eventsCollector = this.beginEmitViewEvents();
			eventsCollector.emitViewEvent(event);
		} finally {
			this.endEmitViewEvents();
		}
	}

	private _emitMany(events: ViewEvent[]): void {
		if (this._viewEventQueue) {
			this._viewEventQueue = this._viewEventQueue.concat(events);
		} else {
			this._viewEventQueue = events;
		}

		if (!this._isConsumingViewEventQueue) {
			this._consumeViewEventQueue();
		}
	}

	private _consumeViewEventQueue(): void {
		try {
			this._isConsumingViewEventQueue = true;
			this._doConsumeQueue();
		} finally {
			this._isConsumingViewEventQueue = false;
		}
	}

	private _doConsumeQueue(): void {
		while (this._viewEventQueue) {
			// Empty event queue, as events might come in while sending these off
			const events = this._viewEventQueue;
			this._viewEventQueue = null;

			// Use a clone of the event handlers list, as they might remove themselves
			const eventHandlers = this._eventHandlers.slice(0);
			for (const eventHandler of eventHandlers) {
				eventHandler.handleEvents(events);
			}
		}
	}
}


