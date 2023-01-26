import { combinedDisposable, Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { EditorRange, IRange } from 'mote/editor/common/core/editorRange';
import { IPosition, Position } from 'mote/editor/common/core/position';
import { ITextModel } from 'mote/editor/common/model';
import * as model from 'mote/editor/common/model';
import * as segmentUtils from 'mote/editor/common/segmentUtils';
import { EditStack } from 'mote/editor/common/model/editStack';
import { TokenizationTextModelPart } from 'mote/editor/common/model/tokenizationTextModelPart';
import { collectValueFromSegment, ISegment } from 'mote/editor/common/segmentUtils';
import { ITokenizationTextModelPart } from 'mote/editor/common/tokenizationTextModelPart';
import BlockStore from 'mote/platform/store/common/blockStore';
import RecordStore from 'mote/platform/store/common/recordStore';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { UndoRedoGroup } from 'mote/platform/undoRedo/common/undoRedo';
import { IModelContentChangedEvent, InternalModelContentChangeEvent, ModelInjectedTextChangedEvent } from 'mote/editor/common/textModelEvents';
import { Emitter, Event } from 'mote/base/common/event';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { keepLineTypes, textBasedTypes } from 'mote/editor/common/blockTypes';
import { Transaction } from 'mote/editor/common/core/transaction';
import { BlockTypes } from 'mote/platform/store/common/record';
import { textChange } from 'mote/editor/common/core/textChange';
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from 'mote/editor/common/diffMatchPatch';

interface IReverseSingleEditOperation extends model.IValidEditOperation {
	sortIndex: number;
}

export interface IValidatedEditOperation {
	sortIndex: number;
	identifier: model.ISingleEditOperationIdentifier | null;
	range: EditorRange;
	rangeOffset: number;
	rangeLength: number;
	text: string;
	eolCount: number;
	firstLineLength: number;
	lastLineLength: number;
	forceMoveMarkers: boolean;
	isAutoWhitespaceEdit: boolean;
}

export class TextModel extends Disposable implements ITextModel {

	/**
	 * Assumes `operations` are validated and sorted ascending
	 */
	public static getInverseEditRanges(operations: IValidatedEditOperation[]): EditorRange[] {
		const result: EditorRange[] = [];

		let prevOpEndLineNumber: number = 0;
		let prevOpEndColumn: number = 0;
		let prevOp: IValidatedEditOperation | null = null;
		for (let i = 0, len = operations.length; i < len; i++) {
			const op = operations[i];

			let startLineNumber: number;
			let startColumn: number;

			if (prevOp) {
				if (prevOp.range.endLineNumber === op.range.startLineNumber) {
					startLineNumber = prevOpEndLineNumber;
					startColumn = prevOpEndColumn + (op.range.startColumn - prevOp.range.endColumn);
				} else {
					startLineNumber = prevOpEndLineNumber + (op.range.startLineNumber - prevOp.range.endLineNumber);
					startColumn = op.range.startColumn;
				}
			} else {
				startLineNumber = op.range.startLineNumber;
				startColumn = op.range.startColumn;
			}

			let resultRange: EditorRange;

			if (op.text!.length > 0) {
				// the operation inserts something
				const lineCount = op.eolCount + 1;

				if (lineCount === 1) {
					// single line insert
					resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber, startColumn + op.text.length);
				} else {
					// multi line insert
					resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber + lineCount - 1, op.lastLineLength + 1);
				}
			} else {
				// There is nothing to insert
				resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber, startColumn);
			}

			prevOpEndLineNumber = resultRange.endLineNumber;
			prevOpEndColumn = resultRange.endColumn;

			result.push(resultRange);
			prevOp = op;
		}

		return result;
	}

	private readonly _onDidChangeDecorations: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidChangeDecorations: Event<void> = this._onDidChangeDecorations.event;

	private readonly eventEmitter: DidChangeContentEmitter = this._register(new DidChangeContentEmitter());
	public onDidChangeContent(listener: (e: IModelContentChangedEvent) => void): IDisposable {
		return this.eventEmitter.slowEvent((e: InternalModelContentChangeEvent) => listener(e.contentChangedEvent));
	}

	public onDidChangeContentOrInjectedText(listener: (e: InternalModelContentChangeEvent | ModelInjectedTextChangedEvent) => void): IDisposable {
		return combinedDisposable(
			this.eventEmitter.fastEvent(e => listener(e)),
			//this._onDidChangeInjectedText.event(e => listener(e))
		);
	}

	private _isDisposed: boolean;
	private __isDisposing: boolean;
	public _isDisposing(): boolean { return this.__isDisposing; }

	private readonly contentStore: RecordStore;

	private readonly commandManager: EditStack;

	private readonly _tokenizationTextModelPart: TokenizationTextModelPart;
	public get tokenization(): ITokenizationTextModelPart { return this._tokenizationTextModelPart; }


	constructor(
		private readonly pageStore: BlockStore
	) {
		super();

		this._isDisposed = false;
		this.__isDisposing = false;

		this.contentStore = this.pageStore.getContentStore();

		this.commandManager = new EditStack(this);
		this._tokenizationTextModelPart = new TokenizationTextModelPart(this);
	}

	getVersionId(): number {
		return this.pageStore.getValue().version;
	}

	validateRange(range: IRange): EditorRange {
		return range as EditorRange;
	}

	validatePosition(position: IPosition): Position {
		return position as Position;
	}

	normalizePosition(position: Position, affinity: model.PositionAffinity): Position {
		return position;
	}

	//#region line

	public getLineMinColumn(lineNumber: number): number {
		this.assertNotDisposed();
		return 1;
	}

	public getLineMaxColumn(lineNumber: number): number {
		return this.getLineLength(lineNumber) + 1;
	}

	public getLineLength(lineNumber: number): number {
		this.assertNotDisposed();
		const lineStore = this.getLineStore(lineNumber);
		const content = collectValueFromSegment(lineStore.getTitleStore().getValue());
		return content.length;
	}

	public getLineStore(lineNumber: number): BlockStore {
		if (lineNumber < 0 || lineNumber > this.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}
		if (lineNumber === 0) {
			// lineNumber == 0 means it's the header
			return this.pageStore;
		}
		return StoreUtils.createStoreForLineNumber(lineNumber, this.contentStore);
	}

	public getLineCount(): number {
		const blockIds: string[] = this.contentStore.getValue() || [];
		return blockIds.length;
	}

	public getLineContent(lineNumber: number): string {
		const lineStore = this.getLineStore(lineNumber);
		return collectValueFromSegment(lineStore.getTitleStore().getValue());
	}

	public getValueInRange(rawRange: IRange, eol: model.EndOfLinePreference = model.EndOfLinePreference.TextDefined): string {
		const range = this.validateRange(rawRange);
		if (range.startLineNumber === range.endLineNumber) {
			return this.getLineContent(range.startLineNumber).substring(range.startColumn - 1, range.endColumn);
		}
		let result = '';
		for (let lineNumber = range.startLineNumber; lineNumber < range.endLineNumber; lineNumber++) {
			const content = this.getLineContent(lineNumber);
			if (lineNumber === range.startLineNumber) {
				result += content.substring(range.startColumn - 1);
				continue;
			}
			if (lineNumber === range.endLineNumber) {
				result += content.substring(0, range.endColumn);
				continue;
			}
			result += content;
		}
		return result;
	}

	//#endregion

	_getTrackedRange(id: string): EditorRange | null {
		return null;
	}

	_setTrackedRange(id: string | null, newRange: null, newStickiness: model.TrackedRangeStickiness): null;
	_setTrackedRange(id: string | null, newRange: EditorRange, newStickiness: model.TrackedRangeStickiness): string;
	_setTrackedRange(id: string | null, newRange: EditorRange | null, newStickiness: model.TrackedRangeStickiness): string | null {

		//console.log(newRange);
		this._onDidChangeDecorations.fire();
		return null;
	}

	//#region edit

	private validateEditOperation(rawOperation: model.IIdentifiedSingleEditOperation): model.ValidAnnotatedEditOperation {
		if (rawOperation instanceof model.ValidAnnotatedEditOperation) {
			return rawOperation;
		}
		return new model.ValidAnnotatedEditOperation(
			rawOperation.identifier || null,
			this.validateRange(rawOperation.range),
			rawOperation.text,
			rawOperation.forceMoveMarkers || false,
			rawOperation.isAutoWhitespaceEdit || false,
			rawOperation._isTracked || false
		);
	}

	private validateEditOperations(rawOperations: model.IIdentifiedSingleEditOperation[]): model.ValidAnnotatedEditOperation[] {
		const result: model.ValidAnnotatedEditOperation[] = [];
		for (let i = 0, len = rawOperations.length; i < len; i++) {
			result[i] = this.validateEditOperation(rawOperations[i]);
		}
		return result;
	}

	pushStackElement(): void {

	}
	popStackElement(): void {

	}

	public pushEditOperations(
		beforeCursorState: EditorSelection[] | null,
		editOperations: model.IIdentifiedSingleEditOperation[],
		cursorStateComputer: model.ICursorStateComputer | null,
		group?: UndoRedoGroup
	): EditorSelection[] | null {
		try {
			this.eventEmitter.beginDeferredEmit();
			return this.commandManager.pushEditOperation(beforeCursorState, editOperations, cursorStateComputer, group);
		} finally {
			this.eventEmitter.endDeferredEmit();
		}
	}

	public applyEdits(operations: model.IIdentifiedSingleEditOperation[]): void;
	public applyEdits(operations: model.IIdentifiedSingleEditOperation[], computeUndoEdits: false): void;
	public applyEdits(operations: model.IIdentifiedSingleEditOperation[], computeUndoEdits: true): model.IValidEditOperation[];
	public applyEdits(rawOperations: model.IIdentifiedSingleEditOperation[], computeUndoEdits: boolean = false): void | model.IValidEditOperation[] {
		try {
			this.eventEmitter.beginDeferredEmit();
			const operations = this.validateEditOperations(rawOperations);
			return this.doApplyEdits(operations, computeUndoEdits);
		} finally {
			this.eventEmitter.endDeferredEmit();
		}
	}

	private doApplyEdits(rawOperations: model.ValidAnnotatedEditOperation[], computeUndoEdits: boolean): void | model.IValidEditOperation[] {
		const operations: IValidatedEditOperation[] = [];
		for (let i = 0; i < rawOperations.length; i++) {
			const op = rawOperations[i];

			let validText = '';
			let eolCount = 0;
			let firstLineLength = 0;
			let lastLineLength = 0;
			if (op.text) {
				validText = op.text;
				[eolCount, firstLineLength, lastLineLength] = this.countEOL(op);
			}

			operations[i] = {
				sortIndex: i,
				identifier: op.identifier || null,
				range: op.range,
				rangeOffset: 0,
				rangeLength: 0,
				text: validText,
				eolCount: eolCount,
				firstLineLength: firstLineLength,
				lastLineLength: lastLineLength,
				forceMoveMarkers: false,
				isAutoWhitespaceEdit: false,
			};
		}
		// reverse
		const reverseRanges = computeUndoEdits ? TextModel.getInverseEditRanges(operations) : [];
		let reverseOperations: IReverseSingleEditOperation[] | null = null;
		if (computeUndoEdits) {

			//let reverseRangeDeltaOffset = 0;
			reverseOperations = [];
			for (let i = 0; i < operations.length; i++) {
				const op = operations[i];
				const reverseRange = reverseRanges[i];
				const bufferText = this.getValueInRange(op.range);
				//const reverseRangeOffset = op.rangeOffset + reverseRangeDeltaOffset;
				//reverseRangeDeltaOffset += (op.text.length - bufferText.length);

				reverseOperations[i] = {
					sortIndex: i,
					identifier: op.identifier,
					range: reverseRange,
					text: bufferText,
					textChange: null as any//new TextChange(op.rangeOffset, bufferText, reverseRangeOffset, op.text)
				};
			}
		}

		const transaction = Transaction.create(this.contentStore.userId);
		const contentChanges: model.IInternalModelContentChange[] = [];
		// operations are from bottom to top
		for (let i = 0; i < rawOperations.length; i++) {
			const op = rawOperations[i];

			const startLineNumber = op.range.startLineNumber;
			const startColumn = op.range.startColumn;
			const endLineNumber = op.range.endLineNumber;
			const endColumn = op.range.endColumn;

			if (startLineNumber === endLineNumber && startColumn === endColumn && op.text!.length === 0) {
				// no-op
				continue;
			}

			//this.applyEditForEditableInput(op, transaction);
			this.applyEditForTextAreaInput(op, transaction);

			const contentChangeRange = new EditorRange(startLineNumber, startColumn, endLineNumber, endColumn);
			contentChanges.push({
				range: contentChangeRange,
				//rangeLength: op.rangeLength,
				text: op.text!,
				//rangeOffset: op.rangeOffset,
				forceMoveMarkers: op.forceMoveMarkers
			});
		}

		transaction.commit();

		return reverseOperations === null ? undefined : reverseOperations;
	}

	private applyEditForTextAreaInput(op: model.ValidAnnotatedEditOperation, transaction: Transaction) {
		if (op.text) {
			if (op.text === '\n') {
				// insert new line
				this.enter(op.range, transaction);
			} else {
				// replacement
				this.delete(op.range, transaction);
				this.insert(op.range, op.text, transaction);
			}
		} else {
			// deletion
			this.delete(op.range, transaction);
		}
	}

	private applyEditForEditableInput(rawOperation: model.ValidAnnotatedEditOperation, transaction: Transaction) {
		const startLineNumber = rawOperation.range.startLineNumber;
		const startColumn = rawOperation.range.startColumn;
		const endLineNumber = rawOperation.range.endLineNumber;
		const endColumn = rawOperation.range.endColumn;

		const store = this.getLineStore(startLineNumber);
		const prevRecord = store.getTitleStore().getValue();
		const prevValue = segmentUtils.collectValueFromSegment(prevRecord);
		const diffResult = textChange({ startIndex: startColumn - 1, endIndex: endColumn - 1, lineNumber: endLineNumber }, prevValue, rawOperation.text!);

		let startIndex = 0;
		for (const [op, txt] of diffResult) {
			switch (op) {
				case DIFF_INSERT:
					this.insert(new EditorRange(startLineNumber, startIndex + 1, endLineNumber, startIndex + 1), txt, transaction);
					startIndex += txt.length;
					break;
				case DIFF_DELETE:
					this.delete(new EditorRange(startLineNumber, startIndex + 1, endLineNumber, startIndex + txt.length + 1), transaction);
					break;
				default:
					if (DIFF_EQUAL === op) {
						startIndex += txt.length;
					}
			}
		}
	}

	private enter(range: EditorRange, transaction: Transaction) {
		if (range.startLineNumber === 0) {
			// special case for header

		} else {
			let type = 'text';
			const lineStore = this.getLineStore(range.startLineNumber);
			if (keepLineTypes.has(lineStore.getType() || '')) {
				// Some blocks required keep same styles in next line
				// Just like todo, list
				type = lineStore.getType()!;
			}
			const child: BlockStore = EditOperation.createBlockStore(type, transaction, this.contentStore);
			EditOperation.insertChildAfterTarget(
				this.contentStore, child, lineStore, transaction);
		}
	}

	private delete(range: EditorRange, transaction: Transaction) {
		if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
			// it means insert a new text
			return;
		}
		const store = this.getLineStore(range.endLineNumber);
		const record = store.getValue();
		if (range.startLineNumber !== range.endLineNumber) {
			// delete block
			if (textBasedTypes.has(record.type)) {
				// turnInto text for rich type
				EditOperation.turnInto(store, BlockTypes.text as any, transaction);
			} else {
				EditOperation.removeChild(this.contentStore, store, transaction);
			}
		} else {
			// delete current block content
			const titleStore = store.getTitleStore();
			const storeValue = titleStore.getValue();
			const newRecord = segmentUtils.remove(storeValue, range.startColumn - 1, range.endColumn - 1);
			EditOperation.addSetOperationForStore(titleStore, newRecord, transaction);
		}
	}

	private insert(range: EditorRange, text: string, transaction: Transaction) {
		const store = this.getLineStore(range.startLineNumber).getTitleStore();
		const segment = segmentUtils.combineArray(text, []) as ISegment;

		const storeValue = store.getValue();

		EditOperation.addSetOperationForStore(
			store,
			segmentUtils.merge(storeValue, [segment], range.startColumn - 1),
			transaction
		);

	}

	countEOL(operation: model.ValidAnnotatedEditOperation) {
		let eolCount = 0;
		const startColumn = operation.range.startColumn;

		const firstLineLength = startColumn + operation.text!.length;
		const lastLineLength = 0;
		if ('\n' === operation.text![operation.text!.length - 1]) {
			eolCount += 1;
		}
		return [eolCount, firstLineLength, lastLineLength];
	}

	//#endregion

	private assertNotDisposed(): void {
		if (this._isDisposed) {
			throw new Error('Model is disposed!');
		}
	}
}

