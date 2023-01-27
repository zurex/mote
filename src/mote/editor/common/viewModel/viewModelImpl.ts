import { Event } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ITextModel, PositionAffinity, TrackedRangeStickiness } from 'mote/editor/common/model';
import { ILineBreaksComputerFactory } from 'mote/editor/common/modelLineProjectionData';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';
import { ICoordinatesConverter, IViewModel, ViewLineRenderingData } from 'mote/editor/common/viewModel';
import { OutgoingViewModelEvent, ScrollChangedEvent, ViewModelEventsCollector, ViewModelEventDispatcher, ModelContentChangedEvent, FocusChangedEvent } from 'mote/editor/common/viewModelEventDispatcher';
import { CursorsController } from 'mote/editor/common/cursor/cursorsController';
import { CursorConfiguration, CursorState, EditOperationType, IColumnSelectData, PartialCursorState } from 'mote/editor/common/cursorCommon';
import { Position } from 'mote/editor/common/core/position';
import { ConfigurationChangedEvent, EditorOption } from 'mote/editor/common/config/editorOptions';
import { IViewModelLines, ViewModelLinesFromProjectedModel } from 'mote/editor/common/viewModel/viewModelLines';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { ICommand, ScrollType } from 'mote/editor/common/editorCommon';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import * as textModelEvents from 'mote/editor/common/textModelEvents';
import { ArrayQueue } from 'mote/base/common/arrays';
import { BlockType } from 'mote/platform/store/common/record';

export class ViewModel extends Disposable implements IViewModel {

	public readonly onEvent: Event<OutgoingViewModelEvent>;

	public cursorConfig: CursorConfiguration;
	public readonly viewLayout: ViewLayout;

	private hasFocus: boolean;
	private readonly lines: IViewModelLines;
	private readonly viewportStart: ViewportStart;
	public readonly coordinatesConverter: ICoordinatesConverter;
	private readonly cursor: CursorsController;
	private readonly eventDispatcher: ViewModelEventDispatcher;

	constructor(
		private readonly editorId: number,
		private readonly configuration: IEditorConfiguration,
		public readonly model: ITextModel,
		domLineBreaksComputerFactory: ILineBreaksComputerFactory,
		monospaceLineBreaksComputerFactory: ILineBreaksComputerFactory,
		scheduleAtNextAnimationFrame: (callback: () => void) => IDisposable,
	) {
		super();

		this.eventDispatcher = new ViewModelEventDispatcher();
		this.onEvent = this.eventDispatcher.onEvent;

		this.hasFocus = false;
		this.viewportStart = ViewportStart.create(this.model);

		{
			const options = this.configuration.options;
			const fontInfo = options.get(EditorOption.FontInfo);
			const wrappingStrategy = options.get(EditorOption.WrappingStrategy);
			const wrappingInfo = options.get(EditorOption.WrappingInfo);
			const wrappingIndent = options.get(EditorOption.WrappingIndent);
			const wordBreak = options.get(EditorOption.WordBreak);

			this.lines = new ViewModelLinesFromProjectedModel(
				this.model,
				domLineBreaksComputerFactory,
				monospaceLineBreaksComputerFactory,
				fontInfo,
				0,
				wrappingStrategy,
				wrappingInfo.wrappingColumn,
				wrappingIndent,
				wordBreak
			);
		}
		this.coordinatesConverter = this.lines.createCoordinatesConverter();

		this.cursorConfig = new CursorConfiguration();
		this.cursor = this._register(new CursorsController(model, this, this.coordinatesConverter, this.cursorConfig));

		this.viewLayout = this._register(new ViewLayout(this, this.configuration, this.getLineCount(), scheduleAtNextAnimationFrame));

		this._register(this.viewLayout.onDidScroll((e) => {
			this.eventDispatcher.emitSingleViewEvent(new viewEvents.ViewScrollChangedEvent(e));
			this.eventDispatcher.emitOutgoingEvent(new ScrollChangedEvent(
				e.oldScrollWidth, e.oldScrollLeft, e.oldScrollHeight, e.oldScrollTop,
				e.scrollWidth, e.scrollLeft, e.scrollHeight, e.scrollTop
			));
		}));

		this.registerModelEvents();

		this._register(this.configuration.onDidChangeFast((e) => {
			try {
				const eventsCollector = this.eventDispatcher.beginEmitViewEvents();
				this.onConfigurationChanged(eventsCollector, e);
			} finally {
				this.eventDispatcher.endEmitViewEvents();
			}
		}));
	}

