/* eslint-disable code-no-unexternalized-strings */
import { IThemeService } from "mote/platform/theme/common/themeService";
import { IWorkspaceContextService } from "mote/platform/workspace/common/workspace";
import { IPaneComposite } from "mote/workbench/common/panecomposite";
import { IView, IViewDescriptor, IViewDescriptorService, IViewsService, ViewContainer, ViewContainerLocation } from "mote/workbench/common/views";
import { IWorkbenchLayoutService, Parts } from "mote/workbench/services/layout/browser/layoutService";
import { IPaneCompositePartService } from "mote/workbench/services/panecomposite/browser/panecomposite";
import { Emitter, Event } from 'mote/base/common/event';
import { Disposable, DisposableStore, IDisposable, toDisposable } from "mote/base/common/lifecycle";
import { registerSingleton } from "mote/platform/instantiation/common/extensions";
import { IInstantiationService } from "mote/platform/instantiation/common/instantiation";
import { ILogService } from "mote/platform/log/common/log";
import { Registry } from 'mote/platform/registry/common/platform';
import { PaneComposite, PaneCompositeDescriptor, PaneCompositeExtensions, PaneCompositeRegistry } from "../../panecomposite";
import { ViewPaneContainer } from "./viewPaneContainer";
import { IStorageService } from 'mote/platform/storage/common/storage';

export class ViewsService extends Disposable implements IViewsService {

	private readonly _onDidChangeViewVisibility: Emitter<{ id: string; visible: boolean }> = this._register(new Emitter<{ id: string; visible: boolean }>());
	readonly onDidChangeViewVisibility: Event<{ id: string; visible: boolean }> = this._onDidChangeViewVisibility.event;

	private readonly _onDidChangeViewContainerVisibility = this._register(new Emitter<{ id: string; visible: boolean; location: ViewContainerLocation }>());
	readonly onDidChangeViewContainerVisibility = this._onDidChangeViewContainerVisibility.event;

	declare readonly _serviceBrand: undefined;

	private readonly viewDisposable: Map<IViewDescriptor, IDisposable>;
	private readonly viewPaneContainers: Map<string, ViewPaneContainer>;

