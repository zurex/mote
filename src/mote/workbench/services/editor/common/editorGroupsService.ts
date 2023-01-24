import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { EditorInputWithOptions, GroupIdentifier, IActiveEditorChangeEvent, IEditorPane, IVisibleEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { Event } from 'mote/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IGroupModelChangeEvent } from 'mote/workbench/common/editorGroupModel';

export const IEditorGroupsService = createDecorator<IEditorGroupsService>('editorGroupsService');

export const enum GroupDirection {
	UP,
	DOWN,
	LEFT,
	RIGHT
}

export const enum GroupOrientation {
	HORIZONTAL,
	VERTICAL
}

export const enum GroupLocation {
	FIRST,
	LAST,
	NEXT,
	PREVIOUS
}

export interface IFindGroupScope {
	direction?: GroupDirection;
	location?: GroupLocation;
}

export const enum GroupsArrangement {

	/**
	 * Make the current active group consume the maximum
	 * amount of space possible.
	 */
	MAXIMIZE,

	/**
	 * Size all groups evenly.
	 */
	EVEN,

	/**
	 * Will behave like MINIMIZE_OTHERS if the active
	 * group is not already maximized and EVEN otherwise
	 */
	TOGGLE
}

export interface IAddGroupOptions {
	activate?: boolean;
}

export const enum MergeGroupMode {
	COPY_EDITORS,
	MOVE_EDITORS
}

export interface IMergeGroupOptions {
	mode?: MergeGroupMode;
	index?: number;
}
export interface ICloseEditorOptions {
	preserveFocus?: boolean;
}


export interface IEditorGroup {

	/**
	 * A unique identifier of this group that remains identical even if the
	 * group is moved to different locations.
	 */
	readonly id: GroupIdentifier;

	/**
	 * The number of opened editors in this group.
	 */
	readonly count: number;

	/**
	 * All opened editors in the group in sequential order of their appearance.
	 */
	readonly editors: readonly EditorInput[];

	/**
	 * The active editor pane is the currently visible editor pane of the group.
	 */
	readonly activeEditorPane: IVisibleEditorPane | undefined;

	/**
	 * The active editor is the currently visible editor of the group
	 * within the current active editor pane.
	 */
	readonly activeEditor: EditorInput | null;

	/**
	 * Whether the group has editors or not.
	 */
	readonly isEmpty: boolean;

	/**
	 * Whether this editor group is locked or not. Locked editor groups
	 * will only be considered for editors to open in when the group is
	 * explicitly provided for the editor.
	 *
	 * Note: editor group locking only applies when more than one group
	 * is opened.
	 */
	readonly isLocked: boolean;

	/**
	 * An event which fires whenever the underlying group model changes.
	 */
	readonly onDidModelChange: Event<IGroupModelChangeEvent>;

	/**
	 * An event that is fired when the active editor in the group changed.
	 */
	readonly onDidActiveEditorChange: Event<IActiveEditorChangeEvent>;

	/**
	 * An event that is fired when the group gets disposed.
	 */
	readonly onWillDispose: Event<void>;

	/**
	 * Move keyboard focus into the group.
	 */
	focus(): void;

	/**
	 * Find out if the provided editor is active in the group.
	 */
	isActive(editor: EditorInput): boolean;

	/**
	 * Find out if the provided editor or index of editor is sticky in the group.
	 */
	isSticky(editorOrIndex: EditorInput | number): boolean;

	/**
	 * Open an editor in this group.
	 *
	 * @returns a promise that resolves around an IEditor instance unless
	 * the call failed, or the editor was not opened as active editor.
	 */
	openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;

	/**
	 * Move an editor from this group either within this group or to another group.
	 */
	moveEditor(editor: EditorInput, target: IEditorGroup, options?: IEditorOptions): void;

	/**
	 * Move editors from this group either within this group or to another group.
	 */
	moveEditors(editors: EditorInputWithOptions[], target: IEditorGroup): void;

	/**
	 * Copy an editor from this group to another group.
	 *
	 * Note: It is currently not supported to show the same editor more than once in the same group.
	 */
	copyEditor(editor: EditorInput, target: IEditorGroup, options?: IEditorOptions): void;

	/**
	 * Copy editors from this group to another group.
	 *
	 * Note: It is currently not supported to show the same editor more than once in the same group.
	 */
	copyEditors(editors: EditorInputWithOptions[], target: IEditorGroup): void;

	/**
	 * Close an editor from the group. This may trigger a confirmation dialog if
	 * the editor is dirty and thus returns a promise as value.
	 *
	 * @param editor the editor to close, or the currently active editor
	 * if unspecified.
	 *
	 * @returns a promise when the editor is closed or not. If `true`, the editor
	 * is closed and if `false` there was a veto closing the editor, e.g. when it
	 * is dirty.
	 */
	closeEditor(editor?: EditorInput, options?: ICloseEditorOptions): Promise<boolean>;


}

export const enum GroupsOrder {

	/**
	 * Groups sorted by creation order (oldest one first)
	 */
	CREATION_TIME,

	/**
	 * Groups sorted by most recent activity (most recent active first)
	 */
	MOST_RECENTLY_ACTIVE,

	/**
	 * Groups sorted by grid widget order
	 */
	GRID_APPEARANCE
}

/**
 * The service used to manage the editor groups
 * Why we need support group:
 * 1) Need support split screen in mobile devices
 * 2) Compare with other context
 */
export interface IEditorGroupsService {

	readonly _serviceBrand: undefined;

	/**
	 * An event for when a new group was added.
	 */
	readonly onDidAddGroup: Event<IEditorGroup>;

	/**
	 * An event for when a group was removed.
	 */
	readonly onDidRemoveGroup: Event<IEditorGroup>;

	/**
	 * An active group is the default location for new editors to open.
	 */
	readonly activeGroup: IEditorGroup;

	/**
	 * Add a new group to the editor area. A new group is added by splitting a provided one in
	 * one of the four directions.
	 *
	 * @param location the group from which to split to add a new group
	 * @param direction the direction of where to split to
	 * @param options configure the newly group with options
	 */
	addGroup(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, options?: IAddGroupOptions): IEditorGroup;

	/**
	 * Remove a group from the editor area.
	 */
	removeGroup(group: IEditorGroup | GroupIdentifier): void;

	/**
	 * Allows to convert a group identifier to a group.
	 */
	getGroup(identifier: GroupIdentifier): IEditorGroup | undefined;

	/**
	 * Get all groups that are currently visible in the editor area.
	 *
	 * @param order the order of the editors to use
	 */
	getGroups(order: GroupsOrder): readonly IEditorGroup[];

	/**
	 * Find a groupd in a specific scope:
	 * * `GroupLocation.FIRST`: the first group
	 * * `GroupLocation.LAST`: the last group
	 * * `GroupLocation.NEXT`: the next group from either the active one or `source`
	 * * `GroupLocation.PREVIOUS`: the previous group from either the active one or `source`
	 * * `GroupDirection.UP`: the next group above the active one or `source`
	 * * `GroupDirection.DOWN`: the next group below the active one or `source`
	 * * `GroupDirection.LEFT`: the next group to the left of the active one or `source`
	 * * `GroupDirection.RIGHT`: the next group to the right of the active one or `source`
	 *
	 * @param scope the scope of the group to search in
	 * @param source optional source to search from
	 * @param wrap optionally wrap around if reaching the edge of groups
	 */
	findGroup(scope: IFindGroupScope, source?: IEditorGroup | GroupIdentifier, wrap?: boolean): IEditorGroup | undefined;

}

export function isEditorGroup(obj: unknown): obj is IEditorGroup {
	const group = obj as IEditorGroup | undefined;

	return !!group && typeof group.id === 'number' && Array.isArray(group.editors);
}

export function preferredSideBySideGroupDirection(configurationService: IConfigurationService): GroupDirection.DOWN | GroupDirection.RIGHT {
	const openSideBySideDirection = configurationService.getValue('workbench.editor.openSideBySideDirection');

	if (openSideBySideDirection === 'down') {
		return GroupDirection.DOWN;
	}

	return GroupDirection.RIGHT;
}
