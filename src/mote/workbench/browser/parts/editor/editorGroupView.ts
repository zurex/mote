import 'mote/css!./media/editorgroupview';
import { IDomNodePagePosition, isAncestor } from 'mote/base/browser/dom';
import { LayoutPriority } from 'mote/base/browser/ui/splitview/splitview';
import { Emitter, Relay } from 'mote/base/common/event';
import { withNullAsUndefined } from 'mote/base/common/types';
import { EditorActivation, IEditorOptions } from 'mote/platform/editor/common/editor';
import { IThemeService, Themable } from 'mote/platform/theme/common/themeService';
import { IEditorGroupsAccessor, IEditorGroupView, IInternalEditorCloseOptions, IInternalEditorOpenOptions, IInternalEditorTitleControlOptions } from 'mote/workbench/browser/parts/editor/editor';
import { EditorPanes } from 'mote/workbench/browser/parts/editor/editorPanes';
import { IVisibleEditorPane, IEditorPane, GroupIdentifier, EditorsOrder, IActiveEditorChangeEvent, SideBySideEditor, IEditorWillOpenEvent, IEditorWillMoveEvent, IEditorCloseEvent, GroupModelChangeKind, EditorCloseContext } from 'mote/workbench/common/editor';
import { EditorGroupModel, IEditorOpenOptions, IGroupModelChangeEvent, ISerializedEditorGroupModel, isGroupEditorCloseEvent, isGroupEditorOpenEvent, isSerializedEditorGroupModel } from 'mote/workbench/common/editorGroupModel';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { GroupsOrder, ICloseEditorOptions } from 'mote/workbench/services/editor/common/editorGroupsService';
import { SideBySideEditorInput } from 'mote/workbench/common/sideBySideEditorInput';
import { RunOnceWorker } from 'mote/base/common/async';

export class EditorGroupView extends Themable implements IEditorGroupView {

	//#region factory

	static createNew(accessor: IEditorGroupsAccessor, index: number, instantiationService: IInstantiationService): IEditorGroupView {
		return instantiationService.createInstance(EditorGroupView, accessor, null, index);
	}

	static createFromSerialized(serialized: ISerializedEditorGroupModel, accessor: IEditorGroupsAccessor, index: number, instantiationService: IInstantiationService): IEditorGroupView {
		return instantiationService.createInstance(EditorGroupView, accessor, serialized, index);
	}

	static createCopy(copyFrom: IEditorGroupView, accessor: IEditorGroupsAccessor, index: number, instantiationService: IInstantiationService): IEditorGroupView {
		return instantiationService.createInstance(EditorGroupView, accessor, copyFrom, index);
	}

	//#endregion

	//#region Events

	private readonly _onDidFocus = this._register(new Emitter<void>());
	readonly onDidFocus = this._onDidFocus.event;

	private readonly _onWillDispose = this._register(new Emitter<void>());
	readonly onWillDispose = this._onWillDispose.event;

	private readonly _onDidModelChange = this._register(new Emitter<IGroupModelChangeEvent>());
	readonly onDidModelChange = this._onDidModelChange.event;

	private readonly _onDidActiveEditorChange = this._register(new Emitter<IActiveEditorChangeEvent>());
	readonly onDidActiveEditorChange = this._onDidActiveEditorChange.event;

	private readonly _onWillOpenEditor = this._register(new Emitter<IEditorWillOpenEvent>());
	readonly onWillOpenEditor = this._onWillOpenEditor.event;

	private readonly _onWillMoveEditor = this._register(new Emitter<IEditorWillMoveEvent>());
	readonly onWillMoveEditor = this._onWillMoveEditor.event;

	private readonly _onWillCloseEditor = this._register(new Emitter<IEditorCloseEvent>());
	readonly onWillCloseEditor = this._onWillCloseEditor.event;

	private readonly _onDidCloseEditor = this._register(new Emitter<IEditorCloseEvent>());
	readonly onDidCloseEditor = this._onDidCloseEditor.event;

	//#endregion

	private readonly model: EditorGroupModel;

	private active: boolean | undefined;

	//private readonly titleContainer: HTMLElement;
	//private titleAreaControl: TitleControl;

