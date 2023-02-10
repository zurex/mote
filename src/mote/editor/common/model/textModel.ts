import { combinedDisposable, Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { EditorRange, IRange } from 'mote/editor/common/core/editorRange';
import { IPosition, Position } from 'mote/editor/common/core/position';
import { ITextModel } from 'mote/editor/common/model';
import * as model from 'mote/editor/common/model';
import { EditStack } from 'mote/editor/common/model/editStack';
import { TokenizationTextModelPart } from 'mote/editor/common/model/tokenizationTextModelPart';
import { ITokenizationTextModelPart } from 'mote/editor/common/tokenizationTextModelPart';
import BlockStore from 'mote/platform/store/common/blockStore';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { UndoRedoGroup } from 'mote/platform/undoRedo/common/undoRedo';
import { IModelContentChangedEvent, InternalModelContentChangeEvent, ModelInjectedTextChangedEvent, ModelRawChange, ModelRawContentChangedEvent, ModelRawLineChanged, ModelRawLinesDeleted, ModelRawLinesInserted } from 'mote/editor/common/textModelEvents';
import { Emitter, Event } from 'mote/base/common/event';
import { TextBuffer } from 'mote/editor/common/model/textBuffer';
import { URI } from 'mote/base/common/uri';
import { VSBuffer, VSBufferReadableStream } from 'mote/base/common/buffer';
import { listenStream } from 'mote/base/common/stream';
import { PieceTreeTextBufferBuilder } from 'mote/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder';

export function createTextBufferFactory(text: string): model.ITextBufferFactory {
	const builder = new PieceTreeTextBufferBuilder();
	builder.acceptChunk(text);
	return builder.finish();
}

interface ITextStream {
	on(event: 'data', callback: (data: string) => void): void;
	on(event: 'error', callback: (err: Error) => void): void;
	on(event: 'end', callback: () => void): void;
	on(event: string, callback: any): void;
}

export function createTextBufferFactoryFromStream(stream: ITextStream): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: VSBufferReadableStream): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: ITextStream | VSBufferReadableStream): Promise<model.ITextBufferFactory> {
	return new Promise<model.ITextBufferFactory>((resolve, reject) => {
		const builder = new PieceTreeTextBufferBuilder();

		let done = false;

		listenStream<string | VSBuffer>(stream, {
			onData: chunk => {
				builder.acceptChunk((typeof chunk === 'string') ? chunk : chunk.toString());
			},
			onError: error => {
				if (!done) {
					done = true;
					reject(error);
				}
			},
			onEnd: () => {
				if (!done) {
					done = true;
					resolve(builder.finish());
				}
			}
		});
	});
}

export class TextModel extends Disposable implements ITextModel {


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

	private attachedEditorCount: number;
	private buffer: model.ITextBuffer;

	private _isDisposed: boolean;
	private __isDisposing: boolean;
	public _isDisposing(): boolean { return this.__isDisposing; }
	private _versionId: number = 1;
	/**
	 * Unlike, versionId, this can go down (via undo) or go to previous values (via redo)
	 */
	private _alternativeVersionId: number = 1;

	//#region Editing
	private readonly commandManager: EditStack;
	private _isUndoing: boolean;
	private _isRedoing: boolean;
	//#endregion

	private readonly _tokenizationTextModelPart: TokenizationTextModelPart;
	public get tokenization(): ITokenizationTextModelPart { return this._tokenizationTextModelPart; }


	constructor(
		pageStore: BlockStore
	) {
		super();

		this.attachedEditorCount = 0;

		this._isDisposed = false;
		this.__isDisposing = false;

		this.buffer = new TextBuffer(pageStore);

		this.commandManager = new EditStack(this);
		this._isUndoing = false;
		this._isRedoing = false;
		this._tokenizationTextModelPart = new TokenizationTextModelPart(this.buffer);
	}

	get uri(): URI {
		return null as any;
	}

	getDecorationRange(id: string): EditorRange | null {
		throw new Error('Method not implemented.');
	}

	deltaDecorations(oldDecorations: string[], newDecorations: model.IModelDeltaDecoration[]): string[] {
		throw new Error('Method not implemented.');
	}

	getVersionId(): number {
		this.assertNotDisposed();
		return this._versionId;
	}

	private increaseVersionId(): void {
		this._versionId = this._versionId + 1;
		this._alternativeVersionId = this._versionId;
	}

	public _overwriteVersionId(versionId: number): void {
		this._versionId = versionId;
	}

	public validateRange(range: IRange): EditorRange {
		return range as EditorRange;
	}

	public validatePosition(position: IPosition): Position {
		return position as Position;
	}

	public onBeforeAttached(): void {
		this.attachedEditorCount++;
		if (this.attachedEditorCount === 1) {
			//this._tokenizationTextModelPart.handleDidChangeAttached();
			//this._onDidChangeAttached.fire(undefined);
		}
	}

	public onBeforeDetached(): void {
		this.attachedEditorCount--;
		if (this.attachedEditorCount === 0) {
			//this._tokenizationTextModelPart.handleDidChangeAttached();
			//this._onDidChangeAttached.fire(undefined);
		}
	}

	public isAttachedToEditor(): boolean {
		return this.attachedEditorCount > 0;
	}

	public getAttachedEditorCount(): number {
		return this.attachedEditorCount;
	}

	normalizePosition(position: Position, affinity: model.PositionAffinity): Position {
		return position;
	}

	//#region line

	public isEmpty(): boolean {
		return this.getLineCount() === 0;
	}

