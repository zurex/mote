/* eslint-disable code-no-unexternalized-strings */
import { IThemeService } from "mote/platform/theme/common/themeService";
import { Dimension } from 'mote/base/browser/dom';
import { URI } from 'mote/base/common/uri';
import { BrandedService, IConstructorSignature, IInstantiationService } from "mote/platform/instantiation/common/instantiation";
import { ILogService } from "mote/platform/log/common/log";
import { Registry } from 'mote/platform/registry/common/platform';
import { IPaneComposite } from "mote/workbench/common/panecomposite";
import { Composite, CompositeDescriptor, CompositeRegistry } from "./composite";
import { ViewPaneContainer } from "mote/workbench/browser/parts/views/viewPaneContainer";
import { IStorageService } from 'mote/platform/storage/common/storage';

export abstract class PaneComposite extends Composite implements IPaneComposite {

	private viewPaneContainer?: ViewPaneContainer;

	constructor(
		id: string,
		@ILogService protected logService: ILogService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(id, themeService, storageService);
	}

	override create(parent: HTMLElement): void {
		this.logService.debug("[PaneComposite] create:", parent);
		this.viewPaneContainer = this._register(this.createViewPaneContainer(parent));
		//this._register(this.viewPaneContainer.onTitleAreaUpdate(() => this.updateTitleArea()));
		this.viewPaneContainer.create(parent);
	}

	override renderHeader(parent: HTMLElement): boolean {
		return this.viewPaneContainer?.renderHeader(parent) ?? false;
	}

	override getTitle(): string {
		return this.viewPaneContainer?.getTitle() ?? '';
	}

	layout(dimension: Dimension): void {
		this.viewPaneContainer?.layout(dimension);
	}

	getOptimalWidth(): number | undefined {
		throw new Error('Method not implemented.');
	}
	override saveState(): void {

	}

	protected abstract createViewPaneContainer(parent: HTMLElement): ViewPaneContainer;
}

/**
 * A Pane Composite descriptor is a leightweight descriptor of a Pane Composite in the workbench.
 */
export class PaneCompositeDescriptor extends CompositeDescriptor<PaneComposite> {

	static create<Services extends BrandedService[]>(
		ctor: { new(...services: Services): PaneComposite },
		id: string,
		name: string,
		cssClass?: string,
		order?: number,
		requestedIndex?: number,
		iconUrl?: URI
	): PaneCompositeDescriptor {

		return new PaneCompositeDescriptor(ctor as IConstructorSignature<PaneComposite>, id, name, cssClass, order, requestedIndex, iconUrl);
	}

	private constructor(
		ctor: IConstructorSignature<PaneComposite>,
		id: string,
		name: string,
		cssClass?: string,
		order?: number,
		requestedIndex?: number,
		readonly iconUrl?: URI
	) {
		super(ctor, id, name, cssClass, order, requestedIndex);
	}
}

export const PaneCompositeExtensions = {
	Viewlets: 'workbench.contributions.viewlets',
	Panels: 'workbench.contributions.panels',
	Auxiliary: 'workbench.contributions.auxiliary',
};


export class PaneCompositeRegistry extends CompositeRegistry<PaneComposite> {

	/**
	 * Registers a viewlet to the platform.
	 */
	registerPaneComposite(descriptor: PaneCompositeDescriptor): void {
		super.registerComposite(descriptor);
	}

	/**
	 * Deregisters a viewlet to the platform.
	 */
	deregisterPaneComposite(id: string): void {
		super.deregisterComposite(id);
	}

	/**
	 * Returns the viewlet descriptor for the given id or null if none.
	 */
	getPaneComposite(id: string): PaneCompositeDescriptor {
		return this.getComposite(id) as PaneCompositeDescriptor;
	}

	/**
	 * Returns an array of registered viewlets known to the platform.
	 */
	getPaneComposites(): PaneCompositeDescriptor[] {
		return this.getComposites() as PaneCompositeDescriptor[];
	}
}

Registry.add(PaneCompositeExtensions.Viewlets, new PaneCompositeRegistry());
