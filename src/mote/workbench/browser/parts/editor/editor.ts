import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { GroupDirection, GroupsArrangement, GroupsOrder, IAddGroupOptions, IEditorGroup, IMergeGroupOptions } from 'mote/workbench/services/editor/common/editorGroupsService';
import { Dimension } from 'mote/base/browser/dom';
import { ISerializableView } from 'mote/base/browser/ui/grid/grid';
import { EditorCloseContext, GroupIdentifier, IEditorPartOptions, IEditorPartOptionsChangeEvent, IWorkbenchEditorConfiguration, SideBySideEditor } from 'mote/workbench/common/editor';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { isObject } from 'mote/base/common/types';

export const DEFAULT_EDITOR_MIN_DIMENSIONS = new Dimension(220, 70);
export const DEFAULT_EDITOR_MAX_DIMENSIONS = new Dimension(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);

export const DEFAULT_EDITOR_PART_OPTIONS: IEditorPartOptions = {
	showTabs: true,
	highlightModifiedTabs: false,
	tabCloseButton: 'right',
	tabSizing: 'fit',
	pinnedTabSizing: 'normal',
	titleScrollbarSizing: 'default',
	focusRecentEditorAfterClose: true,
	showIcons: true,
	hasIcons: true, // 'vs-seti' is our default icon theme
	enablePreview: true,
	openPositioning: 'right',
	openSideBySideDirection: 'right',
	closeEmptyGroups: true,
	labelFormat: 'default',
	splitSizing: 'distribute',
	splitOnDragAndDrop: true
};

export interface IEditorPartCreationOptions {
	restorePreviousState: boolean;
}

export function getEditorPartOptions(configurationService: IConfigurationService, themeService: IThemeService): IEditorPartOptions {
	const options = {
		...DEFAULT_EDITOR_PART_OPTIONS,
		//hasIcons: themeService.getFileIconTheme().hasFileIcons
	};

	const config = configurationService.getValue<IWorkbenchEditorConfiguration>();
	if (config?.workbench?.editor) {

		// Assign all primitive configuration over
		Object.assign(options, config.workbench.editor);

		// Special handle array types and convert to Set
		if (isObject(config.workbench.editor.autoLockGroups)) {
			options.autoLockGroups = new Set();

			for (const [editorId, enablement] of Object.entries(config.workbench.editor.autoLockGroups)) {
				if (enablement === true) {
					options.autoLockGroups.add(editorId);
				}
			}
		} else {
			options.autoLockGroups = undefined;
		}
	}

	return options;
}

export interface IEditorGroupsAccessor {

	readonly groups: IEditorGroupView[];
	readonly activeGroup: IEditorGroupView;

	readonly partOptions: IEditorPartOptions;
	readonly onDidChangeEditorPartOptions: Event<IEditorPartOptionsChangeEvent>;

	readonly onDidVisibilityChange: Event<boolean>;

	getGroup(identifier: GroupIdentifier): IEditorGroupView | undefined;
	getGroups(order: GroupsOrder): IEditorGroupView[];

	activateGroup(identifier: IEditorGroupView | GroupIdentifier): IEditorGroupView;
	restoreGroup(identifier: IEditorGroupView | GroupIdentifier): IEditorGroupView;

	addGroup(location: IEditorGroupView | GroupIdentifier, direction: GroupDirection, options?: IAddGroupOptions): IEditorGroupView;
	mergeGroup(group: IEditorGroupView | GroupIdentifier, target: IEditorGroupView | GroupIdentifier, options?: IMergeGroupOptions): IEditorGroupView;

	moveGroup(group: IEditorGroupView | GroupIdentifier, location: IEditorGroupView | GroupIdentifier, direction: GroupDirection): IEditorGroupView;
	copyGroup(group: IEditorGroupView | GroupIdentifier, location: IEditorGroupView | GroupIdentifier, direction: GroupDirection): IEditorGroupView;

	removeGroup(group: IEditorGroupView | GroupIdentifier): void;

	arrangeGroups(arrangement: GroupsArrangement, target?: IEditorGroupView | GroupIdentifier): void;
}

export interface IEditorGroupView extends IDisposable, ISerializableView, IEditorGroup {

	readonly disposed: boolean;

	readonly onDidFocus: Event<void>;

	/**
	 * A promise that resolves when the group has been restored.
	 *
	 * For a group with active editor, the promise will resolve
	 * when the active editor has finished to resolve.
	 */
	readonly whenRestored: Promise<void>;

	setActive(isActive: boolean): void;

	notifyIndexChanged(newIndex: number): void;
}

export interface IInternalEditorTitleControlOptions {

	/**
	 * A hint to defer updating the title control for perf reasons.
	 * The caller must ensure to update the title control then.
	 */
	skipTitleUpdate?: boolean;
}

export interface IInternalEditorOpenOptions extends IInternalEditorTitleControlOptions {

	/**
	 * Whether to consider a side by side editor as matching
	 * when figuring out if the editor to open is already
	 * opened or not. By default, side by side editors will
	 * not be considered as matching, even if the editor is
	 * opened in one of the sides.
	 */
	supportSideBySide?: SideBySideEditor.ANY | SideBySideEditor.BOTH;
}


export interface IInternalEditorCloseOptions extends IInternalEditorTitleControlOptions {

	/**
	 * A hint that the editor is closed due to an error opening. This can be
	 * used to optimize how error toasts are appearing if any.
	 */
	fromError?: boolean;

	/**
	 * Additional context as to why an editor is closed.
	 */
	context?: EditorCloseContext;
}