	constructor(
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IPaneCompositePartService private readonly paneCompositeService: IPaneCompositePartService,
		//@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super();

		this.viewDisposable = new Map<IViewDescriptor, IDisposable>();
		this.viewPaneContainers = new Map<string, ViewPaneContainer>();

		this.viewDescriptorService.viewContainers.forEach(viewContainer =>
			this.onDidRegisterViewContainer(
				viewContainer, this.viewDescriptorService.getViewContainerLocation(viewContainer)!
			)
		);
		this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added, removed }) => this.onDidChangeContainers(added, removed)));

	}

	private onViewsAdded(added: IView[]): void {
		for (const view of added) {
			this.onViewsVisibilityChanged(view, view.isBodyVisible());
		}
	}

	private onViewsVisibilityChanged(view: IView, visible: boolean): void {
		//this.getOrCreateActiveViewContextKey(view).set(visible);
		this._onDidChangeViewVisibility.fire({ id: view.id, visible: visible });
	}

	private onViewsRemoved(removed: IView[]): void {
		for (const view of removed) {
			this.onViewsVisibilityChanged(view, false);
		}
	}

	private onDidChangeContainers(added: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }>, removed: ReadonlyArray<{ container: ViewContainer; location: ViewContainerLocation }>): void {
		for (const { container, location } of removed) {
			this.deregisterPaneComposite(container, location);
		}
		for (const { container, location } of added) {
			this.onDidRegisterViewContainer(container, location);
		}
	}

	private onDidRegisterViewContainer(viewContainer: ViewContainer, viewContainerLocation: ViewContainerLocation): void {
		this.registerPaneComposite(viewContainer, viewContainerLocation);

		const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
		this.onViewDescriptorsAdded(viewContainerModel.allViewDescriptors, viewContainer);
		this._register(viewContainerModel.onDidChangeAllViewDescriptors(({ added, removed }) => {
			this.onViewDescriptorsAdded(added, viewContainer);
			//this.onViewDescriptorsRemoved(removed);
		}));
		//this._register(this.registerOpenViewContainerAction(viewContainer));

	}

	private onViewDescriptorsAdded(views: ReadonlyArray<IViewDescriptor>, container: ViewContainer): void {
		const location = this.viewDescriptorService.getViewContainerLocation(container);
		if (location === null) {
			return;
		}

		this.getComposite(container.id, location);
		for (const viewDescriptor of views) {
			const disposables = new DisposableStore();
			//disposables.add(this.registerOpenViewAction(viewDescriptor));
			//disposables.add(this.registerFocusViewAction(viewDescriptor, composite?.name && composite.name !== composite.id ? composite.name : CATEGORIES.View));
			//disposables.add(this.registerResetViewLocationAction(viewDescriptor));
			this.viewDisposable.set(viewDescriptor, disposables);
		}
	}

	private async openComposite(compositeId: string, location: ViewContainerLocation, focus?: boolean): Promise<IPaneComposite | undefined> {
		return this.paneCompositeService.openPaneComposite(compositeId, location, focus);
	}

	private getComposite(compositeId: string, location: ViewContainerLocation): { id: string; name: string } | undefined {
		return this.paneCompositeService.getPaneComposite(compositeId, location);
	}

	isViewContainerVisible(id: string): boolean {
		throw new Error("Method not implemented.");
	}
	openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null> {
		throw new Error("Method not implemented.");
	}
	closeViewContainer(id: string): void {
		throw new Error("Method not implemented.");
	}
	isViewVisible(id: string): boolean {
		throw new Error("Method not implemented.");
	}
	openView<T extends IView>(id: string, focus?: boolean): Promise<T | null> {
		this.openComposite('', null as any);
		return Promise.resolve(null);
	}
	closeView(id: string): void {
		throw new Error("Method not implemented.");
	}

	public registerPaneComposite(viewContainer: ViewContainer, viewContainerLocation: ViewContainerLocation): void {
		const that = this;
		class PaneContainer extends PaneComposite {
			constructor(
				@ILogService logService: ILogService,
				//@ITelemetryService telemetryService: ITelemetryService,
				@IWorkspaceContextService contextService: IWorkspaceContextService,
				@IStorageService storageService: IStorageService,
				@IInstantiationService instantiationService: IInstantiationService,
				@IThemeService themeService: IThemeService,
				//@IContextMenuService contextMenuService: IContextMenuService,
				//@IExtensionService extensionService: IExtensionService,
			) {
				super(viewContainer.id, logService, instantiationService, themeService, storageService);
			}

			protected createViewPaneContainer(element: HTMLElement): ViewPaneContainer {
				const viewPaneContainerDisposables = this._register(new DisposableStore());

				// Use composite's instantiation service to get the editor progress service for any editors instantiated within the composite
				const viewPaneContainer = that.createViewPaneContainer(element, viewContainer, viewContainerLocation, viewPaneContainerDisposables, this.instantiationService);


				return viewPaneContainer;
			}
		}

		Registry.as<PaneCompositeRegistry>(getPaneCompositeExtension(viewContainerLocation)).registerPaneComposite(PaneCompositeDescriptor.create(
			PaneContainer,
			viewContainer.id,
			viewContainer.title,
			undefined,
			viewContainer.order,
			viewContainer.requestedIndex,
			undefined
		));
	}

	private deregisterPaneComposite(viewContainer: ViewContainer, viewContainerLocation: ViewContainerLocation): void {
		Registry.as<PaneCompositeRegistry>(getPaneCompositeExtension(viewContainerLocation)).deregisterPaneComposite(viewContainer.id);
	}

	private createViewPaneContainer(element: HTMLElement, viewContainer: ViewContainer, viewContainerLocation: ViewContainerLocation, disposables: DisposableStore, instantiationService: IInstantiationService): ViewPaneContainer {
		const viewPaneContainer: ViewPaneContainer = (instantiationService as any).createInstance(viewContainer.ctorDescriptor!.ctor, ...(viewContainer.ctorDescriptor!.staticArguments || []));

		this.viewPaneContainers.set(viewPaneContainer.getId(), viewPaneContainer);
		disposables.add(toDisposable(() => this.viewPaneContainers.delete(viewPaneContainer.getId())));

		disposables.add(viewPaneContainer.onDidAddViews(views => this.onViewsAdded(views)));
		//disposables.add(viewPaneContainer.onDidChangeViewVisibility(view => this.onViewsVisibilityChanged(view, view.isBodyVisible())));
		disposables.add(viewPaneContainer.onDidRemoveViews(views => this.onViewsRemoved(views)));
		//disposables.add(viewPaneContainer.onDidFocusView(view => this.focusedViewContextKey.set(view.id)));
		/*
		disposables.add(viewPaneContainer.onDidBlurView(view => {
			if (this.focusedViewContextKey.get() === view.id) {
				this.focusedViewContextKey.reset();
			}
		}));
		*/
		return viewPaneContainer;
	}
}

function getPaneCompositeExtension(viewContainerLocation: ViewContainerLocation): string {
	switch (viewContainerLocation) {
		case ViewContainerLocation.AuxiliaryBar:
			return PaneCompositeExtensions.Auxiliary;
		case ViewContainerLocation.Panel:
			return PaneCompositeExtensions.Panels;
		case ViewContainerLocation.Sidebar:
		default:
			return PaneCompositeExtensions.Viewlets;
	}
}

export function getPartByLocation(viewContainerLocation: ViewContainerLocation): Parts.SIDEBAR_PART {
	switch (viewContainerLocation) {
		case ViewContainerLocation.AuxiliaryBar:
		//return Parts.AUXILIARYBAR_PART;
		case ViewContainerLocation.Sidebar:
		default:
			return Parts.SIDEBAR_PART;
	}
}

registerSingleton(IViewsService, ViewsService);