class DidChangeContentEmitter extends Disposable {

	/**
	 * Both `fastEvent` and `slowEvent` work the same way and contain the same events, but first we invoke `fastEvent` and then `slowEvent`.
	 */
	private readonly _fastEmitter: Emitter<InternalModelContentChangeEvent> = this._register(new Emitter<InternalModelContentChangeEvent>());
	public readonly fastEvent: Event<InternalModelContentChangeEvent> = this._fastEmitter.event;
	private readonly _slowEmitter: Emitter<InternalModelContentChangeEvent> = this._register(new Emitter<InternalModelContentChangeEvent>());
	public readonly slowEvent: Event<InternalModelContentChangeEvent> = this._slowEmitter.event;

	private _deferredCnt: number;
	private _deferredEvent: InternalModelContentChangeEvent | null;

	constructor() {
		super();
		this._deferredCnt = 0;
		this._deferredEvent = null;
	}

	public hasListeners(): boolean {
		return (
			this._fastEmitter.hasListeners()
			|| this._slowEmitter.hasListeners()
		);
	}

	public beginDeferredEmit(): void {
		this._deferredCnt++;
	}

	public endDeferredEmit(resultingSelection: EditorSelection[] | null = null): void {
		this._deferredCnt--;
		if (this._deferredCnt === 0) {
			if (this._deferredEvent !== null) {
				this._deferredEvent.rawContentChangedEvent.resultingSelection = resultingSelection;
				const e = this._deferredEvent;
				this._deferredEvent = null;
				this._fastEmitter.fire(e);
				this._slowEmitter.fire(e);
			}
		}
	}

	public fire(e: InternalModelContentChangeEvent): void {
		if (this._deferredCnt > 0) {
			if (this._deferredEvent) {
				this._deferredEvent = this._deferredEvent.merge(e);
			} else {
				this._deferredEvent = e;
			}
			return;
		}
		this._fastEmitter.fire(e);
		this._slowEmitter.fire(e);
	}
}