	private readonly scopedInstantiationService: IInstantiationService;

	private readonly editorContainer: HTMLElement;
	private readonly editorPane: EditorPanes;

	private readonly disposedEditorsWorker = this._register(new RunOnceWorker<EditorInput>(editors => this.handleDisposedEditors(editors), 0));


	constructor(
		private accessor: IEditorGroupsAccessor,
		from: IEditorGroupView | ISerializedEditorGroupModel | null,
		private _index: number,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
	) {
		super(themeService);

		if (from instanceof EditorGroupView) {
			this.model = this._register(from.model.clone());
		} else if (isSerializedEditorGroupModel(from)) {
			this.model = this._register(instantiationService.createInstance(EditorGroupModel, from));
		} else {
			this.model = this._register(instantiationService.createInstance(EditorGroupModel, undefined));
		}

		this.scopedInstantiationService = instantiationService;

		//#region create()
		{
			// Container
			this.element.classList.add('editor-group-container');

			// Title control
			///this.titleAreaControl = this.createTitleAreaControl();

			// Editor container
			this.editorContainer = document.createElement('div');
			this.editorContainer.classList.add('editor-container');
			this.element.appendChild(this.editorContainer);

			// Editor pane
			this.editorPane = this._register(this.scopedInstantiationService.createInstance(EditorPanes, this.editorContainer));
			//this._onDidChange.input = this.editorPane.onDidChangeSizeConstraints;
		}

		// Register Listeners
		this.registerListeners();
	}

	private updateContainer(): void {

	}

	//#region event handling

	private registerListeners(): void {
		// Model Events
		this._register(this.model.onDidModelChange(e => this.onDidGroupModelChange(e)));

	}

	private onDidGroupModelChange(e: IGroupModelChangeEvent): void {

		// Re-emit to outside
		this._onDidModelChange.fire(e);

		// Handle within

		if (!e.editor) {
			return;
		}

		switch (e.kind) {
			case GroupModelChangeKind.EDITOR_OPEN:
				if (isGroupEditorOpenEvent(e)) {
					this.onDidOpenEditor(e.editor, e.editorIndex);
				}
				break;
			case GroupModelChangeKind.EDITOR_CLOSE:
				if (isGroupEditorCloseEvent(e)) {
					this.handleOnDidCloseEditor(e.editor, e.editorIndex, e.context, e.sticky);
				}
				break;
			case GroupModelChangeKind.EDITOR_WILL_DISPOSE:
				this.onWillDisposeEditor(e.editor);
				break;
			case GroupModelChangeKind.EDITOR_DIRTY:
				//this.onDidChangeEditorDirty(e.editor);
				break;
			case GroupModelChangeKind.EDITOR_LABEL:
				//this.onDidChangeEditorLabel(e.editor);
				break;
		}
	}

	private onDidOpenEditor(editor: EditorInput, editorIndex: number): void {

		/* __GDPR__
			"editorOpened" : {
				"owner": "bpasero",
				"${include}": [
					"${EditorTelemetryDescriptor}"
				]
			}
		*/
		//this.telemetryService.publicLog('editorOpened', this.toEditorTelemetryDescriptor(editor));

		// Update container
		this.updateContainer();
	}

	private handleOnDidCloseEditor(editor: EditorInput, editorIndex: number, context: EditorCloseContext, sticky: boolean): void {

		// Before close
		this._onWillCloseEditor.fire({ groupId: this.id, editor, context, index: editorIndex, sticky });

		// Handle event
		const editorsToClose: EditorInput[] = [editor];

		// Include both sides of side by side editors when being closed
		if (editor instanceof SideBySideEditorInput) {
			editorsToClose.push(editor.primary, editor.secondary);
		}

		// For each editor to close, we call dispose() to free up any resources.
		// However, certain editors might be shared across multiple editor groups
		// (including being visible in side by side / diff editors) and as such we
		// only dispose when they are not opened elsewhere.
		for (const editor of editorsToClose) {
			if (this.canDispose(editor)) {
				editor.dispose();
			}
		}

		/* __GDPR__
			"editorClosed" : {
				"owner": "bpasero",
				"${include}": [
					"${EditorTelemetryDescriptor}"
				]
			}
		*/
		//this.telemetryService.publicLog('editorClosed', this.toEditorTelemetryDescriptor(editor));

		// Update container
		this.updateContainer();

		// Event
		this._onDidCloseEditor.fire({ groupId: this.id, editor, context, index: editorIndex, sticky });
	}