	public addViewEventHandler(eventHandler: ViewEventHandler): void {
		this.eventDispatcher.addViewEventHandler(eventHandler);
	}

	public removeViewEventHandler(eventHandler: ViewEventHandler): void {
		this.eventDispatcher.removeViewEventHandler(eventHandler);
	}

	public setHasFocus(hasFocus: boolean): void {
		this.hasFocus = hasFocus;
		this.cursor.setHasFocus(hasFocus);
		this.eventDispatcher.emitSingleViewEvent(new viewEvents.ViewFocusChangedEvent(hasFocus));
		this.eventDispatcher.emitOutgoingEvent(new FocusChangedEvent(!hasFocus, hasFocus));
	}

	private withViewEventsCollector<T>(callback: (eventsCollector: ViewModelEventsCollector) => T): T {
		try {
			const eventsCollector = this.eventDispatcher.beginEmitViewEvents();
			return callback(eventsCollector);
		} finally {
			this.eventDispatcher.endEmitViewEvents();
		}
	}

	//#region events handler

	private onConfigurationChanged(eventsCollector: ViewModelEventsCollector, e: ConfigurationChangedEvent): void {
		eventsCollector.emitViewEvent(new viewEvents.ViewConfigurationChangedEvent(e));
		this.viewLayout.onConfigurationChanged(e);
	}

