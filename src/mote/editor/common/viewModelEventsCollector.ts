import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { TextSelection } from 'mote/editor/common/core/selectionUtils';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { ViewEvent } from 'mote/editor/common/viewEvents';

//#region Events

export type OutgoingViewModelEvent = (
	FocusChangedEvent
	| ScrollChangedEvent
	| CursorStateChangedEvent
	| SelectionChangedEvent
);

export const enum OutgoingViewModelEventKind {
	FocusChanged,
	ScrollChanged,
	CursorStateChanged,
	SelectionChanged,

}

export class FocusChangedEvent {

	public readonly kind = OutgoingViewModelEventKind.FocusChanged;

	readonly oldHasFocus: boolean;
	readonly hasFocus: boolean;

	constructor(oldHasFocus: boolean, hasFocus: boolean) {
		this.oldHasFocus = oldHasFocus;
		this.hasFocus = hasFocus;
	}

	public isNoOp(): boolean {
		return (this.oldHasFocus === this.hasFocus);
	}

	public attemptToMerge(other: OutgoingViewModelEvent): OutgoingViewModelEvent | null {
		if (other.kind !== this.kind) {
			return null;
		}
		return new FocusChangedEvent(this.oldHasFocus, other.hasFocus);
	}
}

export class ScrollChangedEvent {

	public readonly kind = OutgoingViewModelEventKind.ScrollChanged;

	private readonly _oldScrollWidth: number;
	private readonly _oldScrollLeft: number;
	private readonly _oldScrollHeight: number;
	private readonly _oldScrollTop: number;

	public readonly scrollWidth: number;
	public readonly scrollLeft: number;
	public readonly scrollHeight: number;
	public readonly scrollTop: number;

	public readonly scrollWidthChanged: boolean;
	public readonly scrollLeftChanged: boolean;
	public readonly scrollHeightChanged: boolean;
	public readonly scrollTopChanged: boolean;

	constructor(
		oldScrollWidth: number, oldScrollLeft: number, oldScrollHeight: number, oldScrollTop: number,
		scrollWidth: number, scrollLeft: number, scrollHeight: number, scrollTop: number,
	) {
		this._oldScrollWidth = oldScrollWidth;
		this._oldScrollLeft = oldScrollLeft;
		this._oldScrollHeight = oldScrollHeight;
		this._oldScrollTop = oldScrollTop;

		this.scrollWidth = scrollWidth;
		this.scrollLeft = scrollLeft;
		this.scrollHeight = scrollHeight;
		this.scrollTop = scrollTop;

		this.scrollWidthChanged = (this._oldScrollWidth !== this.scrollWidth);
		this.scrollLeftChanged = (this._oldScrollLeft !== this.scrollLeft);
		this.scrollHeightChanged = (this._oldScrollHeight !== this.scrollHeight);
		this.scrollTopChanged = (this._oldScrollTop !== this.scrollTop);
	}

	public isNoOp(): boolean {
		return (!this.scrollWidthChanged && !this.scrollLeftChanged && !this.scrollHeightChanged && !this.scrollTopChanged);
	}

	public attemptToMerge(other: OutgoingViewModelEvent): OutgoingViewModelEvent | null {
		if (other.kind !== this.kind) {
			return null;
		}
		return new ScrollChangedEvent(
			this._oldScrollWidth, this._oldScrollLeft, this._oldScrollHeight, this._oldScrollTop,
			other.scrollWidth, other.scrollLeft, other.scrollHeight, other.scrollTop
		);
	}
}

export class SelectionChangedEvent {
	public readonly kind = OutgoingViewModelEventKind.SelectionChanged;

	constructor(
		public readonly selection: TextSelection
	) {

	}

	public isNoOp(): boolean {
		return false;
	}

	public attemptToMerge(other: OutgoingViewModelEvent): OutgoingViewModelEvent | null {
		if (other.kind !== this.kind) {
			return null;
		}
		return other;
	}
}

export class CursorStateChangedEvent {

	public readonly kind = OutgoingViewModelEventKind.CursorStateChanged;

	public readonly oldSelections: EditorSelection[] | null;
	public readonly selections: EditorSelection[];
	public readonly oldModelVersionId: number;
	public readonly modelVersionId: number;
	public readonly source: string;
	public readonly reason: CursorChangeReason;
	public readonly reachedMaxCursorCount: boolean;

	constructor(oldSelections: EditorSelection[] | null, selections: EditorSelection[], oldModelVersionId: number, modelVersionId: number, source: string, reason: CursorChangeReason, reachedMaxCursorCount: boolean) {
		this.oldSelections = oldSelections;
		this.selections = selections;
		this.oldModelVersionId = oldModelVersionId;
		this.modelVersionId = modelVersionId;
		this.source = source;
		this.reason = reason;
		this.reachedMaxCursorCount = reachedMaxCursorCount;
	}

	private static _selectionsAreEqual(a: EditorSelection[] | null, b: EditorSelection[] | null): boolean {
		if (!a && !b) {
			return true;
		}
		if (!a || !b) {
			return false;
		}
		const aLen = a.length;
		const bLen = b.length;
		if (aLen !== bLen) {
			return false;
		}
		for (let i = 0; i < aLen; i++) {
			if (!a[i].equalsSelection(b[i])) {
				return false;
			}
		}
		return true;
	}

	public isNoOp(): boolean {
		return (
			CursorStateChangedEvent._selectionsAreEqual(this.oldSelections, this.selections)
			&& this.oldModelVersionId === this.modelVersionId
		);
	}

	public attemptToMerge(other: OutgoingViewModelEvent): OutgoingViewModelEvent | null {
		if (other.kind !== this.kind) {
			return null;
		}
		return new CursorStateChangedEvent(
			this.oldSelections, other.selections, this.oldModelVersionId, other.modelVersionId, other.source, other.reason, this.reachedMaxCursorCount || other.reachedMaxCursorCount
		);
	}
}

//#endregion

export class ViewModelEventsCollector {

	public readonly viewEvents: ViewEvent[];
	public readonly outgoingEvents: OutgoingViewModelEvent[];

	constructor() {
		this.viewEvents = [];
		this.outgoingEvents = [];
	}

	public emitViewEvent(event: ViewEvent) {
		this.viewEvents.push(event);
	}

	public emitOutgoingEvent(e: OutgoingViewModelEvent): void {
		this.outgoingEvents.push(e);
	}
}