	private canDispose(editor: EditorInput): boolean {
		for (const groupView of this.accessor.groups) {
			if (groupView instanceof EditorGroupView && groupView.model.contains(editor, {
				strictEquals: true,						// only if this input is not shared across editor groups
				supportSideBySide: SideBySideEditor.ANY // include any side of an opened side by side editor
			})) {
				return false;
			}
		}

		return true;
	}

	private onWillDisposeEditor(editor: EditorInput): void {

		// To prevent race conditions, we handle disposed editors in our worker with a timeout
		// because it can happen that an input is being disposed with the intent to replace
		// it with some other input right after.
		this.disposedEditorsWorker.work(editor);
	}

	private handleDisposedEditors(editors: EditorInput[]): void {

		// Split between visible and hidden editors
		let activeEditor: EditorInput | undefined;
		const inactiveEditors: EditorInput[] = [];
		for (const editor of editors) {
			if (this.model.isActive(editor)) {
				activeEditor = editor;
			} else if (this.model.contains(editor)) {
				inactiveEditors.push(editor);
			}
		}

		// Close all inactive editors first to prevent UI flicker
		for (const inactiveEditor of inactiveEditors) {
			this.doCloseEditor(inactiveEditor, false);
		}

		// Close active one last
		if (activeEditor) {
			this.doCloseEditor(activeEditor, false);
		}
	}

	//#endregion

	setActive(isActive: boolean): void {

	}
	notifyIndexChanged(newIndex: number): void {

	}
	toJSON(): object {
		throw new Error('Method not implemented.');
	}
	preferredWidth?: number | undefined;
	preferredHeight?: number | undefined;

	priority?: LayoutPriority | undefined;
	snap?: boolean | undefined;

	setVisible?(visible: boolean): void {
		throw new Error('Method not implemented.');
	}


	isActive(editor: EditorInput): boolean {
		throw new Error('Method not implemented.');
	}

	//#region IEditorGroup

	//#region basics()

	get id(): GroupIdentifier {
		return this.model.id;
	}

	get editors(): EditorInput[] {
		return this.model.getEditors(EditorsOrder.SEQUENTIAL);
	}

	get count(): number {
		return this.model.count;
	}

	private _disposed = false;
	get disposed(): boolean {
		return this._disposed;
	}

	get activeEditorPane(): IVisibleEditorPane | undefined {
		return this.editorPane ? withNullAsUndefined(this.editorPane.activeEditorPane) as any : undefined;
	}

	get activeEditor(): EditorInput | null {
		return this.model.activeEditor;
	}

	get isLocked(): boolean {
		if (this.accessor.groups.length === 1) {
			// Special case: if only 1 group is opened, never report it as locked
			// to ensure editors can always open in the "default" editor group
			return false;
		}

		return this.model.isLocked;
	}

	isSticky(editorOrIndex: EditorInput | number): boolean {
		return this.model.isSticky(editorOrIndex);
	}

	lock(locked: boolean): void {
		if (this.accessor.groups.length === 1) {
			// Special case: if only 1 group is opened, never allow to lock
			// to ensure editors can always open in the "default" editor group
			locked = false;
		}

		this.model.lock(locked);
	}

	focus(): void {

		// Pass focus to editor panes
		if (this.activeEditorPane) {
			this.activeEditorPane.focus();
		} else {
			this.element.focus();
		}

		// Event
		this._onDidFocus.fire();
	}

	//#endregion

	async openEditor(editor: EditorInput, options?: IEditorOptions | undefined): Promise<IEditorPane | undefined> {
		return this.doOpenEditor(editor, options, {
			// Allow to match on a side-by-side editor when same
			// editor is opened on both sides. In that case we
			// do not want to open a new editor but reuse that one.
			supportSideBySide: SideBySideEditor.BOTH
		});
	}

