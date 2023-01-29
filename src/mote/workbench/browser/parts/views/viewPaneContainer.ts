/* eslint-disable code-no-unexternalized-strings */
import { IThemeService } from "mote/platform/theme/common/themeService";
import { Component } from "mote/workbench/common/component";
import { IAddedViewDescriptorRef, IView, IViewContainerModel, IViewDescriptor, IViewDescriptorRef, IViewDescriptorService, IViewPaneContainer, ViewContainer, ViewContainerLocation } from "mote/workbench/common/views";
import { IWorkbenchLayoutService } from "mote/workbench/services/layout/browser/layoutService";
import { addDisposableListener, Dimension } from "mote/base/browser/dom";
import { Orientation } from "mote/base/browser/ui/sash/sash";
import { IPaneViewOptions, PaneView } from "mote/base/browser/ui/splitview/paneview";
import { Emitter, Event } from 'mote/base/common/event';
import { combinedDisposable, dispose, IDisposable, toDisposable } from "mote/base/common/lifecycle";
import { assertIsDefined } from "mote/base/common/types";
import { IInstantiationService } from "mote/platform/instantiation/common/instantiation";
import { ILogService } from "mote/platform/log/common/log";
import { IViewPaneOptions, ViewPane } from "./viewPane";

export interface IViewPaneContainerOptions extends IPaneViewOptions {
	mergeViewWithContainerWhenSingleView: boolean;
}

interface IViewPaneItem {
	pane: ViewPane;
	disposable: IDisposable;
}

export class ViewPaneContainer extends Component implements IViewPaneContainer {

	private readonly _onDidAddViews = this._register(new Emitter<IView[]>());
	readonly onDidAddViews = this._onDidAddViews.event;

	private readonly _onDidRemoveViews = this._register(new Emitter<IView[]>());
	readonly onDidRemoveViews = this._onDidRemoveViews.event;

	private readonly _onTitleAreaUpdate: Emitter<void> = this._register(new Emitter<void>());
	readonly onTitleAreaUpdate: Event<void> = this._onTitleAreaUpdate.event;

	private readonly _onDidChangeVisibility = this._register(new Emitter<boolean>());
	readonly onDidChangeVisibility = this._onDidChangeVisibility.event;

	readonly viewContainer: ViewContainer;
	private lastFocusedPane: ViewPane | undefined;
	private lastMergedCollapsedPane: ViewPane | undefined;
	private paneItems: IViewPaneItem[] = [];
	private paneview?: PaneView;

	private visible: boolean = false;

	private didLayout = false;
	private dimension: Dimension | undefined;

	protected readonly viewContainerModel: IViewContainerModel;
	private viewDisposables: IDisposable[] = [];

	get panes(): ViewPane[] {
		return this.paneItems.map(i => i.pane);
	}

	get views(): IView[] {
		return this.panes;
	}

	get length(): number {
		return this.paneItems.length;
	}

	constructor(
		id: string,
		private options: IViewPaneContainerOptions,
		@IWorkbenchLayoutService protected layoutService: IWorkbenchLayoutService,
		@ILogService protected logService: ILogService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService protected viewDescriptorService: IViewDescriptorService,
	) {
		super(id, themeService);

		const container = this.viewDescriptorService.getViewContainerById(id);
		if (!container) {
			throw new Error('Could not find container');
		}

		this.viewContainer = container;
		this.viewContainerModel = this.viewDescriptorService.getViewContainerModel(container);
		this._register(toDisposable(() => this.viewDisposables = dispose(this.viewDisposables)));
	}

	create(parent: HTMLElement): void {
		this.logService.debug("[ViewPaneContainer]#create");

		this.paneview = this._register(new PaneView(parent, this.options));

		this._register(this.viewContainerModel.onDidAddVisibleViewDescriptors(added => this.onDidAddViewDescriptors(added)));
		this._register(this.viewContainerModel.onDidRemoveVisibleViewDescriptors(removed => this.onDidRemoveViewDescriptors(removed)));
		const addedViews: IAddedViewDescriptorRef[] = this.viewContainerModel.visibleViewDescriptors.map((viewDescriptor, index) => {
			const size = this.viewContainerModel.getSize(viewDescriptor.id);
			const collapsed = this.viewContainerModel.isCollapsed(viewDescriptor.id);
			return ({ viewDescriptor, index, size, collapsed });
		});
		if (addedViews.length) {
			this.onDidAddViewDescriptors(addedViews);
		}
	}

	renderHeader(parent: HTMLElement) {

		return false;
	}

	getTitle(): string {
		const containerTitle = this.viewContainerModel.title;

		if (this.isViewMergedWithContainer()) {
			const paneItemTitle = this.paneItems[0].pane.title;
			if (containerTitle === paneItemTitle) {
				return this.paneItems[0].pane.title;
			}
			return paneItemTitle ? `${containerTitle}: ${paneItemTitle}` : containerTitle;
		}

		return containerTitle;
	}

	private get orientation(): Orientation {
		switch (this.viewDescriptorService.getViewContainerLocation(this.viewContainer)) {
			case ViewContainerLocation.Sidebar:
			case ViewContainerLocation.AuxiliaryBar:
				return Orientation.VERTICAL;
			case ViewContainerLocation.Panel:
			//return this.layoutService.getPanelPosition() === Position.BOTTOM ? Orientation.HORIZONTAL : Orientation.VERTICAL;
		}

		return Orientation.VERTICAL;
	}

	focus(): void {
		if (this.lastFocusedPane) {
			this.lastFocusedPane.focus();
		} else if (this.paneItems.length > 0) {
			for (const { pane: pane } of this.paneItems) {
				if (pane.isExpanded()) {
					pane.focus();
					return;
				}
			}
		}
	}

