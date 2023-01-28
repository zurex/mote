import { IWorkbenchLayoutService, Parts } from 'mote/workbench/services/layout/browser/layoutService';
import { $, Dimension, isAncestor } from 'mote/base/browser/dom';
import { Emitter, Event, Relay } from 'mote/base/common/event';
import { Part } from 'mote/workbench/browser/part';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { EditorInputWithOptions, GroupIdentifier, GroupModelChangeKind, IEditorPartOptions, IEditorPartOptionsChangeEvent } from 'mote/workbench/common/editor';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { assertIsDefined } from 'mote/base/common/types';
import { ThemedStyles } from 'mote/base/common/themes';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EmptyHolder } from './emptyHolder';
import { CSSProperties } from 'mote/base/browser/jsx/style';
import { contrastBorder, editorBackground } from 'mote/platform/theme/common/themeColors';
import { GroupDirection, GroupLocation, GroupsArrangement, GroupsOrder, IAddGroupOptions, IEditorGroupsService, IFindGroupScope, IMergeGroupOptions, MergeGroupMode } from 'mote/workbench/services/editor/common/editorGroupsService';
import { getEditorPartOptions, IEditorGroupsAccessor, IEditorGroupView, IEditorPartCreationOptions } from 'mote/workbench/browser/parts/editor/editor';
import { coalesce, distinct } from 'mote/base/common/arrays';
import { Direction, Grid, ISerializedGrid, IView, SerializableGrid, Sizing } from 'mote/base/browser/ui/grid/grid';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { DisposableStore, dispose } from 'mote/base/common/lifecycle';
import { ISerializedEditorGroupModel, isSerializedEditorGroupModel } from 'mote/workbench/common/editorGroupModel';
import { EditorGroupView } from 'mote/workbench/browser/parts/editor/editorGroupView';
import { onUnexpectedError } from 'mote/base/common/errors';
import { Color } from 'mote/base/common/color';
import { EDITOR_GROUP_BORDER } from 'mote/workbench/common/theme';
import { IBoundarySashes } from 'mote/base/browser/ui/grid/gridview';
import { CenteredViewLayout } from 'mote/base/browser/ui/centered/centeredViewLayout';
import { DeferredPromise } from 'mote/base/common/async';

interface IEditorPartUIState {
	serializedGrid: ISerializedGrid;
	activeGroup: GroupIdentifier;
	mostRecentActiveGroups: GroupIdentifier[];
}

class GridWidgetView<T extends IView> implements IView {

	readonly element: HTMLElement = $('.grid-view-container');

	get minimumWidth(): number { return this.gridWidget ? this.gridWidget.minimumWidth : 0; }
	get maximumWidth(): number { return this.gridWidget ? this.gridWidget.maximumWidth : Number.POSITIVE_INFINITY; }
	get minimumHeight(): number { return this.gridWidget ? this.gridWidget.minimumHeight : 0; }
	get maximumHeight(): number { return this.gridWidget ? this.gridWidget.maximumHeight : Number.POSITIVE_INFINITY; }

	private _onDidChange = new Relay<{ width: number; height: number } | undefined>();
	readonly onDidChange = this._onDidChange.event;

	private _gridWidget: Grid<T> | undefined;

	get gridWidget(): Grid<T> | undefined {
		return this._gridWidget;
	}

	set gridWidget(grid: Grid<T> | undefined) {
		this.element.innerText = '';

		if (grid) {
			this.element.appendChild(grid.element);
			this._onDidChange.input = grid.onDidChange;
		} else {
			this._onDidChange.input = Event.None;
		}

		this._gridWidget = grid;
	}

	layout(width: number, height: number, top: number, left: number): void {
		this.gridWidget?.layout(width, height, top, left);
	}

	dispose(): void {
		this._onDidChange.dispose();
	}
}

export class EditorPart extends Part implements IEditorGroupsService, IEditorGroupsAccessor {

	declare readonly _serviceBrand: undefined;

	private static readonly EDITOR_PART_UI_STATE_STORAGE_KEY = 'editorpart.state';
	private static readonly EDITOR_PART_CENTERED_VIEW_STORAGE_KEY = 'editorpart.centeredview';

