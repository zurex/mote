import { Emitter } from 'mote/base/common/event';
import { AbstractEditorInput, EditorInputCapabilities, GroupIdentifier, IEditorDescriptor, IEditorPane, IMoveResult, IRevertOptions, ISaveOptions, isEditorInput, Verbosity } from 'mote/workbench/common/editor';
import { firstOrDefault } from 'mote/base/common/arrays';
import { IEditorModel, IEditorOptions } from 'mote/platform/editor/common/editor';
import { URI } from 'mote/base/common/uri';

/**
 * Editor inputs are lightweight objects that can be passed to the workbench API to open inside the editor part.
 * Each editor input is mapped to an editor that is capable of opening it through the Platform facade.
 */
export abstract class EditorInput extends AbstractEditorInput {

	protected readonly _onDidChangeLabel = this._register(new Emitter<void>());
	protected readonly _onDidChangeCapabilities = this._register(new Emitter<void>());

	/**
	 * Triggered when this input is about to be disposed.
	 */
	private readonly _onWillDispose = this._register(new Emitter<void>());
	readonly onWillDispose = this._onWillDispose.event;

	private disposed: boolean = false;

	hideHeader?: boolean;

	/**
	 * Unique type identifier for this input. Every editor input of the
	 * same class should share the same type identifier. The type identifier
	 * is used for example for serialising/deserialising editor inputs
	 * via the serialisers of the `EditorInputFactoryRegistry`.
	 */
	abstract get typeId(): string;

	/**
	 * Identifies the type of editor this input represents
	 * This ID is registered with the {@link EditorResolverService} to allow
	 * for resolving an untyped input to a typed one
	 */
	get editorId(): string | undefined {
		return undefined;
	}

	/**
	 * The capabilities of the input.
	 */
	get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly;
	}

	/**
	 * Returns if this input is dirty or not.
	 */
	isDirty(): boolean {
		return false;
	}

	/**
	 * If a editor was registered onto multiple editor panes, this method
	 * will be asked to return the preferred one to use.
	 *
	 * @param editorPanes a list of editor pane descriptors that are candidates
	 * for the editor to open in.
	 */
	prefersEditorPane<T extends IEditorDescriptor<IEditorPane>>(editorPanes: T[]): T | undefined {
		return firstOrDefault(editorPanes);
	}

	/**
	 * Figure out if the input has the provided capability.
	 */
	hasCapability(capability: EditorInputCapabilities): boolean {
		if (capability === EditorInputCapabilities.None) {
			return this.capabilities === EditorInputCapabilities.None;
		}

		return (this.capabilities & capability) !== 0;
	}

	/**
	 * Returns the display name of this input.
	 */
	getName(): string {
		return `Editor ${this.typeId}`;
	}

	/**
	 * Returns the display description of this input.
	 */
	getDescription(verbosity?: Verbosity): string | undefined {
		return undefined;
	}

	/**
	 * Returns the display title of this input.
	 */
	getTitle(verbosity?: Verbosity): string {
		return this.getName();
	}

	/**
	 * Returns the extra classes to apply to the label of this input.
	 */
	getLabelExtraClasses(): string[] {
		return [];
	}

	/**
	 * Returns the aria label to be read out by a screen reader.
	 */
	getAriaLabel(): string {
		return this.getTitle(Verbosity.SHORT);
	}

	/**
	 * Returns a descriptor suitable for telemetry events.
	 *
	 * Subclasses should extend if they can contribute.
	 */
	getTelemetryDescriptor(): { [key: string]: unknown } {
		/* __GDPR__FRAGMENT__
			"EditorTelemetryDescriptor" : {
				"typeId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		return { typeId: this.typeId };
	}

	/**
	 * Returns if this input is currently being saved or soon to be
	 * saved. Based on this assumption the editor may for example
	 * decide to not signal the dirty state to the user assuming that
	 * the save is scheduled to happen anyway.
	 */
	isSaving(): boolean {
		return false;
	}

	/**
	 * Returns a type of `IEditorModel` that represents the resolved input.
	 * Subclasses should override to provide a meaningful model or return
	 * `null` if the editor does not require a model.
	 *
	 * The `options` parameter are passed down from the editor when the
	 * input is resolved as part of it.
	 */
	async resolve(options?: IEditorOptions): Promise<IEditorModel | null> {
		return null;
	}

	/**
	 * Saves the editor. The provided groupId helps implementors
	 * to e.g. preserve view state of the editor and re-open it
	 * in the correct group after saving.
	 *
	 * @returns the resulting editor input (typically the same) of
	 * this operation or `undefined` to indicate that the operation
	 * failed or was canceled.
	 */
	async save(group: GroupIdentifier, options?: ISaveOptions): Promise<EditorInput | undefined> {
		return this;
	}

	/**
	 * Reverts this input from the provided group.
	 */
	async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> { }

	/**
	 * Called to determine how to handle a resource that is renamed that matches
	 * the editors resource (or is a child of).
	 *
	 * Implementors are free to not implement this method to signal no intent
	 * to participate. If an editor is returned though, it will replace the
	 * current one with that editor and optional options.
	 */
	async rename(group: GroupIdentifier, target: URI): Promise<IMoveResult | undefined> {
		return undefined;
	}

	/**
	 * Returns a copy of the current editor input. Used when we can't just reuse the input
	 */
	copy(): EditorInput {
		return this;
	}

	/**
	 * Returns if the other object matches this input.
	 */
	matches(otherInput: EditorInput): boolean {

		// Typed inputs: via  === check
		if (isEditorInput(otherInput)) {
			return this === otherInput;
		}

		return false;
	}

	/**
	 * Returns if this editor is disposed.
	 */
	isDisposed(): boolean {
		return this.disposed;
	}

	override dispose(): void {
		if (!this.disposed) {
			this.disposed = true;
			this._onWillDispose.fire();
		}

		super.dispose();
	}
}
