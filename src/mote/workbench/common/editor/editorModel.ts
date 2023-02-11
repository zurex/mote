import { Emitter } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IEditorModel } from 'mote/platform/editor/common/editor';

export class EditorModel extends Disposable implements IEditorModel {

	private readonly _onWillDispose = this._register(new Emitter<void>());
	readonly onWillDispose = this._onWillDispose.event;

	private disposed = false;
	private resolved = false;

	/**
	 * Causes this model to resolve returning a promise when loading is completed.
	 */
	async resolve(): Promise<void> {
		this.resolved = true;
	}

	/**
	 * Returns whether this model was loaded or not.
	 */
	isResolved(): boolean {
		return this.resolved;
	}

	/**
	 * Find out if this model has been disposed.
	 */
	isDisposed(): boolean {
		return this.disposed;
	}

	/**
	 * Subclasses should implement to free resources that have been claimed through loading.
	 */
	override dispose(): void {
		this.disposed = true;
		this._onWillDispose.fire();

		super.dispose();
	}
}
