import 'mote/css!./viewLines';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { IVisibleLinesHost, VisibleLinesCollection } from 'mote/editor/browser/view/viewLayer';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { DomReadingContext, EmptyViewLine, ViewLine, ViewLineOptions } from 'mote/editor/browser/viewParts/lines/viewLine';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { FastDomNode } from 'mote/base/browser/fastDomNode';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { HorizontalPosition, VisibleRanges } from 'mote/editor/browser/view/renderingContext';
import { getDataRootInParent } from 'mote/editor/common/htmlElementUtils';
import { IViewLineLayout } from 'mote/editor/common/viewModel';
import { EditorOption } from 'mote/editor/common/config/editorOptions';
import { applyFontInfo } from 'mote/editor/browser/config/domFontInfo';
import { clearNode } from 'mote/base/browser/dom';

class LastRenderedData {

	private _currentVisibleRange: EditorRange;

	constructor() {
		this._currentVisibleRange = new EditorRange(1, 1, 1, 1);
	}

	public getCurrentVisibleRange(): EditorRange {
		return this._currentVisibleRange;
	}

	public setCurrentVisibleRange(currentVisibleRange: EditorRange): void {
		this._currentVisibleRange = currentVisibleRange;
	}
}

export class ViewLines extends ViewPart implements IViewLineLayout, IVisibleLinesHost<ViewLine> {

	private domNode: FastDomNode<HTMLElement>;
	private readonly _textRangeRestingSpot: HTMLElement;

	private readonly viewController: ViewController;
	private readonly visibleLines: VisibleLinesCollection<ViewLine>;

	private readonly lastRenderedData: LastRenderedData;

	// config
	private canUseLayerHinting: boolean = true;
	private viewLineOptions: ViewLineOptions;

	// --- width
	private maxLineWidth: number = 0;

	constructor(
		context: ViewContext,

		private readonly linesContent: FastDomNode<HTMLElement>,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
		super(context);
		this.viewController = context.controller;

		this._textRangeRestingSpot = document.createElement('div');

		this.visibleLines = new VisibleLinesCollection(this);

		const conf = this.context.configuration;
		const options = conf.options;
		const fontInfo = options.get(EditorOption.FontInfo);

		this.viewLineOptions = new ViewLineOptions(conf, this.context.theme.type);

		this.domNode = this.visibleLines.domNode;

		this.domNode.setClassName('view-lines');
		this.domNode.setAttribute('data-root', '');
		this.domNode.setAttribute('contenteditable', 'true');
		this.domNode.domNode.style.lineHeight = '1.5';
		this.domNode.domNode.style.fontSize = '16px';
		this.domNode.setTop(160);

		PartFingerprints.write(this.domNode, PartFingerprint.ViewLines);

		applyFontInfo(this.domNode, fontInfo);

		this.lastRenderedData = new LastRenderedData();
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public createVisibleLine(): ViewLine {
		return this.instantiationService.createInstance(ViewLine, this.viewLineOptions, this.context, this.viewController);
	}

	public prepareRender(): void {
		throw new Error('Not supported');
	}

	public render(): void {
		throw new Error('Not supported');
	}

	public renderLines(viewportData: ViewportData) {
		if (this.context.viewModel.getLineCount() === 0) {
			clearNode(this.domNode.domNode);
			const line = new EmptyViewLine(this.viewController);
			//line.renderLine();
			this.domNode.domNode.appendChild(line.getDomNode());
			return;
		} else {

		}
		// (1) render lines - ensures lines are in the DOM
		this.visibleLines.renderLines(viewportData);
		this.lastRenderedData.setCurrentVisibleRange(viewportData.visibleRange);

		// (2) compute horizontal scroll position:
		//  - this must happen after the lines are in the DOM since it might need a line that rendered just now
		//  - it might change `scrollWidth` and `scrollLeft`

		// (3) handle scrolling
		this.linesContent.setLayerHinting(this.canUseLayerHinting);
		this.linesContent.setContain('strict');
		const adjustedScrollTop = this.context.viewLayout.getCurrentScrollTop();
		this.linesContent.setTop(-adjustedScrollTop);
	}

	//#region view events handler

	public override onFlushed(e: viewEvents.ViewFlushedEvent): boolean {
		const shouldRender = this.visibleLines.onFlushed(e);
		this.maxLineWidth = 0;
		return shouldRender;
	}

	public override onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return this.visibleLines.onLinesInserted(e);
	}

