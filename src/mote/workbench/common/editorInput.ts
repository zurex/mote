import { Emitter } from 'mote/base/common/event';
import { AbstractEditorInput, EditorInputCapabilities, IEditorDescriptor, IEditorPane, isEditorInput } from 'mote/workbench/common/editor';
import { firstOrDefault } from 'mote/base/common/arrays';

/**
 * Editor inputs are lightweight objects that can be passed to the workbench API to open inside the editor part.
 * Each editor input is mapped to an editor that is capable of opening it through the Platform facade.
 */
export abstract class EditorInput extends AbstractEditorInput {

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
