import { TextSelection } from 'mote/editor/common/core/selectionUtils';

export const enum OutgoingViewEventKind {
	CursorStateChanged,
	SelectionChanged,
}

export class SelectionChangedEvent {
	public readonly kind = OutgoingViewEventKind.SelectionChanged;

	constructor(
		public readonly selection: TextSelection
	) {

	}

	public isNoOp(): boolean {
		return false;
	}

	public attemptToMerge(other: OutgoingViewEvent): OutgoingViewEvent | null {
		if (other.kind !== this.kind) {
			return null;
		}
		return other;
	}
}

export type OutgoingViewEvent = (

	SelectionChangedEvent
);