	public getLineMinColumn(lineNumber: number): number {
		this.assertNotDisposed();
		return 1;
	}

	public getLineMaxColumn(lineNumber: number): number {
		return this.getLineLength(lineNumber) + 1;
	}

	public getLineLength(lineNumber: number): number {
		this.assertNotDisposed();
		return this.buffer.getLineLength(lineNumber);
	}

	public getLineStore(lineNumber: number): BlockStore {
		this.assertNotDisposed();
		return this.buffer.getLineStore(lineNumber);
	}

	public getLineCount(): number {
		this.assertNotDisposed();
		return this.buffer.getLineCount();
	}

	public getLineContent(lineNumber: number): string {
		this.assertNotDisposed();
		if (this.isEmpty()) {
			return '';
		}
		return this.buffer.getLineContent(lineNumber);
	}

	public getValueInRange(rawRange: IRange, eol: model.EndOfLinePreference = model.EndOfLinePreference.TextDefined): string {
		this.assertNotDisposed();
		return this.buffer.getValueInRange(this.validateRange(rawRange), eol);
	}

	public getCharacterCountInRange(rawRange: IRange, eol: model.EndOfLinePreference = model.EndOfLinePreference.TextDefined): number {
		this.assertNotDisposed();
		return this.buffer.getCharacterCountInRange(this.validateRange(rawRange), eol);
	}

	//#endregion

	_getTrackedRange(id: string): EditorRange | null {
		return null;
	}

	_setTrackedRange(id: string | null, newRange: null, newStickiness: model.TrackedRangeStickiness): null;
	_setTrackedRange(id: string | null, newRange: EditorRange, newStickiness: model.TrackedRangeStickiness): string;
	_setTrackedRange(id: string | null, newRange: EditorRange | null, newStickiness: model.TrackedRangeStickiness): string | null {

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
			rawOperation._isTracked || false,
			rawOperation.annotation,
			rawOperation.blockType,
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

		const oldLineCount = this.buffer.getLineCount();
		const result = this.buffer.applyEdits(rawOperations, false, computeUndoEdits);
		const newLineCount = this.buffer.getLineCount();

		const contentChanges = result.changes;

		if (contentChanges.length !== 0) {

			const rawContentChanges: ModelRawChange[] = [];

			this.increaseVersionId();

			let lineCount = oldLineCount;
			for (let i = 0, len = contentChanges.length; i < len; i++) {
				const change = contentChanges[i];
				const eolCount = change.text === '\n' ? 1 : 0;

				const startLineNumber = change.range.startLineNumber;
				const endLineNumber = change.range.endLineNumber;

				const deletingLinesCnt = endLineNumber - startLineNumber;
				const insertingLinesCnt = eolCount;
				const editingLinesCnt = Math.min(deletingLinesCnt, insertingLinesCnt);

				const changeLineCountDelta = (insertingLinesCnt - deletingLinesCnt);

				const currentEditStartLineNumber = newLineCount - lineCount - changeLineCountDelta + startLineNumber;


				for (let j = editingLinesCnt; j >= 0; j--) {
					const editLineNumber = startLineNumber + j;
					const currentEditLineNumber = currentEditStartLineNumber + j;

					//injectedTextInEditedRangeQueue.takeFromEndWhile(r => r.lineNumber > currentEditLineNumber);
					//const decorationsInCurrentLine = injectedTextInEditedRangeQueue.takeFromEndWhile(r => r.lineNumber === currentEditLineNumber);

					rawContentChanges.push(
						new ModelRawLineChanged(
							editLineNumber,
							this.getLineContent(currentEditLineNumber),
							[]
						));
				}

				if (editingLinesCnt < deletingLinesCnt) {
					// Must delete some lines
					const spliceStartLineNumber = startLineNumber + editingLinesCnt;
					rawContentChanges.push(new ModelRawLinesDeleted(spliceStartLineNumber + 1, endLineNumber));
				}

				if (editingLinesCnt < insertingLinesCnt) {
					// Must insert some lines
					const spliceLineNumber = startLineNumber + editingLinesCnt;
					const cnt = insertingLinesCnt - editingLinesCnt;
					const fromLineNumber = newLineCount - lineCount - cnt + spliceLineNumber + 1;
					const newLines: string[] = [];
					for (let i = 0; i < cnt; i++) {
						const lineNumber = fromLineNumber + i;
						newLines[i] = this.getLineContent(lineNumber);
					}

					rawContentChanges.push(
						new ModelRawLinesInserted(
							spliceLineNumber + 1,
							startLineNumber + insertingLinesCnt,
							newLines,
							[]
						)
					);
				}

				lineCount += changeLineCountDelta;
			}

			this.emitContentChangedEvent(
				new ModelRawContentChangedEvent(
					rawContentChanges,
					this.getVersionId(),
					this._isUndoing,
					this._isRedoing
				),
				{
					changes: contentChanges,
					eol: this.buffer.getEOL(),
					versionId: this.getVersionId(),
					isUndoing: this._isUndoing,
					isRedoing: this._isRedoing,
					isFlush: false
				}
			);
		}
		return (result.reverseEdits === null ? undefined : result.reverseEdits);
	}

	private emitContentChangedEvent(rawChange: ModelRawContentChangedEvent, change: IModelContentChangedEvent): void {
		if (this.__isDisposing) {
			// Do not confuse listeners by emitting any event after disposing
			return;
		}
		//this._tokenizationTextModelPart.handleDidChangeContent(change);
		//this._bracketPairs.handleDidChangeContent(change);
		this.eventEmitter.fire(new InternalModelContentChangeEvent(rawChange, change));
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
