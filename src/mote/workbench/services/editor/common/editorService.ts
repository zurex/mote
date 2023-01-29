import { Event } from 'mote/base/common/event';
import { IEditor } from 'mote/editor/common/editorCommon';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { GroupIdentifier, IEditorIdentifier, IEditorPane, IVisibleEditorPane } from 'mote/workbench/common/editor';
import { IGroupModelChangeEvent } from 'mote/workbench/common/editorGroupModel';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { ICloseEditorOptions, IEditorGroup, isEditorGroup } from 'mote/workbench/services/editor/common/editorGroupsService';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IEditorService = createDecorator<IEditorService>('editorService');

/**
 * Open an editor in the currently active group.
 */
export const ACTIVE_GROUP = -1;
export type ACTIVE_GROUP_TYPE = typeof ACTIVE_GROUP;

/**
 * Open an editor to the side of the active group.
 */
export const SIDE_GROUP = -2;
export type SIDE_GROUP_TYPE = typeof SIDE_GROUP;

export type PreferredGroup = IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE;

export function isPreferredGroup(obj: unknown): obj is PreferredGroup {
	const candidate = obj as PreferredGroup | undefined;

	return typeof obj === 'number' || isEditorGroup(candidate);
}

export interface IEditorsChangeEvent {
	/**
	 * The group which had the editor change
	 */
	groupId: GroupIdentifier;
	/*
	 * The event fired from the model
	 */
	event: IGroupModelChangeEvent;
}

export interface IEditorService {

	readonly _serviceBrand: undefined;

	/**
	 * Emitted when the currently active editor changes.
	 *
	 * @see {@link IEditorService.activeEditorPane}
	 */
	readonly onDidActiveEditorChange: Event<void>;

	/**
	 * The currently active editor pane or `undefined` if none. The editor pane is
	 * the workbench container for editors of any kind.
	 *
	 * @see {@link IEditorService.activeEditor} for access to the active editor input
	 */
	readonly activeEditorPane: IVisibleEditorPane | undefined;

	/**
	 * The currently active editor or `undefined` if none. An editor is active when it is
	 * located in the currently active editor group. It will be `undefined` if the active
	 * editor group has no editors open.
	 */
	readonly activeEditor: EditorInput | undefined;

	/**
	 * The currently active text editor control or `undefined` if there is currently no active
	 * editor or the active editor widget is neither a text nor a diff editor.
	 *
	 * @see {@link IEditorService.activeEditor}
	 */
	readonly activeEditorControl: IEditor | undefined;

	openEditor(editor: EditorInput): Promise<IEditorPane | undefined>;

	openEditorWithResource(editor: IResourceEditorInput): Promise<IEditorPane | undefined>;

	/**
	 * Close an editor in a specific editor group.
	 */
	closeActiveEditor(options?: ICloseEditorOptions): Promise<void>;

	/**
	 * Close an editor in a specific editor group.
	 */
	closeEditor(editor: IEditorIdentifier, options?: ICloseEditorOptions): Promise<void>;

}
