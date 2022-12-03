import { GroupIdentifier } from 'mote/workbench/common/editor';
import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

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

export interface IAddGroupOptions {
	activate?: boolean;
}

export interface IEditorGroup {
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
}
