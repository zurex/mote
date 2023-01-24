import { IThemeService } from 'mote/platform/theme/common/themeService';
import { Component } from 'mote/workbench/common/component';
import { ICompositeControl } from 'mote/workbench/common/composite';
import { Dimension } from 'mote/base/browser/dom';
import { Emitter } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IConstructorSignature, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';

/**
 * Composites are layed out in the sidebar and panel part of the workbench. At a time only one composite
 * can be open in the sidebar, and only one composite can be open in the panel.
 *
 * Each composite has a minimized representation that is good enough to provide some
 * information about the state of the composite data.
 *
 * The workbench will keep a composite alive after it has been created and show/hide it based on
 * user interaction. The lifecycle of a composite goes in the order create(), setVisible(true|false),
 * layout(), focus(), dispose(). During use of the workbench, a composite will often receive a setVisible,
 * layout and focus call, but only one create and dispose call.
 */
export abstract class Composite extends Component {

	private visible: boolean;
	private parent: HTMLElement | undefined;

	constructor(
		id: string,
		themeService: IThemeService,
		storageService: IStorageService,
	) {
		super(id, themeService, storageService);

		this.visible = false;
	}

	/**
	 * Note: Clients should not call this method, the workbench calls this
	 * method. Calling it otherwise may result in unexpected behavior.
	 *
	 * Called to create this composite on the provided parent. This method is only
	 * called once during the lifetime of the workbench.
	 * Note that DOM-dependent calculations should be performed from the setVisible()
	 * call. Only then the composite will be part of the DOM.
	 */
	create(parent: HTMLElement): void {
		this.parent = parent;
	}


	renderHeader(parent: HTMLElement): boolean {
		return false;
	}

	getTitle(): string | undefined {
		return undefined;
	}

	/**
	 * Returns the container this composite is being build in.
	 */
	getContainer(): HTMLElement | undefined {
		return this.parent;
	}

	/**
	 * Note: Clients should not call this method, the workbench calls this
	 * method. Calling it otherwise may result in unexpected behavior.
	 *
	 * Called to indicate that the composite has become visible or hidden. This method
	 * is called more than once during workbench lifecycle depending on the user interaction.
	 * The composite will be on-DOM if visible is set to true and off-DOM otherwise.
	 *
	 * Typically this operation should be fast though because setVisible might be called many times during a session.
	 * If there is a long running opertaion it is fine to have it running in the background asyncly and return before.
	 */
	setVisible(visible: boolean): void {
		if (this.visible !== !!visible) {
			this.visible = visible;
		}
	}

	/**
	 * Called when this composite should receive keyboard focus.
	 */
	focus(): void {
		// Subclasses can implement
	}

	/**
	 * Layout the contents of this composite using the provided dimensions.
	 */
	abstract layout(dimension: Dimension): void;

	/**
	 * Returns the underlying composite control or `undefined` if it is not accessible.
	 */
	getControl(): ICompositeControl | undefined {
		return undefined;
	}
}

/**
 * A composite descriptor is a leightweight descriptor of a composite in the workbench.
 */
export abstract class CompositeDescriptor<T extends Composite> {

	constructor(
		private readonly ctor: IConstructorSignature<T>,
		readonly id: string,
		readonly name: string,
		readonly cssClass?: string,
		readonly order?: number,
		readonly requestedIndex?: number,
	) { }

	instantiate(instantiationService: IInstantiationService): T {
		return instantiationService.createInstance(this.ctor);
	}
}

export abstract class CompositeRegistry<T extends Composite> extends Disposable {

	private readonly _onDidRegister = this._register(new Emitter<CompositeDescriptor<T>>());
	readonly onDidRegister = this._onDidRegister.event;

	private readonly _onDidDeregister = this._register(new Emitter<CompositeDescriptor<T>>());
	readonly onDidDeregister = this._onDidDeregister.event;

	private readonly composites: CompositeDescriptor<T>[] = [];

	protected registerComposite(descriptor: CompositeDescriptor<T>): void {
		if (this.compositeById(descriptor.id)) {
			return;
		}

		this.composites.push(descriptor);
		this._onDidRegister.fire(descriptor);
	}

	protected deregisterComposite(id: string): void {
		const descriptor = this.compositeById(id);
		if (!descriptor) {
			return;
		}

		this.composites.splice(this.composites.indexOf(descriptor), 1);
		this._onDidDeregister.fire(descriptor);
	}

	getComposite(id: string): CompositeDescriptor<T> | undefined {
		return this.compositeById(id);
	}

	protected getComposites(): CompositeDescriptor<T>[] {
		return this.composites.slice(0);
	}

	private compositeById(id: string): CompositeDescriptor<T> | undefined {
		return this.composites.find(composite => composite.id === id);
	}
}