	layout(dimension: Dimension): void {
		if (this.paneview) {
			if (this.paneview.orientation !== this.orientation) {
				this.paneview.flipOrientation(dimension.height, dimension.width);
			}

			this.paneview.layout(dimension.height, dimension.width);
		}

		this.dimension = dimension;
		if (this.didLayout) {
			this.saveViewSizes();
		} else {
			this.didLayout = true;
			this.restoreViewSizes();
		}
		if (this.dimension) {

		}
	}

	private saveViewSizes() {

	}

	private restoreViewSizes() {

	}

	protected updateTitleArea(): void {
		this._onTitleAreaUpdate.fire();
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewPaneOptions): ViewPane {
		return (this.instantiationService as any).createInstance(viewDescriptor.ctorDescriptor.ctor, ...(viewDescriptor.ctorDescriptor.staticArguments || []), options) as ViewPane;
	}

	protected onDidAddViewDescriptors(added: IAddedViewDescriptorRef[]): ViewPane[] {
		const panesToAdd: { pane: ViewPane; size: number; index: number }[] = [];

		for (const { viewDescriptor, collapsed, index, size } of added) {
			const pane = this.createView(viewDescriptor,
				{
					id: viewDescriptor.id,
					title: viewDescriptor.name,
					//fromExtensionId: (viewDescriptor as Partial<ICustomViewDescriptor>).extensionId,
					expanded: !collapsed
				});

			pane.render();

			const contextMenuDisposable = addDisposableListener(pane.draggableElement, 'contextmenu', e => {
				e.stopPropagation();
				e.preventDefault();
				//this.onContextMenu(new StandardMouseEvent(e), pane);
			});

			const collapseDisposable = Event.latch(Event.map(pane.onDidChange, () => !pane.isExpanded()))(collapsed => {
				this.viewContainerModel.setCollapsed(viewDescriptor.id, collapsed);
			});

			this.viewDisposables.splice(index, 0, combinedDisposable(contextMenuDisposable, collapseDisposable));
			panesToAdd.push({ pane, size: size || pane.minimumSize, index });
		}

		this.addPanes(panesToAdd);
		//this.restoreViewSizes();

		const panes: ViewPane[] = [];
		for (const { pane } of panesToAdd) {
			pane.setVisible(this.isVisible());
			panes.push(pane);
		}
		return panes;
	}

	private onDidRemoveViewDescriptors(removed: IViewDescriptorRef[]): void {
		removed = removed.sort((a, b) => b.index - a.index);
		const panesToRemove: ViewPane[] = [];
		for (const { index } of removed) {
			const [disposable] = this.viewDisposables.splice(index, 1);
			disposable.dispose();
			panesToRemove.push(this.panes[index]);
		}
		this.removePanes(panesToRemove);

		for (const pane of panesToRemove) {
			pane.setVisible(false);
		}
	}

	addPanes(panes: { pane: ViewPane; size: number; index?: number }[]): void {
		const wasMerged = this.isViewMergedWithContainer();

		for (const { pane: pane, size, index } of panes) {
			this.addPane(pane, size, index);
		}

		this.updateViewHeaders();
		if (this.isViewMergedWithContainer() !== wasMerged) {
			this.updateTitleArea();
		}

		this._onDidAddViews.fire(panes.map(({ pane }) => pane));
	}

	private addPane(pane: ViewPane, size: number, index = this.paneItems.length - 1) {

		const disposable = combinedDisposable(pane,);
		const paneItem: IViewPaneItem = { pane, disposable };

		this.paneItems.splice(index, 0, paneItem);
		assertIsDefined(this.paneview).addPane(pane, size, index);
	}

	removePanes(panes: ViewPane[]): void {
		const wasMerged = this.isViewMergedWithContainer();

		panes.forEach(pane => this.removePane(pane));

		this.updateViewHeaders();
		if (wasMerged !== this.isViewMergedWithContainer()) {
			this.updateTitleArea();
		}

		this._onDidRemoveViews.fire(panes);
	}

	private removePane(pane: ViewPane): void {
		const index = this.paneItems.findIndex(i => i.pane === pane);

		if (index === -1) {
			return;
		}

		if (this.lastFocusedPane === pane) {
			this.lastFocusedPane = undefined;
		}

		assertIsDefined(this.paneview).removePane(pane);
		const [paneItem] = this.paneItems.splice(index, 1);
		paneItem.disposable.dispose();

	}


	getView(viewId: string): IView | undefined {
		throw new Error("Method not implemented.");
	}

	setVisible(visible: boolean): void {
		if (this.visible !== !!visible) {
			this.visible = visible;

			this._onDidChangeVisibility.fire(visible);
		}

		this.panes.filter(view => view.isVisible() !== visible)
			.map((view) => view.setVisible(visible));
	}

	isVisible(): boolean {
		return this.visible;
	}

	private updateViewHeaders(): void {
		if (this.isViewMergedWithContainer()) {
			if (this.paneItems[0].pane.isExpanded()) {
				this.lastMergedCollapsedPane = undefined;
			} else {
				this.lastMergedCollapsedPane = this.paneItems[0].pane;
				this.paneItems[0].pane.setExpanded(true);
			}
			this.paneItems[0].pane.headerVisible = false;
		} else {
			this.paneItems.forEach(i => {
				i.pane.headerVisible = true;
				if (i.pane === this.lastMergedCollapsedPane) {
					i.pane.setExpanded(false);
				}
			});
			this.lastMergedCollapsedPane = undefined;
		}
	}

	isViewMergedWithContainer(): boolean {
		return false;
	}

	override dispose(): void {
		super.dispose();
		this.paneItems.forEach(i => i.disposable.dispose());
		if (this.paneview) {
			this.paneview.dispose();
		}
	}
}