	//#region Events

	private readonly _onDidLayout = this._register(new Emitter<Dimension>());
	readonly onDidLayout = this._onDidLayout.event;

	private readonly _onDidAddGroup = this._register(new Emitter<IEditorGroupView>());
	readonly onDidAddGroup = this._onDidAddGroup.event;

	private readonly _onDidRemoveGroup = this._register(new Emitter<IEditorGroupView>());
	readonly onDidRemoveGroup = this._onDidRemoveGroup.event;

	private readonly _onDidMoveGroup = this._register(new Emitter<IEditorGroupView>());
	readonly onDidMoveGroup = this._onDidMoveGroup.event;

	private readonly _onDidChangeActiveGroup = this._register(new Emitter<IEditorGroupView>());
	readonly onDidChangeActiveGroup = this._onDidChangeActiveGroup.event;

	private readonly _onDidChangeEditorPartOptions = this._register(new Emitter<IEditorPartOptionsChangeEvent>());
	readonly onDidChangeEditorPartOptions = this._onDidChangeEditorPartOptions.event;

	private readonly _onDidActivateGroup = this._register(new Emitter<IEditorGroupView>());
	readonly onDidActivateGroup = this._onDidActivateGroup.event;

	private readonly _onDidChangeGroupIndex = this._register(new Emitter<IEditorGroupView>());
	readonly onDidChangeGroupIndex = this._onDidChangeGroupIndex.event;

	private readonly _onDidChangeGroupLocked = this._register(new Emitter<IEditorGroupView>());
	readonly onDidChangeGroupLocked = this._onDidChangeGroupLocked.event;

	//#endregion

