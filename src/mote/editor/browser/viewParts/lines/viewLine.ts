import * as dom from 'vs/base/browser/dom';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';
import BlockStore from 'mote/platform/store/common/blockStore';
import { createFastDomNode, FastDomNode } from 'vs/base/browser/fastDomNode';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IVisibleLine } from 'mote/editor/browser/view/viewLayer';
import { IViewLineContributionDescription, ViewLineExtensionsRegistry } from 'mote/editor/browser/viewLineExtensions';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';
import { StringBuilder } from 'mote/editor/common/core/stringBuilder';

export class EmptyViewLine extends Disposable {

	private domNode: FastDomNode<HTMLElement> = createFastDomNode(document.createElement('div'));

	public readonly onClick = this._register(dom.createEventEmitter(this.domNode.domNode, 'click')).event;


	constructor(
		private readonly viewController: ViewController,
	) {
		super();
		this.domNode.setClassName('view-line');
		this.domNode.domNode.style.cursor = 'pointer';
		this.onClick((e) => this.viewController.enter());
	}

	renderLine() {
		this.domNode.domNode.innerText = 'Click to continue';
	}

	getDomNode() {
		return this.domNode.domNode;
	}
}

export class ViewLine implements IVisibleLine {
	public static readonly CLASS_NAME = 'view-line';

	private domNode: FastDomNode<HTMLElement> | null = null;

	constructor(
		private readonly viewContext: ViewContext,
		private readonly viewController: ViewController,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {

	}

	layoutLine(lineNumber: number): void {
		throw new Error('Method not implemented.');
	}

	onContentChanged(): void {
		throw new Error('Method not implemented.');
	}

	public getDomNode(): HTMLElement | null {
		return this.domNode?.domNode || null;
	}

	public setDomNode(domNode: HTMLElement) {
		this.domNode = createFastDomNode(domNode);
	}

	public renderLine(lineNumber: number, deltaTop: number, viewportData: ViewportData, sb: StringBuilder) {
		const lineData = viewportData.getViewLineRenderingData(lineNumber);
		const store = lineData.store;
		const type = store.getType() || 'text';
		const contributions = ViewLineExtensionsRegistry.getViewLineContributions();
		const contribution: IViewLineContributionDescription = contributions.get(type) || contributions.get('text')!;
		const viewBlock: IViewLineContribution = this.instantiationService.createInstance(
			contribution.ctor, lineNumber, this.viewContext, this.viewController, {});

		const domNode = new FastDomNode(document.createElement('div'));
		domNode.setClassName('view-line');
		domNode.setAttribute('data-index', lineNumber.toString());
		domNode.setAttribute('data-block-id', store.id);
		domNode.setTop(deltaTop);

		const line = viewBlock.render(store);
		domNode.domNode.innerHTML = line;
		sb.appendString(domNode.domNode.outerHTML);
		return true;
	}
}