	private registerModelEvents(): void {
		this._register(this.model.onDidChangeContentOrInjectedText((e) => {
			try {
				const eventsCollector = this.eventDispatcher.beginEmitViewEvents();

				let hadOtherModelChange = false;
				let hadModelLineChangeThatChangedLineMapping = false;

				const changes = (e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.changes : e.changes);
				const versionId = (e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.versionId : null);

				// Do a first pass to compute line mappings, and a second pass to actually interpret them
				const lineBreaksComputer = this.lines.createLineBreaksComputer();
				for (const change of changes) {
					switch (change.changeType) {
						case textModelEvents.RawContentChangedType.LinesInserted: {
							for (let lineIdx = 0; lineIdx < change.detail.length; lineIdx++) {
								const line = change.detail[lineIdx];
								let injectedText = change.injectedTexts[lineIdx];
								if (injectedText) {
									injectedText = injectedText.filter(element => (!element.ownerId || element.ownerId === this.editorId));
								}
								lineBreaksComputer.addRequest(line, injectedText, null);
							}
							break;
						}
						case textModelEvents.RawContentChangedType.LineChanged: {
							let injectedText: textModelEvents.LineInjectedText[] | null = null;
							if (change.injectedText) {
								injectedText = change.injectedText.filter(element => (!element.ownerId || element.ownerId === this.editorId));
							}
							lineBreaksComputer.addRequest(change.detail, injectedText, null);
							break;
						}
					}
				}
				const lineBreaks = lineBreaksComputer.finalize();
				const lineBreakQueue = new ArrayQueue(lineBreaks);

				for (const change of changes) {
					switch (change.changeType) {
						case textModelEvents.RawContentChangedType.Flush: {
							//this.lines.onModelFlushed();
							eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
							//this._decorations.reset();
							//this.viewLayout.onFlushed(this.getLineCount());
							hadOtherModelChange = true;
							break;
						}
						case textModelEvents.RawContentChangedType.LinesDeleted: {
							const linesDeletedEvent = this.lines.onModelLinesDeleted(versionId, change.fromLineNumber, change.toLineNumber);
							if (linesDeletedEvent !== null) {
								eventsCollector.emitViewEvent(linesDeletedEvent);
								this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
							}
							hadOtherModelChange = true;
							break;
						}
						case textModelEvents.RawContentChangedType.LinesInserted: {
							const insertedLineBreaks = lineBreakQueue.takeCount(change.detail.length);
							const linesInsertedEvent = this.lines.onModelLinesInserted(versionId, change.fromLineNumber, change.toLineNumber, insertedLineBreaks);
							if (linesInsertedEvent !== null) {
								eventsCollector.emitViewEvent(linesInsertedEvent);
								this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
							}
							hadOtherModelChange = true;
							break;
						}
						case textModelEvents.RawContentChangedType.LineChanged: {
							const changedLineBreakData = lineBreakQueue.dequeue()!;
							const [lineMappingChanged, linesChangedEvent, linesInsertedEvent, linesDeletedEvent] =
								this.lines.onModelLineChanged(versionId, change.lineNumber, changedLineBreakData);
							hadModelLineChangeThatChangedLineMapping = lineMappingChanged;
							if (linesChangedEvent) {
								eventsCollector.emitViewEvent(linesChangedEvent);
							}
							if (linesInsertedEvent) {
								eventsCollector.emitViewEvent(linesInsertedEvent);
								this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
							}
							if (linesDeletedEvent) {
								eventsCollector.emitViewEvent(linesDeletedEvent);
								this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
							}
							break;
						}
					}
				}

				if (versionId !== null) {
					//this.lines.acceptVersionId(versionId);
				}
				this.viewLayout.onHeightMaybeChanged();

				if (!hadOtherModelChange && hadModelLineChangeThatChangedLineMapping) {
					//eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
					eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent());
					//this.cursor.onLineMappingChanged(eventsCollector);
					//this._decorations.onLineMappingChanged();
				}
			} finally {
				this.eventDispatcher.endEmitViewEvents();
			}

			// Update the configuration and reset the centered view line
			const viewportStartWasValid = this.viewportStart.isValid;
			this.viewportStart.invalidate();
			this.configuration.setModelLineCount(this.model.getLineCount());
			this.updateConfigurationViewLineCountNow();

			// Recover viewport
			if (!this.hasFocus && this.model.getAttachedEditorCount() >= 2 && viewportStartWasValid) {
				const modelRange = this.model._getTrackedRange(this.viewportStart.modelTrackedRange);
				if (modelRange) {
					const viewPosition = this.coordinatesConverter.convertModelPositionToViewPosition(modelRange.getStartPosition());
					const viewPositionTop = this.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
					this.viewLayout.setScrollPosition({ scrollTop: viewPositionTop + this.viewportStart.startLineDelta }, ScrollType.Immediate);
				}
			}

			try {
				const eventsCollector = this.eventDispatcher.beginEmitViewEvents();
				if (e instanceof textModelEvents.InternalModelContentChangeEvent) {
					eventsCollector.emitOutgoingEvent(new ModelContentChangedEvent(e.contentChangedEvent));
				}
				//this.cursor.onModelContentChanged(eventsCollector, e);
			} finally {
				this.eventDispatcher.endEmitViewEvents();
			}

			//this.tokenizeViewportSoon.schedule();
		}));
	}

	private updateConfigurationViewLineCountNow(): void {
		this.configuration.setViewLineCount(this.lines.getViewLineCount());
	}

	//#endregion

	//#region cursor operations

	public getSelection(): EditorSelection {
		return this.cursor.getSelection();
	}

	public getSelections(): EditorSelection[] {
		return this.cursor.getSelections();
	}

	public getPrimaryCursorState(): CursorState {
		return this.cursor.getPrimaryCursorState();
	}

	public getCursorStates(): CursorState[] {
		return this.cursor.getCursorStates();
	}

	public setCursorStates(source: string | null | undefined, reason: CursorChangeReason, states: PartialCursorState[] | null): boolean {
		return this.withViewEventsCollector(eventsCollector => this.cursor.setStates(eventsCollector, source, reason, states));
	}

	public revealPrimaryCursor(source: string | null | undefined, revealHorizontal: boolean, minimalReveal: boolean = false): void {
		this.withViewEventsCollector(eventsCollector => this.cursor.revealPrimary(eventsCollector, source, minimalReveal, viewEvents.VerticalRevealType.Simple, revealHorizontal, ScrollType.Smooth));
	}

	public getPrevEditOperationType(): EditOperationType {
		return this.cursor.getPrevEditOperationType();
	}
	public setPrevEditOperationType(type: EditOperationType): void {
		this.cursor.setPrevEditOperationType(type);
	}

	revealTopMostCursor(source: string | null | undefined): void {
		throw new Error('Method not implemented.');
	}
	revealBottomMostCursor(source: string | null | undefined): void {
		throw new Error('Method not implemented.');
	}
	getCursorColumnSelectData(): IColumnSelectData {
		throw new Error('Method not implemented.');
	}
	setCursorColumnSelectData(columnSelectData: IColumnSelectData): void {
		throw new Error('Method not implemented.');
	}

	public getCursorAutoClosedCharacters(): EditorRange[] {
		return this.cursor.getAutoClosedCharacters();
	}

	public executeCommands(commands: ICommand[], source?: string | null | undefined): void {
		this.executeCursorEdit(eventsCollector => this.cursor.executeCommands(eventsCollector, commands, source));
	}

	//#endregion

	//#region line info

	getLineType(lineNumber: number): BlockType {
		return this.lines.getViewLineData(lineNumber).type;
	}

	public getLineCount(): number {
		return this.lines.getViewLineCount();
	}

	getLineMinColumn(lineNumber: number): number {
		return this.lines.getViewLineMinColumn(lineNumber);
	}

	getLineMaxColumn(lineNumber: number): number {
		return this.getLineContent(lineNumber).length + 1;
	}

	getLineContent(lineNumber: number): string {
		return this.lines.getViewLineContent(lineNumber);
	}

	getLineLength(lineNumber: number): number {
		return this.getLineContent(lineNumber).length;
	}

	public getViewportViewLineRenderingData(visibleRange: EditorRange, lineNumber: number): ViewLineRenderingData {
		//const allInlineDecorations = this._decorations.getDecorationsViewportData(visibleRange).inlineDecorations;
		//const inlineDecorations = allInlineDecorations[lineNumber - visibleRange.startLineNumber];
		return this._getViewLineRenderingData(lineNumber);
	}

	public getViewLineRenderingData(lineNumber: number): ViewLineRenderingData {
		//const inlineDecorations = this._decorations.getInlineDecorationsOnLine(lineNumber);
		return this._getViewLineRenderingData(lineNumber);
	}

	private _getViewLineRenderingData(lineNumber: number): ViewLineRenderingData {
		const mightContainRTL = false;
		const mightContainNonBasicASCII = false;
		const tabSize = 4;
		const lineData = this.lines.getViewLineData(lineNumber);
		const modelLineNumber = lineData.modelLineNumber;

		const store = this.model.getLineStore(modelLineNumber);

		return new ViewLineRenderingData(
			lineData.minColumn,
			lineData.maxColumn,
			lineData.content,
			lineData.continuesWithWrappedLine,
			mightContainRTL,
			mightContainNonBasicASCII,
			//lineData.tokens,
			//inlineDecorations,
			tabSize,
			lineData.startVisibleColumn,
			store
		);
	}

	public normalizePosition(position: Position, affinity: PositionAffinity): Position {
		return position;
	}

	//#endregion

	//#region edit

	private executeCursorEdit(callback: (eventsCollector: ViewModelEventsCollector) => void): void {
		this.withViewEventsCollector(callback);
	}

	public type(text: string, source?: string | null | undefined): void {
		this.executeCursorEdit(eventsCollector => this.cursor.type(eventsCollector, text, source));
	}

	public compositionType(text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number, source?: string | null | undefined): void {
		this.executeCursorEdit(eventsCollector => this.cursor.compositionType(eventsCollector, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source));
	}

	//#endregion
}