	private readonly workspaceMemento = this.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
	private readonly profileMemento = this.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);

	private readonly groupViews = new Map<GroupIdentifier, IEditorGroupView>();
	private mostRecentActiveGroups: GroupIdentifier[] = [];

	private container: HTMLElement | undefined;

	private centeredLayoutWidget!: CenteredViewLayout;

	private gridWidget!: SerializableGrid<IEditorGroupView>;
	private readonly gridWidgetView = this._register(new GridWidgetView<IEditorGroupView>());

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
		@ILogService logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(Parts.EDITOR_PART, { hasTitle: false }, themeService, storageService, layoutService);
	}

	//#region IEditorGroupsService

	private _top = 0;
	private _left = 0;
	private _contentDimension!: Dimension;
	get contentDimension(): Dimension { return this._contentDimension; }

	private _activeGroup!: IEditorGroupView;
	get activeGroup(): IEditorGroupView {
		return this._activeGroup;
	}

	private _partOptions = getEditorPartOptions(this.configurationService, this.themeService);
	get partOptions(): IEditorPartOptions { return this._partOptions; }

	get groups(): IEditorGroupView[] {
		return Array.from(this.groupViews.values());
	}

	get count(): number {
		return this.groupViews.size;
	}

	private _isReady = false;
	get isReady(): boolean { return this._isReady; }

	private readonly whenReadyPromise = new DeferredPromise<void>();
	readonly whenReady = this.whenReadyPromise.p;

	private shouldRestoreFocus(target: Element | undefined): boolean {
		if (!target) {
			return false;
		}

		const activeElement = document.activeElement;

		if (activeElement === document.body) {
			return true; // always restore focus if nothing is focused currently
		}

		// otherwise check for the active element being an ancestor of the target
		return isAncestor(activeElement, target);
	}

	addGroup(location: number | IEditorGroupView, direction: GroupDirection, options?: IAddGroupOptions | undefined): IEditorGroupView {
		const locationView = this.assertGroupView(location);

		const group = this.doAddGroup(locationView, direction);

		if (options?.activate) {
			this.doSetGroupActive(group);
		}

		return group;
	}

	private doAddGroup(locationView: IEditorGroupView, direction: GroupDirection, groupToCopy?: IEditorGroupView): IEditorGroupView {
		const newGroupView = this.doCreateGroupView(groupToCopy);

		// Add to grid widget
		this.gridWidget.addView(
			newGroupView,
			this.getSplitSizingStyle(),
			locationView,
			this.toGridViewDirection(direction),
		);

		// Update container
		this.updateContainer();

		// Event
		this._onDidAddGroup.fire(newGroupView);

		// Notify group index change given a new group was added
		this.notifyGroupIndexChange();

		return newGroupView;
	}

	private doSetGroupActive(group: IEditorGroupView): void {
		if (this._activeGroup === group) {
			return; // return if this is already the active group
		}

		const previousActiveGroup = this._activeGroup;
		this._activeGroup = group;

		// Update list of most recently active groups
		this.doUpdateMostRecentActive(group, true);

		// Mark previous one as inactive
		previousActiveGroup?.setActive(false);

		// Mark group as new active
		group.setActive(true);

		// Maximize the group if it is currently minimized
		this.doRestoreGroup(group);

		// Event
		this._onDidChangeActiveGroup.fire(group);
	}

	private getSplitSizingStyle(): Sizing {
		return this._partOptions.splitSizing === 'split' ? Sizing.Split : Sizing.Distribute;
	}

	private doCreateGroupView(from?: IEditorGroupView | ISerializedEditorGroupModel | null): IEditorGroupView {

		// Create group view
		let groupView: IEditorGroupView;
		if (from instanceof EditorGroupView) {
			groupView = EditorGroupView.createCopy(from, this, this.count, this.instantiationService);
		} else if (isSerializedEditorGroupModel(from)) {
			groupView = EditorGroupView.createFromSerialized(from, this, this.count, this.instantiationService);
		} else {
			groupView = EditorGroupView.createNew(this, this.count, this.instantiationService);
		}

		// Keep in map
		this.groupViews.set(groupView.id, groupView);

		// Track focus
		const groupDisposables = new DisposableStore();
		groupDisposables.add(groupView.onDidFocus(() => {
			this.doSetGroupActive(groupView);
		}));

		// Track group changes
		groupDisposables.add(groupView.onDidModelChange(e => {
			switch (e.kind) {
				case GroupModelChangeKind.GROUP_LOCKED:
					this._onDidChangeGroupLocked.fire(groupView);
					break;
				case GroupModelChangeKind.GROUP_INDEX:
					this._onDidChangeGroupIndex.fire(groupView);
					break;
			}
		}));

		// Track active editor change after it occurred
		groupDisposables.add(groupView.onDidActiveEditorChange(() => {
			this.updateContainer();
		}));

		// Track dispose
		Event.once(groupView.onWillDispose)(() => {
			dispose(groupDisposables);
			this.groupViews.delete(groupView.id);
			this.doUpdateMostRecentActive(groupView);
		});

		return groupView;
	}

	removeGroup(group: IEditorGroupView | GroupIdentifier): void {
		const groupView = this.assertGroupView(group);
		if (this.count === 1) {
			return; // Cannot remove the last root group
		}

		// Remove empty group
		if (groupView.isEmpty) {
			return this.doRemoveEmptyGroup(groupView);
		}

		// Remove group with editors
		this.doRemoveGroupWithEditors(groupView);
	}

	private doRemoveGroupWithEditors(groupView: IEditorGroupView): void {
		const mostRecentlyActiveGroups = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);

		let lastActiveGroup: IEditorGroupView;
		if (this._activeGroup === groupView) {
			lastActiveGroup = mostRecentlyActiveGroups[1];
		} else {
			lastActiveGroup = mostRecentlyActiveGroups[0];
		}

		// Removing a group with editors should merge these editors into the
		// last active group and then remove this group.
		this.mergeGroup(groupView, lastActiveGroup);
	}

	private doRemoveEmptyGroup(groupView: IEditorGroupView): void {
		const restoreFocus = this.shouldRestoreFocus(this.container);

		// Activate next group if the removed one was active
		if (this._activeGroup === groupView) {
			const mostRecentlyActiveGroups = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
			const nextActiveGroup = mostRecentlyActiveGroups[1]; // [0] will be the current group we are about to dispose
			this.activateGroup(nextActiveGroup);
		}

		// Remove from grid widget & dispose
		this.gridWidget.removeView(groupView, this.getSplitSizingStyle());
		groupView.dispose();

		// Restore focus if we had it previously (we run this after gridWidget.removeView() is called
		// because removing a view can mean to reparent it and thus focus would be removed otherwise)
		if (restoreFocus) {
			this._activeGroup.focus();
		}

		// Notify group index change given a group was removed
		this.notifyGroupIndexChange();

		// Update container
		this.updateContainer();

		// Update locked state: clear when we are at just 1 group
		if (this.count === 1) {
			//firstOrDefault(this.groups)?.lock(false);
		}

		// Event
		this._onDidRemoveGroup.fire(groupView);
	}

	getGroups(order = GroupsOrder.CREATION_TIME): IEditorGroupView[] {
		switch (order) {
			case GroupsOrder.CREATION_TIME:
				return this.groups;

			case GroupsOrder.MOST_RECENTLY_ACTIVE: {
				const mostRecentActive = coalesce(this.mostRecentActiveGroups.map(groupId => this.getGroup(groupId)));

				// there can be groups that got never active, even though they exist. in this case
				// make sure to just append them at the end so that all groups are returned properly
				return distinct([...mostRecentActive, ...this.groups]);
			}
			case GroupsOrder.GRID_APPEARANCE: {
				const views: IEditorGroupView[] = [];
				/*
				if (this.gridWidget) {
					this.fillGridNodes(views, this.gridWidget.getViews());
				}
				*/

				return views;
			}
		}
	}

	getGroup(identifier: GroupIdentifier): IEditorGroupView | undefined {
		return this.groupViews.get(identifier);
	}

	findGroup(scope: IFindGroupScope, source: IEditorGroupView | GroupIdentifier = this.activeGroup, wrap?: boolean): IEditorGroupView | undefined {

		// by direction
		if (typeof scope.direction === 'number') {
			return this.doFindGroupByDirection(scope.direction, source, wrap);
		}

		// by location
		if (typeof scope.location === 'number') {
			return this.doFindGroupByLocation(scope.location, source, wrap);
		}

		throw new Error('invalid arguments');
	}

	private doFindGroupByDirection(direction: GroupDirection, source: IEditorGroupView | GroupIdentifier, wrap?: boolean): IEditorGroupView | undefined {
		const sourceGroupView = this.assertGroupView(source);

		// Find neighbours and sort by our MRU list
		const neighbours = this.gridWidget.getNeighborViews(sourceGroupView, this.toGridViewDirection(direction), wrap);
		neighbours.sort(((n1, n2) => this.mostRecentActiveGroups.indexOf(n1.id) - this.mostRecentActiveGroups.indexOf(n2.id)));

		return neighbours[0];
	}

	private doFindGroupByLocation(location: GroupLocation, source: IEditorGroupView | GroupIdentifier, wrap?: boolean): IEditorGroupView | undefined {
		const sourceGroupView = this.assertGroupView(source);
		const groups = this.getGroups(GroupsOrder.GRID_APPEARANCE);
		const index = groups.indexOf(sourceGroupView);

		switch (location) {
			case GroupLocation.FIRST:
				return groups[0];
			case GroupLocation.LAST:
				return groups[groups.length - 1];
			case GroupLocation.NEXT: {
				let nextGroup: IEditorGroupView | undefined = groups[index + 1];
				if (!nextGroup && wrap) {
					nextGroup = this.doFindGroupByLocation(GroupLocation.FIRST, source);
				}

				return nextGroup;
			}
			case GroupLocation.PREVIOUS: {
				let previousGroup: IEditorGroupView | undefined = groups[index - 1];
				if (!previousGroup && wrap) {
					previousGroup = this.doFindGroupByLocation(GroupLocation.LAST, source);
				}

				return previousGroup;
			}
		}
	}

	activateGroup(group: IEditorGroupView | GroupIdentifier): IEditorGroupView {
		const groupView = this.assertGroupView(group);
		this.doSetGroupActive(groupView);

		this._onDidActivateGroup.fire(groupView);
		return groupView;
	}

	restoreGroup(group: IEditorGroupView | GroupIdentifier): IEditorGroupView {
		const groupView = this.assertGroupView(group);
		this.doRestoreGroup(groupView);

		return groupView;
	}

	private doRestoreGroup(group: IEditorGroupView): void {
		if (this.gridWidget) {
			const viewSize = this.gridWidget.getViewSize(group);
			if (viewSize.width === group.minimumWidth || viewSize.height === group.minimumHeight) {
				this.arrangeGroups(GroupsArrangement.MAXIMIZE, group);
			}
		}
	}

	arrangeGroups(arrangement: GroupsArrangement, target = this.activeGroup): void {
		if (this.count < 2) {
			return; // require at least 2 groups to show
		}

		if (!this.gridWidget) {
			return; // we have not been created yet
		}

		switch (arrangement) {
			case GroupsArrangement.EVEN:
				this.gridWidget.distributeViewSizes();
				break;
			case GroupsArrangement.MAXIMIZE:
				this.gridWidget.maximizeViewSize(target);
				break;
			case GroupsArrangement.TOGGLE:
				if (this.isGroupMaximized(target)) {
					this.arrangeGroups(GroupsArrangement.EVEN);
				} else {
					this.arrangeGroups(GroupsArrangement.MAXIMIZE);
				}

				break;
		}
	}

	isGroupMaximized(targetGroup: IEditorGroupView): boolean {
		return this.gridWidget.isViewSizeMaximized(targetGroup);
	}


	private doUpdateMostRecentActive(group: IEditorGroupView, makeMostRecentlyActive?: boolean): void {
		const index = this.mostRecentActiveGroups.indexOf(group.id);

		// Remove from MRU list
		if (index !== -1) {
			this.mostRecentActiveGroups.splice(index, 1);
		}

		// Add to front as needed
		if (makeMostRecentlyActive) {
			this.mostRecentActiveGroups.unshift(group.id);
		}
	}

	moveGroup(group: IEditorGroupView | GroupIdentifier, location: IEditorGroupView | GroupIdentifier, direction: GroupDirection): IEditorGroupView {
		const sourceView = this.assertGroupView(group);
		const targetView = this.assertGroupView(location);

		if (sourceView.id === targetView.id) {
			throw new Error('Cannot move group into its own');
		}

		const restoreFocus = this.shouldRestoreFocus(sourceView.element);

		// Move through grid widget API
		this.gridWidget.moveView(sourceView, this.getSplitSizingStyle(), targetView, this.toGridViewDirection(direction));

		// Restore focus if we had it previously (we run this after gridWidget.removeView() is called
		// because removing a view can mean to reparent it and thus focus would be removed otherwise)
		if (restoreFocus) {
			sourceView.focus();
		}

		// Event
		this._onDidMoveGroup.fire(sourceView);

		// Notify group index change given a group was moved
		this.notifyGroupIndexChange();

		return sourceView;
	}

	copyGroup(group: IEditorGroupView | GroupIdentifier, location: IEditorGroupView | GroupIdentifier, direction: GroupDirection): IEditorGroupView {
		const groupView = this.assertGroupView(group);
		const locationView = this.assertGroupView(location);

		const restoreFocus = this.shouldRestoreFocus(groupView.element);

		// Copy the group view
		const copiedGroupView = this.doAddGroup(locationView, direction, groupView);

		// Restore focus if we had it
		if (restoreFocus) {
			copiedGroupView.focus();
		}

		return copiedGroupView;
	}

	mergeGroup(group: IEditorGroupView | GroupIdentifier, target: IEditorGroupView | GroupIdentifier, options?: IMergeGroupOptions): IEditorGroupView {
		const sourceView = this.assertGroupView(group);
		const targetView = this.assertGroupView(target);

		// Collect editors to move/copy
		const editors: EditorInputWithOptions[] = [];
		let index = (options && typeof options.index === 'number') ? options.index : targetView.count;
		for (const editor of sourceView.editors) {
			const inactive = !sourceView.isActive(editor) || this._activeGroup !== sourceView;
			const sticky = sourceView.isSticky(editor);
			const options = { index: !sticky ? index : undefined /* do not set index to preserve sticky flag */, inactive, preserveFocus: inactive };

			editors.push({ editor, options });

			index++;
		}

		// Move/Copy editors over into target
		if (options?.mode === MergeGroupMode.COPY_EDITORS) {
			sourceView.copyEditors(editors, targetView);
		} else {
			sourceView.moveEditors(editors, targetView);
		}

		// Remove source if the view is now empty and not already removed
		if (sourceView.isEmpty && !sourceView.disposed /* could have been disposed already via workbench.editor.closeEmptyGroups setting */) {
			this.removeGroup(sourceView);
		}

		return targetView;
	}

	private toGridViewDirection(direction: GroupDirection): Direction {
		switch (direction) {
			case GroupDirection.UP: return Direction.Up;
			case GroupDirection.DOWN: return Direction.Down;
			case GroupDirection.LEFT: return Direction.Left;
			case GroupDirection.RIGHT: return Direction.Right;
		}
	}

	private assertGroupView(group: IEditorGroupView | GroupIdentifier): IEditorGroupView {
		let groupView: IEditorGroupView | undefined;
		if (typeof group === 'number') {
			groupView = this.getGroup(group);
		} else {
			groupView = group;
		}

		if (!groupView) {
			throw new Error('Invalid editor group provided!');
		}

		return groupView;
	}

	//#endregion

	//#region Part

	get minimumWidth(): number {
		return 400;
	}

	get maximumWidth(): number {
		return Number.POSITIVE_INFINITY;
	}

	get minimumHeight(): number {
		return 400;
	}

	get maximumHeight(): number {
		return Number.POSITIVE_INFINITY;
	}

	private get gridSeparatorBorder(): Color {
		return this.theme.getColor(EDITOR_GROUP_BORDER) || this.theme.getColor(contrastBorder) || Color.transparent;
	}

	override createContentArea(parent: HTMLElement, options?: IEditorPartCreationOptions) {
		// Container
		this.element = parent;
		this.element.style.backgroundColor = this.getColor(editorBackground) || '';

		this.container = document.createElement('div');
		this.container.classList.add('content');
		parent.appendChild(this.container);

		new EmptyHolder(this.container!);

		// Grid control
		this.doCreateGridControl(options);

		// Centered layout widget
		this.centeredLayoutWidget = this._register(new CenteredViewLayout(this.container, this.gridWidgetView, this.profileMemento[EditorPart.EDITOR_PART_CENTERED_VIEW_STORAGE_KEY]));

		// Signal ready
		this.whenReadyPromise.complete();
		this._isReady = true;

		return this.container;
	}

	centerLayout(active: boolean): void {
		this.centeredLayoutWidget.activate(active);

		this._activeGroup.focus();
	}

	isLayoutCentered(): boolean {
		if (this.centeredLayoutWidget) {
			return this.centeredLayoutWidget.isActive();
		}

		return false;
	}

	private doCreateGridControl(options?: IEditorPartCreationOptions): void {

		// Grid Widget (with previous UI state)
		let restoreError = false;
		if (!options || options.restorePreviousState) {
			restoreError = !this.doCreateGridControlWithPreviousState();
		}

		// Grid Widget (no previous UI state or failed to restore)
		if (!this.gridWidget || restoreError) {
			const initialGroup = this.doCreateGroupView();
			this.doSetGridWidget(new SerializableGrid(initialGroup));

			// Ensure a group is active
			this.doSetGroupActive(initialGroup);
		}

		// Update container
		this.updateContainer();

		// Notify group index change we created the entire grid
		this.notifyGroupIndexChange();
	}

	private doCreateGridControlWithPreviousState(): boolean {
		const uiState: IEditorPartUIState = this.workspaceMemento[EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY];
		if (uiState?.serializedGrid) {
			try {

				// MRU
				this.mostRecentActiveGroups = uiState.mostRecentActiveGroups;

				// Grid Widget
				this.doCreateGridControlWithState(uiState.serializedGrid, uiState.activeGroup);

				// Ensure last active group has focus
				this._activeGroup.focus();
			} catch (error) {

				// Log error
				onUnexpectedError(new Error(`Error restoring editor grid widget: ${error} (with state: ${JSON.stringify(uiState)})`));

				// Clear any state we have from the failing restore
				this.groupViews.forEach(group => group.dispose());
				this.groupViews.clear();
				this.mostRecentActiveGroups = [];

				return false; // failure
			}
		}

		return true; // success
	}

	private doCreateGridControlWithState(serializedGrid: ISerializedGrid, activeGroupId: GroupIdentifier, editorGroupViewsToReuse?: IEditorGroupView[]): void {

		// Determine group views to reuse if any
		let reuseGroupViews: IEditorGroupView[];
		if (editorGroupViewsToReuse) {
			reuseGroupViews = editorGroupViewsToReuse.slice(0); // do not modify original array
		} else {
			reuseGroupViews = [];
		}

		// Create new
		const groupViews: IEditorGroupView[] = [];
		const gridWidget = SerializableGrid.deserialize(serializedGrid, {
			fromJSON: (serializedEditorGroup: ISerializedEditorGroupModel | null) => {
				let groupView: IEditorGroupView;
				if (reuseGroupViews.length > 0) {
					groupView = reuseGroupViews.shift()!;
				} else {
					groupView = this.doCreateGroupView(serializedEditorGroup);
				}

				groupViews.push(groupView);

				if (groupView.id === activeGroupId) {
					this.doSetGroupActive(groupView);
				}

				return groupView;
			}
		}, { styles: { separatorBorder: this.gridSeparatorBorder } });

		// If the active group was not found when restoring the grid
		// make sure to make at least one group active. We always need
		// an active group.
		if (!this._activeGroup) {
			this.doSetGroupActive(groupViews[0]);
		}

		// Validate MRU group views matches grid widget state
		if (this.mostRecentActiveGroups.some(groupId => !this.getGroup(groupId))) {
			this.mostRecentActiveGroups = groupViews.map(group => group.id);
		}

		// Set it
		this.doSetGridWidget(gridWidget);
	}

	private doSetGridWidget(gridWidget: SerializableGrid<IEditorGroupView>): void {
		let boundarySashes: IBoundarySashes = {};

		if (this.gridWidget) {
			boundarySashes = this.gridWidget.boundarySashes;
			this.gridWidget.dispose();
		}

		this.gridWidget = gridWidget;
		this.gridWidget.boundarySashes = boundarySashes;
		this.gridWidgetView.gridWidget = gridWidget;

		//this._onDidChangeSizeConstraints.input = gridWidget.onDidChange;
		//this._onDidScroll.input = gridWidget.onDidScroll;

		//this.onDidSetGridWidget.fire(undefined);
	}

	createCover(parent: HTMLElement) {
		const coverDomNode = $('');
		coverDomNode.style.height = '100px';
		parent.append(coverDomNode);
	}

	override updateStyles(): void {
		// Part container
		const container = assertIsDefined(this.getContainer());

		container.style.height = '100%';
	}

	private get isEmpty(): boolean {
		return this.count === 1 && this._activeGroup.isEmpty;
	}

	private updateContainer(): void {
		const container = assertIsDefined(this.container);
		container.classList.toggle('empty', this.isEmpty);
	}

	private notifyGroupIndexChange(): void {
		this.getGroups(GroupsOrder.GRID_APPEARANCE).forEach((group, index) => group.notifyIndexChanged(index));
	}

	getTitleStyle(): CSSProperties {
		return {
			color: ThemedStyles.regularTextColor.dark,
			fontWeight: 700,
			lineHeight: 1.2,
			fontSize: '40px',
			cursor: 'text',
			display: 'flex',
			alignItems: 'center',
		};
	}

	override layout(width: number, height: number, top: number, left: number): void {

		this._top = top;
		this._left = left;

		// Layout contents
		const contentAreaSize = super.layoutContents(width, height).contentSize;

		// Layout editor container
		this.doLayout(Dimension.lift(contentAreaSize), top, left);
	}

	private doLayout(dimension: Dimension, top = this._top, left = this._left): void {
		this._contentDimension = dimension;

		// Layout Grid
		this.centeredLayoutWidget.layout(this._contentDimension.width, this._contentDimension.height, top, left);

	}

	toJSON(): object {
		return {
			type: Parts.EDITOR_PART
		};
	}

	//#endregion
}

registerSingleton(IEditorGroupsService, EditorPart);
