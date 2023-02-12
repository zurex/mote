/* eslint-disable code-no-unexternalized-strings */
import { Disposable, DisposableStore } from 'mote/base/common/lifecycle';
import { IWorkbenchLayoutService, Parts, Position } from 'mote/workbench/services/layout/browser/layoutService';
import { Dimension, getClientArea, IDimension, isAncestorUsingFlowTo, position, size } from 'mote/base/browser/dom';
import { Part } from "./part";
import { Emitter } from "mote/base/common/event";
import { ILogService } from "mote/platform/log/common/log";
import { ServicesAccessor } from "mote/platform/instantiation/common/instantiation";
import { IPaneCompositePartService } from 'mote/workbench/services/panecomposite/browser/panecomposite';
import { DeferredPromise, Promises } from "mote/base/common/async";
import { IViewDescriptorService, ViewContainerLocation } from 'mote/workbench/common/views';
import { ISerializableView, ISerializedGrid, ISerializedLeafNode, ISerializedNode, Orientation, SerializableGrid } from 'mote/base/browser/ui/grid/grid';
import { mark } from 'mote/base/common/performance';
import { ILifecycleService } from 'mote/workbench/services/lifecycle/common/lifecycle';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';
import { IPath } from 'mote/platform/window/common/window';
import { pathToEditor } from 'mote/workbench/common/editor';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { EditorGroupLayout, IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IStatusbarService } from 'mote/workbench/services/statusbar/browser/statusbar';
import { isWeb } from 'mote/base/common/platform';
import { isWCOEnabled } from 'mote/base/browser/browser';
import { ITitleService } from 'mote/workbench/services/title/common/titleService';

interface IWorkbenchLayoutWindowInitializationState {
	views: {
		defaults: string[] | undefined;
		containerToRestore: {
			sideBar?: string;
			panel?: string;
			auxiliaryBar?: string;
		};
	};
	editor: {
		restoreEditors: boolean;
		editorToOpen: Promise<IResourceEditorInput | undefined>;
	};
}

interface IWorkbenchLayoutWindowRuntimeState {
	fullscreen: boolean;
	maximized: boolean;
	hasFocus: boolean;
	windowBorder: boolean;
	menuBar: {
		toggled: boolean;
	};
	zenMode: {
		transitionDisposables: DisposableStore;
	};
}

interface IWorkbenchLayoutWindowState {
	runtime: IWorkbenchLayoutWindowRuntimeState;
	initialization: IWorkbenchLayoutWindowInitializationState;
}

enum WorkbenchLayoutClasses {
	SIDEBAR_HIDDEN = 'nosidebar',
	EDITOR_HIDDEN = 'noeditorarea',
	PANEL_HIDDEN = 'nopanel',
	AUXILIARYBAR_HIDDEN = 'noauxiliarybar',
	STATUSBAR_HIDDEN = 'nostatusbar',
	FULLSCREEN = 'fullscreen',
	MAXIMIZED = 'maximized',
	WINDOW_BORDER = 'border'
}

interface IPathToOpen extends IPath {
	readonly viewColumn?: number;
}

interface IInitialEditorsState {
	readonly filesToOpenOrCreate?: IPathToOpen[];
	readonly filesToDiff?: IPathToOpen[];
	readonly filesToMerge?: IPathToOpen[];

	readonly layout?: EditorGroupLayout;
}