	private async doOpenEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined> {

		// Guard against invalid editors. Disposed editors
		// should never open because they emit no events
		// e.g. to indicate dirty changes.
		if (!editor || editor.isDisposed()) {
			return;
		}

		// Fire the event letting everyone know we are about to open an editor
		this._onWillOpenEditor.fire({ editor, groupId: this.id });

		// Determine options
		const openEditorOptions: IEditorOpenOptions = {
			index: options ? options.index : undefined,
			pinned: options?.sticky || !this.accessor.partOptions.enablePreview || editor.isDirty() || (options?.pinned ?? typeof options?.index === 'number' /* unless specified, prefer to pin when opening with index */) || (typeof options?.index === 'number' && this.model.isSticky(options.index)),
			sticky: options?.sticky || (typeof options?.index === 'number' && this.model.isSticky(options.index)),
			active: this.count === 0 || !options || !options.inactive,
			supportSideBySide: internalOptions?.supportSideBySide
		};

		if (options?.sticky && typeof options?.index === 'number' && !this.model.isSticky(options.index)) {
			// Special case: we are to open an editor sticky but at an index that is not sticky
			// In that case we prefer to open the editor at the index but not sticky. This enables
			// to drag a sticky editor to an index that is not sticky to unstick it.
			openEditorOptions.sticky = false;
		}

		if (!openEditorOptions.active && !openEditorOptions.pinned && this.model.activeEditor && !this.model.isPinned(this.model.activeEditor)) {
			// Special case: we are to open an editor inactive and not pinned, but the current active
			// editor is also not pinned, which means it will get replaced with this one. As such,
			// the editor can only be active.
			openEditorOptions.active = true;
		}

		let activateGroup = false;
		let restoreGroup = false;

		if (options?.activation === EditorActivation.ACTIVATE) {
			// Respect option to force activate an editor group.
			activateGroup = true;
		} else if (options?.activation === EditorActivation.RESTORE) {
			// Respect option to force restore an editor group.
			restoreGroup = true;
		} else if (options?.activation === EditorActivation.PRESERVE) {
			// Respect option to preserve active editor group.
			activateGroup = false;
			restoreGroup = false;
		} else if (openEditorOptions.active) {
			// Finally, we only activate/restore an editor which is
			// opening as active editor.
			// If preserveFocus is enabled, we only restore but never
			// activate the group.
			activateGroup = !options || !options.preserveFocus;
			restoreGroup = !activateGroup;
		}

		// Actually move the editor if a specific index is provided and we figure
		// out that the editor is already opened at a different index. This
		// ensures the right set of events are fired to the outside.
		if (typeof openEditorOptions.index === 'number') {
			const indexOfEditor = this.model.indexOf(editor);
			if (indexOfEditor !== -1 && indexOfEditor !== openEditorOptions.index) {
				this.doMoveEditorInsideGroup(editor, openEditorOptions);
			}
		}

		// Update model and make sure to continue to use the editor we get from
		// the model. It is possible that the editor was already opened and we
		// want to ensure that we use the existing instance in that case.
		const { editor: openedEditor, isNew } = this.model.openEditor(editor, openEditorOptions);

		// Conditionally lock the group
		if (
			isNew &&						// only if this editor was new for the group
			this.count === 1 &&				// only when this editor was the first editor in the group
			this.accessor.groups.length > 1	// only when there are more than one groups open
		) {
			// only when the editor identifier is configured as such
			if (openedEditor.editorId && this.accessor.partOptions.autoLockGroups?.has(openedEditor.editorId)) {
				this.lock(true);
			}
		}

		// Show editor
		const showEditorResult = this.doShowEditor(openedEditor, { active: !!openEditorOptions.active, isNew }, options, internalOptions);

		// Finally make sure the group is active or restored as instructed
		if (activateGroup) {
			this.accessor.activateGroup(this);
		} else if (restoreGroup) {
			this.accessor.restoreGroup(this);
		}

		return showEditorResult;
	}

