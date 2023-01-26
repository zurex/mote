import 'vs/css!./viewLines';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import { IVisibleLinesHost, VisibleLinesCollection } from 'mote/editor/browser/view/viewLayer';
import { PartFingerprint, PartFingerprints, ViewPart } from 'mote/editor/browser/view/viewPart';
import { ViewLine } from 'mote/editor/browser/viewParts/lines/viewLine';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { clearNode } from 'mote/base/browser/dom';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import { ConfigurationChangedEvent } from 'mote/editor/common/config/editorOptions';
import { EditorRange } from 'mote/editor/common/core/editorRange';

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

export class ViewLines extends ViewPart implements IVisibleLinesHost<ViewLine> {

	private domNode: FastDomNode<HTMLElement>;
	private readonly _textRangeRestingSpot: HTMLElement;

	private readonly viewController: ViewController;
	private readonly visibleLines: VisibleLinesCollection<ViewLine>;

	private readonly lastRenderedData: LastRenderedData;

	// config
	private canUseLayerHinting: boolean = true;

	constructor(
		context: ViewContext,

		private readonly linesContent: FastDomNode<HTMLElement>,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
		super(context);
		this.viewController = context.controller;

		this._textRangeRestingSpot = document.createElement('div');

		this.visibleLines = new VisibleLinesCollection(this);

		this.domNode = this.visibleLines.domNode;

		this.domNode.setClassName('view-lines');
		this.domNode.setAttribute('data-root', '');
		this.domNode.setAttribute('contenteditable', 'true');
		this.domNode.domNode.style.lineHeight = '1.5';
		this.domNode.domNode.style.fontSize = '16px';
		this.domNode.setTop(160);

		PartFingerprints.write(this.domNode, PartFingerprint.ViewLines);

		this.lastRenderedData = new LastRenderedData();
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.domNode;
	}

	public createVisibleLine(): ViewLine {
		return this.instantiationService.createInstance(ViewLine, this.context, this.viewController);
	}

	public prepareRender(): void {
		throw new Error('Not supported');
	}

	public render(): void {
		throw new Error('Not supported');
	}

	public renderLines(viewportData: ViewportData) {
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

		// TODO fixme, use it to let viewlayout know the content change
		this.context.viewLayout.onConfigurationChanged(new ConfigurationChangedEvent([]));
	}

	//#region view events handler

	public override onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return true;
	}

	public override onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return true;
	}

	public override onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return true;
	}

	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		const adjustedScrollTop = this.context.viewLayout.getCurrentScrollTop();
		this.linesContent.setTop(-adjustedScrollTop);
		return false;
	}

	//#endregion
}