export abstract class Layout extends Disposable implements IWorkbenchLayoutService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidLayout = this._register(new Emitter<IDimension>());
	readonly onDidLayout = this._onDidLayout.event;

	//#region Properties

	readonly hasContainer = true;
	readonly container = document.createElement('div');

	private _dimension!: IDimension;
	get dimension(): IDimension { return this._dimension; }

	get offset() {
		let top = 0;
		let quickPickTop = 0;
		/*
		if (this.isVisible(Parts.BANNER_PART)) {
			top = this.getPart(Parts.BANNER_PART).maximumHeight;
			quickPickTop = top;
		}
		*/
		if (this.isVisible(Parts.TITLEBAR_PART)) {
			top += this.getPart(Parts.TITLEBAR_PART).maximumHeight;
			quickPickTop = top;
		}
		// If the command center is visible then the quickinput should go over the title bar and the banner
		if (this.titleService.isCommandCenterVisible) {
			quickPickTop = 6;
		}
		return { top, quickPickTop };
	}

	//#endregion

	private readonly parts = new Map<string, Part>();

	private initialized = false;
	private workbenchGrid!: SerializableGrid<ISerializableView>;

	private titleBarPartView!: ISerializableView;
	private activityBarPartView!: ISerializableView;
	private statusBarPartView!: ISerializableView;
	private sideBarPartView!: ISerializableView;
	private editorPartView!: ISerializableView;

	protected logService!: ILogService;

	//#region workbench services
	private editorService!: IEditorService;
	private editorGroupService!: IEditorGroupsService;
	private environmentService!: IBrowserWorkbenchEnvironmentService;
	private paneCompositeService!: IPaneCompositePartService;
	private viewDescriptorService!: IViewDescriptorService;
	private statusBarService!: IStatusbarService;
	private titleService!: ITitleService;

	//#endregion

	private windowState!: IWorkbenchLayoutWindowState;

	private disposed = false;

	constructor(
		protected readonly parent: HTMLElement
	) {
		super();
	}

	isVisible(part: Parts): boolean {
		if (this.initialized) {
			switch (part) {
				case Parts.SIDEBAR_PART:
					return this.workbenchGrid.isViewVisible(this.sideBarPartView);
			}
		}
		return true;
	}

	setPartHidden(hidden: boolean, part: Parts.SIDEBAR_PART | Parts.EDITOR_PART | Parts.ACTIVITYBAR_PART): void {
		switch (part) {
			case Parts.SIDEBAR_PART:
				return this.setSideBarHidden(hidden);
			case Parts.ACTIVITYBAR_PART:
				return this.setActivityBarHidden(hidden);
		}
	}

	getSideBarPosition(): Position {
		//return this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON);
		return Position.LEFT;
	}

	protected initLayout(accessor: ServicesAccessor): void {
		this.logService.debug("[Layout] initLayout");
		// Services
		//const themeService = accessor.get(IThemeService);
		this.environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);

		// Parts
		this.editorService = accessor.get(IEditorService);
		this.editorGroupService = accessor.get(IEditorGroupsService);
		this.paneCompositeService = accessor.get(IPaneCompositePartService);
		this.viewDescriptorService = accessor.get(IViewDescriptorService);
		this.statusBarService = accessor.get(IStatusbarService);
		this.titleService = accessor.get(ITitleService);

		this.registerLayoutListeners();

		// State
		this.initLayoutState(accessor.get(ILifecycleService), accessor);
	}

	private registerLayoutListeners(): void {

		// Wait to register these listeners after the editor group service
		// is ready to avoid conflicts on startup
		this.editorGroupService.whenRestored.then(() => {

		});
	}

	private initLayoutState(lifecycleService: ILifecycleService, accessor: ServicesAccessor) {

		// Window Initialization State
		const initialPageToOpen = this.getInitialPageToOpen();
		const windowInitializationState: IWorkbenchLayoutWindowInitializationState = {
			editor: {
				restoreEditors: false, //this.shouldRestoreEditors(this.contextService, initialFilesToOpen),
				editorToOpen: this.resolveEditorToOpen(initialPageToOpen, accessor)
			},
			views: {
				defaults: undefined,// this.getDefaultLayoutViews(this.environmentService, this.storageService),
				containerToRestore: {}
			}
		};

		this.windowState = {
			initialization: windowInitializationState,
			runtime: null as any //windowRuntimeState,
		};

		// Sidebar View Container To Restore
		if (this.isVisible(Parts.SIDEBAR_PART)) {
			if (!initialPageToOpen) {
				this.windowState.initialization.views.containerToRestore.sideBar = 'workbench.explorer.pageView';
			}
		}
	}

	private async resolveEditorToOpen(initialPageToOpen: IPath | undefined, accessor: ServicesAccessor): Promise<IResourceEditorInput | undefined> {
		if (initialPageToOpen) {
			return await pathToEditor(initialPageToOpen, accessor);
		}
		return undefined;
	}

	private getInitialPageToOpen() {
		const pages = this.environmentService.pagesToOpenOrCreate;
		return pages ? pages[0] : undefined;
	}

	focus(): void {
		this.focusPart(Parts.EDITOR_PART);
	}

	registerPart(part: Part): void {
		this.parts.set(part.getId(), part);
	}

	protected getPart(key: Parts): Part {
		const part = this.parts.get(key);
		if (!part) {
			throw new Error(`Unknown part ${key}`);
		}

		return part;
	}

	hasFocus(part: Parts): boolean {
		const activeElement = document.activeElement;
		if (!activeElement) {
			return false;
		}

		const container = this.getContainer(part);

		return !!container && isAncestorUsingFlowTo(activeElement, container);
	}

	focusPart(part: Parts): void {
		switch (part) {
			case Parts.EDITOR_PART:
				this.editorGroupService.activeGroup.focus();
				break;
			case Parts.STATUSBAR_PART:
				this.statusBarService.focus();
			default: {
				// Title Bar & Banner simply pass focus to container
				const container = this.getContainer(part);
				container?.focus();
			}
		}
	}

	protected createWorkbenchLayout(): void {
		const titleBar = this.getPart(Parts.TITLEBAR_PART);
		const sideBar = this.getPart(Parts.SIDEBAR_PART);
		const editorPart = this.getPart(Parts.EDITOR_PART);
		const activityBar = this.getPart(Parts.ACTIVITYBAR_PART);
		const statusBar = this.getPart(Parts.STATUSBAR_PART);

		// View references for all parts
		this.titleBarPartView = titleBar;
		this.sideBarPartView = sideBar;
		this.statusBarPartView = statusBar;
		this.activityBarPartView = activityBar;
		this.editorPartView = editorPart;

		const viewMap = {
			[Parts.ACTIVITYBAR_PART]: this.activityBarPartView,
			[Parts.TITLEBAR_PART]: this.titleBarPartView,
			[Parts.SIDEBAR_PART]: this.sideBarPartView,
			[Parts.EDITOR_PART]: this.editorPartView,
			[Parts.STATUSBAR_PART]: this.statusBarPartView,
		};

		const fromJSON = ({ type }: { type: Parts }) => viewMap[type];
		const workbenchGrid = SerializableGrid.deserialize(
			this.createGridDescriptor(),
			{ fromJSON },
			{ proportionalLayout: false }
		);

		this.container.prepend(workbenchGrid.element);
		this.container.setAttribute('role', 'application');
		this.container.classList.add('mote-workbench');
		this.workbenchGrid = workbenchGrid;
	}

	private getClientArea(): Dimension {
		return getClientArea(this.parent);
	}

	layout(): void {
		if (!this.disposed) {
			this._dimension = this.getClientArea();

			position(this.container, 0, 0, 0, 0, 'relative');
			size(this.container, this._dimension.width, this._dimension.height);

			// Layout the grid widget
			this.workbenchGrid.layout(this._dimension.width, this._dimension.height);
			this.initialized = true;

			// Emit as event
			this._onDidLayout.fire(this._dimension);
		}
	}

	private readonly whenReadyPromise = new DeferredPromise<void>();
	protected readonly whenReady = this.whenReadyPromise.p;

	private readonly whenRestoredPromise = new DeferredPromise<void>();
	readonly whenRestored = this.whenRestoredPromise.p;
	private restored = false;

	isRestored(): boolean {
		return this.restored;
	}

	protected restoreParts(): void {

		// distinguish long running restore operations that
		// are required for the layout to be ready from those
		// that are needed to signal restoring is done
		const layoutReadyPromises: Promise<unknown>[] = [];
		const layoutRestoredPromises: Promise<unknown>[] = [];

		// Restore editors
		layoutReadyPromises.push((async () => {
			mark('mote/willRestoreEditors');

			const editor = await this.windowState.initialization.editor.editorToOpen;
			let openEditorPromise: Promise<unknown> | undefined = undefined;
			if (editor) {
				openEditorPromise = this.editorService.openEditorWithResource(editor);
			}
			// do not block the overall layout ready flow from potentially
			// slow editors to resolve on startup
			layoutRestoredPromises.push(
				Promise.all([
					openEditorPromise,
					this.editorGroupService.whenRestored
				]).finally(() => {
					// the `mote/didRestoreEditors` perf mark is specifically
					// for when visible editors have resolved, so we only mark
					// if when editor group service has restored.
					mark('mote/didRestoreEditors');
				})
			);
		})());

		// Restore Sidebar
		layoutReadyPromises.push((async () => {

			// Restoring views could mean that sidebar already
			// restored, as such we need to test again
			//await restoreDefaultViewsPromise;
			if (!this.windowState.initialization.views.containerToRestore.sideBar) {
				this.setSideBarHidden(true, true);
				this.setActivityBarHidden(true);
				return;
			}

			let viewlet = await this.paneCompositeService.openPaneComposite(this.windowState.initialization.views.containerToRestore.sideBar, ViewContainerLocation.Sidebar);
			if (!viewlet) {
				viewlet = await this.paneCompositeService.openPaneComposite(
					this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id, ViewContainerLocation.Sidebar); // fallback to default viewlet as needed
			}

			this.logService.debug("[Layout] did restore SideBar viewlet", viewlet);
		})());

		// Await for promises that we recorded to update
		// our ready and restored states properly.
		Promises.settled(layoutReadyPromises).finally(() => {
			this.whenReadyPromise.complete();

			Promises.settled(layoutRestoredPromises).finally(() => {
				this.restored = true;
				this.whenRestoredPromise.complete();
			});
		});
	}

	private createGridDescriptor(): ISerializedGrid {

		const width = 1080;
		const height = 800;
		const sideBarSize = 200;
		//const panelSize = 300;

		const titleBarHeight = this.titleBarPartView.minimumHeight;
		const activityBarWidth = this.activityBarPartView.minimumWidth;
		const statusBarHeight = this.statusBarPartView.minimumHeight;
		const middleSectionHeight = height - titleBarHeight - statusBarHeight;

		const titleAndBanner: ISerializedNode[] = [
			{
				type: 'leaf',
				data: { type: Parts.TITLEBAR_PART },
				size: titleBarHeight,
				visible: this.isVisible(Parts.TITLEBAR_PART)
			}
		];

		const activityBarNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.ACTIVITYBAR_PART },
			size: activityBarWidth,
			visible: true,
		};

		const sideBarNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.SIDEBAR_PART },
			size: sideBarSize,
			visible: true
		};

		const editorNode: ISerializedLeafNode = {
			type: 'leaf',
			data: { type: Parts.EDITOR_PART },
			size: 1080, // Update based on sibling sizes
			visible: true
		};

		const middleSection: ISerializedNode[] = [activityBarNode, sideBarNode, editorNode];

		const result: ISerializedGrid = {
			root: {
				type: 'branch',
				size: width,
				data: [
					...(this.shouldShowBannerFirst() ? titleAndBanner.reverse() : titleAndBanner),
					{
						type: 'branch',
						data: middleSection,
						size: middleSectionHeight
					},
					{
						type: 'leaf',
						data: { type: Parts.STATUSBAR_PART },
						size: statusBarHeight,
						//visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN)
					}
				]
			},
			orientation: Orientation.VERTICAL,
			width,
			height
		};

		return result;
	}

	getContainer(part: Parts): HTMLElement | undefined {
		if (!this.parts.get(part)) {
			return undefined;
		}

		return this.getPart(part).getContainer();
	}

	private shouldShowBannerFirst(): boolean {
		return isWeb && !isWCOEnabled();
	}

	private setActivityBarHidden(hidden: boolean, skipLayout?: boolean): void {
		// Propagate to grid
		//this.stateModel.setRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN, hidden);
		this.workbenchGrid.setViewVisible(this.activityBarPartView, !hidden);
	}

	private setSideBarHidden(hidden: boolean, skipLayout?: boolean) {

		// Adjust CSS
		if (hidden) {
			this.container.classList.add(WorkbenchLayoutClasses.SIDEBAR_HIDDEN);
		} else {
			this.container.classList.remove(WorkbenchLayoutClasses.SIDEBAR_HIDDEN);
		}

		// If sidebar becomes hidden, also hide the current active Viewlet if any
		if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)) {
			this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Sidebar);

			/* TODO fixme
			// Pass Focus to Editor or Panel if Sidebar is now hidden
			const activePanel = this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
			if (this.hasFocus(Parts.PANEL_PART) && activePanel) {
				activePanel.focus();
			} else {
				this.focus();
			}
			*/
		}

		// Propagate to grid
		this.workbenchGrid.setViewVisible(this.sideBarPartView, !hidden);
	}
}