	private doShowEditor(editor: EditorInput, context: { active: boolean; isNew: boolean }, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined> {

		// Show in editor control if the active editor changed
		let openEditorPromise: Promise<IEditorPane | undefined>;
		if (context.active) {
			openEditorPromise = (async () => {
				const { pane, changed, cancelled, error } = await this.editorPane.openEditor(editor, options, { newInGroup: context.isNew });

				// Return early if the operation was cancelled by another operation
				if (cancelled) {
					return undefined;
				}

				// Editor change event
				if (changed) {
					this._onDidActiveEditorChange.fire({ editor });
				}

				// Indicate error as an event but do not bubble them up
				if (error) {
					//this._onDidOpenEditorFail.fire(editor);
				}

				// Without an editor pane, recover by closing the active editor
				// (if the input is still the active one)
				if (!pane && this.activeEditor === editor) {
					const focusNext = !options || !options.preserveFocus;
					this.doCloseEditor(editor, focusNext, { fromError: true });
				}

				return pane;
			})();
		} else {
			openEditorPromise = Promise.resolve(undefined); // inactive: return undefined as result to signal this
		}

		// Show in title control after editor control because some actions depend on it
		// but respect the internal options in case title control updates should skip.
		if (!internalOptions?.skipTitleUpdate) {
			//this.titleAreaControl.openEditor(editor);
		}

		return openEditorPromise;
	}

	moveEditors(editors: { editor: EditorInput; options?: IEditorOptions }[], target: EditorGroupView): void {

	}

	moveEditor(editor: EditorInput, target: EditorGroupView, options?: IEditorOptions, internalOptions?: IInternalEditorTitleControlOptions): void {

	}

	private doMoveEditorInsideGroup(candidate: EditorInput, options?: IEditorOpenOptions): void {
		const moveToIndex = options ? options.index : undefined;
		if (typeof moveToIndex !== 'number') {
			return; // do nothing if we move into same group without index
		}

		const currentIndex = this.model.indexOf(candidate);
		if (currentIndex === -1 || currentIndex === moveToIndex) {
			return; // do nothing if editor unknown in model or is already at the given index
		}

		// Update model and make sure to continue to use the editor we get from
		// the model. It is possible that the editor was already opened and we
		// want to ensure that we use the existing instance in that case.
		const editor = this.model.getEditorByIndex(currentIndex);
		if (!editor) {
			return;
		}

		// Update model
		this.model.moveEditor(editor, moveToIndex);
		this.model.pin(editor);

		// Forward to title area
		//this.titleAreaControl.moveEditor(editor, currentIndex, moveToIndex);
		//this.titleAreaControl.pinEditor(editor);
	}

	copyEditors(editors: { editor: EditorInput; options?: IEditorOptions }[], target: EditorGroupView): void {

	}

	copyEditor(editor: EditorInput, target: EditorGroupView, options?: IEditorOptions, internalOptions?: IInternalEditorTitleControlOptions): void {

	}

	async closeEditor(editor: EditorInput | undefined = this.activeEditor || undefined, options?: ICloseEditorOptions): Promise<boolean> {
		if (!editor) {
			return false;
		}
		this.doCloseEditor(editor, options?.preserveFocus ? false : undefined);
		return true;
	}

	private doCloseEditor(editor: EditorInput, focusNext = (this.accessor.activeGroup === this), internalOptions?: IInternalEditorCloseOptions): void {
		let index: number | undefined;

		// Closing the active editor of the group is a bit more work
		if (this.model.isActive(editor)) {
			index = this.doCloseActiveEditor(focusNext, internalOptions);
		}

		// Closing inactive editor is just a model update
		else {
			index = this.doCloseInactiveEditor(editor, internalOptions);
		}

	}

	private doCloseActiveEditor(focusNext = (this.accessor.activeGroup === this), internalOptions?: IInternalEditorCloseOptions): number | undefined {
		const editorToClose = this.activeEditor;
		const restoreFocus = this.shouldRestoreFocus(this.element);

		// Optimization: if we are about to close the last editor in this group and settings
		// are configured to close the group since it will be empty, we first set the last
		// active group as empty before closing the editor. This reduces the amount of editor
		// change events that this operation emits and will reduce flicker. Without this
		// optimization, this group (if active) would first trigger a active editor change
		// event because it became empty, only to then trigger another one when the next
		// group gets active.
		const closeEmptyGroup = this.accessor.partOptions.closeEmptyGroups;
		if (closeEmptyGroup && this.active && this.count === 1) {
			const mostRecentlyActiveGroups = this.accessor.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
			const nextActiveGroup = mostRecentlyActiveGroups[1]; // [0] will be the current one, so take [1]
			if (nextActiveGroup) {
				if (restoreFocus) {
					nextActiveGroup.focus();
				} else {
					this.accessor.activateGroup(nextActiveGroup);
				}
			}
		}

		// Update model
		let index: number | undefined = undefined;
		if (editorToClose) {
			index = this.model.closeEditor(editorToClose, internalOptions?.context)?.editorIndex;
		}

		// Open next active if there are more to show
		const nextActiveEditor = this.model.activeEditor;
		if (nextActiveEditor) {
			const preserveFocus = !focusNext;

			let activation: EditorActivation | undefined = undefined;
			if (preserveFocus && this.accessor.activeGroup !== this) {
				// If we are opening the next editor in an inactive group
				// without focussing it, ensure we preserve the editor
				// group sizes in case that group is minimized.
				// https://github.com/microsoft/vscode/issues/117686
				activation = EditorActivation.PRESERVE;
			}

			const options: IEditorOptions = {
				preserveFocus,
				activation,
				// When closing an editor due to an error we can end up in a loop where we continue closing
				// editors that fail to open (e.g. when the file no longer exists). We do not want to show
				// repeated errors in this case to the user. As such, if we open the next editor and we are
				// in a scope of a previous editor failing, we silence the input errors until the editor is
				// opened by setting ignoreError: true.
				//ignoreError: internalOptions?.fromError
			};

			this.doOpenEditor(nextActiveEditor, options);
		}

		// Otherwise we are empty, so clear from editor control and send event
		else {

			// Forward to editor pane
			if (editorToClose) {
				this.editorPane.closeEditor(editorToClose);
			}

			// Restore focus to group container as needed unless group gets closed
			if (restoreFocus && !closeEmptyGroup) {
				this.focus();
			}

			// Events
			this._onDidActiveEditorChange.fire({ editor: undefined });

			// Remove empty group if we should
			if (closeEmptyGroup) {
				this.accessor.removeGroup(this);
			}
		}

		return index;
	}

	private shouldRestoreFocus(target: Element): boolean {
		const activeElement = document.activeElement;

		if (activeElement === document.body) {
			return true; // always restore focus if nothing is focused currently
		}

		// otherwise check for the active element being an ancestor of the target
		return isAncestor(activeElement, target);
	}

	private doCloseInactiveEditor(editor: EditorInput, internalOptions?: IInternalEditorCloseOptions): number | undefined {

		// Update model
		return this.model.closeEditor(editor, internalOptions?.context)?.editorIndex;
	}


	//#endregion

	//#region ISerializableView

	readonly element: HTMLElement = document.createElement('div');

	get minimumWidth(): number { return this.editorPane.minimumWidth; }
	get minimumHeight(): number { return this.editorPane.minimumHeight; }
	get maximumWidth(): number { return this.editorPane.maximumWidth; }
	get maximumHeight(): number { return this.editorPane.maximumHeight; }

	private _onDidChange = this._register(new Relay<{ width: number; height: number } | undefined>());
	readonly onDidChange = this._onDidChange.event;

	private lastLayout: IDomNodePagePosition | undefined;
	layout(width: number, height: number, top: number, left: number): void {
		this.lastLayout = { width, height, top, left };

		/*
		// Layout the title area first to receive the size it occupies
		const titleAreaSize = this.titleAreaControl.layout({
			container: new Dimension(width, height),
			available: new Dimension(width, height - this.editorPane.minimumHeight)
		});
		*/

		const titleAreaSize = { height: 0 };

		// Pass the container width and remaining height to the editor layout
		const editorHeight = Math.max(0, height - titleAreaSize.height);
		this.editorContainer.style.height = `${editorHeight}px`;
		this.editorPane.layout({ width, height: editorHeight, top: top + titleAreaSize.height, left });
	}

	//#region IEditorGroupView

	get index(): number {
		return this._index;
	}

	get isEmpty(): boolean {
		return this.count === 0;
	}

	//#endregion
}