	public override onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return this.visibleLines.onLinesDeleted(e);
	}

	public override onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return this.visibleLines.onLinesChanged(e);
	}

	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		const adjustedScrollTop = this.context.viewLayout.getCurrentScrollTop();
		this.linesContent.setTop(-adjustedScrollTop);
		return false;
	}

	//#endregion

	public lineHeightForPosition(position: Position): number | null {
		const line = this.visibleLines.getVisibleLine(position.lineNumber);
		const lineHeight = line.getDomNode()!.clientHeight;
		if (lineHeight > 40) {
			return 30;
		}
		return lineHeight;
	}

	/**
	 * Get the vertical offset (the sum of heights for all objects above) a certain line number.
	 *
	 * @param lineNumber The line number
	 * @return The sum of heights for all objects above `lineNumber`.
	 */
	public getVerticalOffsetForLineNumber(lineNumber: number, includeViewZones = false): number {
		if (this.visibleLines.getStartLineNumber() > lineNumber) {
			return -1;
		}
		if (this.visibleLines.getEndLineNumber() < lineNumber) {
			return -1;
		}
		const line = this.visibleLines.getVisibleLine(lineNumber);
		return line.getDomNode()!.getBoundingClientRect().y;
	}

	public visibleRangeForPosition(position: Position): HorizontalPosition | null {
		const visibleRanges = this.visibleRangesForLineRange(position.lineNumber, position.column, position.column);
		if (!visibleRanges) {
			return null;
		}

		return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
	}

	private visibleRangesForLineRange(lineNumber: number, startColumn: number, endColumn: number): VisibleRanges | null {
		if (this.shouldRender()) {
			// Cannot read from the DOM because it is dirty
			// i.e. the model & the dom are out of sync, so I'd be reading something stale
			return null;
		}

		if (lineNumber < this.visibleLines.getStartLineNumber() || lineNumber > this.visibleLines.getEndLineNumber()) {
			return null;
		}

		return this.visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot));
	}

	public getLineWidth(lineNumber: number): number {
		const rendStartLineNumber = this.visibleLines.getStartLineNumber();
		const rendEndLineNumber = this.visibleLines.getEndLineNumber();
		if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
			// Couldn't find line
			return -1;
		}

		return this.visibleLines.getVisibleLine(lineNumber).getWidth();
	}

	public getPositionFromDOMInfo(spanNode: HTMLElement, offset: number): Position | null {
		const lineNumber = this.getLineNumberFor(spanNode);

		if (lineNumber === -1) {
			// Couldn't find view line node
			return null;
		}

		if (lineNumber < 1 || lineNumber > this.context.viewModel.getLineCount()) {
			// lineNumber is outside range
			return null;
		}

		if (this.context.viewModel.getLineMaxColumn(lineNumber) === 1) {
			// Line is empty
			return new Position(lineNumber, 1);
		}

		const rendStartLineNumber = this.visibleLines.getStartLineNumber();
		const rendEndLineNumber = this.visibleLines.getEndLineNumber();
		if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
			// Couldn't find line
			return null;
		}

		let column = offset + 1;// TODO: this.visibleLines.getVisibleLine(lineNumber).getColumnOfNodeOffset(lineNumber, spanNode, offset);
		const minColumn = this.context.viewModel.getLineMinColumn(lineNumber);
		if (column < minColumn) {
			column = minColumn;
		}
		return new Position(lineNumber, column);
	}

	private getLineNumberFor(domNode: HTMLElement): number {
		domNode = getDataRootInParent(domNode)! as HTMLElement;
		const index = domNode.getAttribute('data-index') || '-1';
		return parseInt(index);
	}

	/**
	 * @returns the line number of this view line dom node.
	 */
	private _getLineNumberFor(domNode: HTMLElement): number {
		const startLineNumber = this.visibleLines.getStartLineNumber();
		const endLineNumber = this.visibleLines.getEndLineNumber();
		for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
			const line = this.visibleLines.getVisibleLine(lineNumber);
			if (domNode === line.getDomNode()) {
				return lineNumber;
			}
		}
		return -1;
	}
}
