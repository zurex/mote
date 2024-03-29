import { Event } from 'mote/base/common/event';
import { IDimension } from 'mote/editor/common/core/dimension';
import { IDisposable } from 'mote/base/common/lifecycle';
import { ConfigurationChangedEvent, IComputedEditorOptions } from 'mote/editor/common/config/editorOptions';

export interface IEditorConfiguration extends IDisposable {

	/**
	 * Computed editor options.
	 */
	readonly options: IComputedEditorOptions;

	/**
	 * The `options` have changed (quick event)
	 */
	onDidChangeFast: Event<ConfigurationChangedEvent>;

	/**
	 * Recompute options with new reference element dimensions.
	 */
	observeContainer(dimension?: IDimension): void;

	/**
	 * Set the current model line count.
	 */
	setModelLineCount(modelLineCount: number): void;
	/**
	 * Set the current view model line count.
	 */
	setViewLineCount(viewLineCount: number): void;
}
