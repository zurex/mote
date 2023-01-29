import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { Composite } from 'mote/workbench/browser/composite';
import { DEFAULT_EDITOR_MAX_DIMENSIONS, DEFAULT_EDITOR_MIN_DIMENSIONS } from 'mote/workbench/browser/parts/editor/editor';
import { IEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IEditorGroup } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IStorageService } from 'mote/platform/storage/common/storage';

/**
 * The base class of editors in the workbench. Editors register themselves for specific editor inputs.
 * Editors are layed out in the editor part of the workbench in editor groups. Multiple editors can be
 * open at the same time. Each editor has a minimized representation that is good enough to provide some
 * information about the state of the editor data.
 *
 * The workbench will keep an editor alive after it has been created and show/hide it based on
 * user interaction. The lifecycle of a editor goes in the order:
 *
 * - `createEditor()`
 * - `setEditorVisible()`
 * - `layout()`
 * - `setInput()`
 * - `focus()`
 * - `dispose()`: when the editor group the editor is in closes
 *
 * During use of the workbench, a editor will often receive a `clearInput()`, `setEditorVisible()`, `layout()` and
 * `focus()` calls, but only one `create()` and `dispose()` call.
 *
 * This class is only intended to be subclassed and not instantiated.
 */
export abstract class EditorPane extends Composite implements IEditorPane {

	get minimumWidth() { return DEFAULT_EDITOR_MIN_DIMENSIONS.width; }
	get maximumWidth() { return DEFAULT_EDITOR_MAX_DIMENSIONS.width; }
	get minimumHeight() { return DEFAULT_EDITOR_MIN_DIMENSIONS.height; }
	get maximumHeight() { return DEFAULT_EDITOR_MAX_DIMENSIONS.height; }

	protected _input: EditorInput | undefined;
	get input(): EditorInput | undefined { return this._input; }

	protected _options: IEditorOptions | undefined;
	get options(): IEditorOptions | undefined { return this._options; }

	private _group: IEditorGroup | undefined;
	get group(): IEditorGroup | undefined { return this._group; }

	constructor(
		id: string,
		themeService: IThemeService,
		storageService: IStorageService,
	) {
		super(id, themeService, storageService);
	}

	override create(parent: HTMLElement): void {
		super.create(parent);

		// Create Editor
		this.createEditor(parent);
	}

	/**
	 * Called to create the editor in the parent HTMLElement. Subclasses implement
	 * this method to construct the editor widget.
	 */
	protected abstract createEditor(parent: HTMLElement): void;

	/**
	 * Note: Clients should not call this method, the workbench calls this
	 * method. Calling it otherwise may result in unexpected behavior.
	 *
	 * Sets the given input with the options to the editor. The input is guaranteed
	 * to be different from the previous input that was set using the `input.matches()`
	 * method.
	 *
	 * The provided context gives more information around how the editor was opened.
	 *
	 * The provided cancellation token should be used to test if the operation
	 * was cancelled.
	 */
	async setInput(input: EditorInput, options: IEditorOptions | undefined): Promise<void> {
		this._input = input;
		this._options = options;
	}

	/**
	 * Indicates that the editor control got visible or hidden in a specific group. A
	 * editor instance will only ever be visible in one editor group.
	 *
	 * @param visible the state of visibility of this editor
	 * @param group the editor group this editor is in.
	 */
	protected setEditorVisible(visible: boolean, group: IEditorGroup | undefined): void {
		this._group = group;
	}
}