class ViewportStart implements IDisposable {

	public static create(model: ITextModel): ViewportStart {
		const viewportStartLineTrackedRange = model._setTrackedRange(null, new EditorRange(1, 1, 1, 1), TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
		return new ViewportStart(model, 1, false, viewportStartLineTrackedRange, 0);
	}

	public get viewLineNumber(): number {
		return this._viewLineNumber;
	}

	public get isValid(): boolean {
		return this._isValid;
	}

	public get modelTrackedRange(): string {
		return this._modelTrackedRange;
	}

	public get startLineDelta(): number {
		return this._startLineDelta;
	}

	private constructor(
		private readonly _model: ITextModel,
		private _viewLineNumber: number,
		private _isValid: boolean,
		private _modelTrackedRange: string,
		private _startLineDelta: number,
	) { }

	public dispose(): void {
		this._model._setTrackedRange(this._modelTrackedRange, null, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
	}

	public update(viewModel: IViewModel, startLineNumber: number): void {
		const position = viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(startLineNumber, viewModel.getLineMinColumn(startLineNumber)));
		const viewportStartLineTrackedRange = viewModel.model._setTrackedRange(this._modelTrackedRange, new EditorRange(position.lineNumber, position.column, position.lineNumber, position.column), TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
		const viewportStartLineTop = viewModel.viewLayout.getVerticalOffsetForLineNumber(startLineNumber);
		const scrollTop = viewModel.viewLayout.getCurrentScrollTop();

		this._viewLineNumber = startLineNumber;
		this._isValid = true;
		this._modelTrackedRange = viewportStartLineTrackedRange;
		this._startLineDelta = scrollTop - viewportStartLineTop;
	}

	public invalidate(): void {
		this._isValid = false;
	}
}
