import { Event } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ITextModel, PositionAffinity } from 'mote/editor/common/model';
import { ILineBreaksComputerFactory } from 'mote/editor/common/modelLineProjectionData';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';
import { ICoordinatesConverter, IViewModel, ViewLineRenderingData } from 'mote/editor/common/viewModel';
import { ViewModelEventDispatcher } from 'mote/editor/common/viewModelEventDispatcher';
import { OutgoingViewModelEvent, ScrollChangedEvent, ViewModelEventsCollector } from 'mote/editor/common/viewModelEventsCollector';
import { CursorsController } from 'mote/editor/common/cursor/cursorsController';
import { CursorConfiguration, CursorState, PartialCursorState } from 'mote/editor/common/cursorCommon';
import { Position } from 'mote/editor/common/core/position';
import { ConfigurationChangedEvent, EditorOption } from 'mote/editor/common/config/editorOptions';
import { IViewModelLines, ViewModelLinesFromProjectedModel } from 'mote/editor/common/viewModel/viewModelLines';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { ScrollType } from 'mote/editor/common/editorCommon';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { EditorRange } from 'mote/editor/common/core/editorRange';

export class ViewModel extends Disposable implements IViewModel {

	public readonly onEvent: Event<OutgoingViewModelEvent>;

	public cursorConfig: CursorConfiguration;
	public readonly viewLayout: ViewLayout;

	private readonly lines: IViewModelLines;
	private readonly coordinatesConverter: ICoordinatesConverter;
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

	//#endregion

	//#region line info

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

	private _getViewLineRenderingData(lineNumber: number): ViewLineRenderingData {
		const mightContainRTL = false;
		const mightContainNonBasicASCII = true;
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

	//#endregion
}
