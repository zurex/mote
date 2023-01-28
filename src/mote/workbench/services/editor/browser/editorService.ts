import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorActivation, IEditorOptions, IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorCloseEvent, IEditorIdentifier, IEditorPane, isEditorInput, isEditorInputWithOptionsAndGroup, IVisibleEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { ICloseEditorOptions, IEditorGroup, IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IEditorResolverService, ResolvedStatus } from 'mote/workbench/services/editor/common/editorResolverService';
import { IEditorsChangeEvent, IEditorService, isPreferredGroup, PreferredGroup } from 'mote/workbench/services/editor/common/editorService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { findGroup } from 'mote/workbench/services/editor/common/editorGroupFinder';
import { Disposable, DisposableStore, dispose } from 'mote/base/common/lifecycle';
import { Emitter, Event } from 'mote/base/common/event';
import { withNullAsUndefined } from 'mote/base/common/types';
import { IEditorGroupView } from 'mote/workbench/browser/parts/editor/editor';

export class EditorService extends Disposable implements IEditorService {

	declare readonly _serviceBrand: undefined;

	//#region events

	private readonly _onDidActiveEditorChange = this._register(new Emitter<void>());
	readonly onDidActiveEditorChange = this._onDidActiveEditorChange.event;

	private readonly _onDidVisibleEditorsChange = this._register(new Emitter<void>());
	readonly onDidVisibleEditorsChange = this._onDidVisibleEditorsChange.event;

	private readonly _onDidEditorsChange = this._register(new Emitter<IEditorsChangeEvent>());
	readonly onDidEditorsChange = this._onDidEditorsChange.event;

	private readonly _onDidCloseEditor = this._register(new Emitter<IEditorCloseEvent>());
	readonly onDidCloseEditor = this._onDidCloseEditor.event;

	//#endregion

	constructor(
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		// Editor & group changes
		this.editorGroupService.whenReady.then(() => this.onEditorGroupsReady());
		this.editorGroupService.onDidChangeActiveGroup(group => this.handleActiveEditorChange(group));
		this.editorGroupService.onDidAddGroup(group => this.registerGroupListeners(group as IEditorGroupView));

	}

	//#region Editor accessors

	get activeEditor(): EditorInput | undefined {
		const activeGroup = this.editorGroupService.activeGroup;
		return activeGroup ? withNullAsUndefined(activeGroup.activeEditor) : undefined;
	}

	get activeEditorPane(): IVisibleEditorPane | undefined {
		return this.editorGroupService.activeGroup?.activeEditorPane;
	}

	get activeEditorControl(): IMoteEditor | undefined {
		const activeEditorPane = this.activeEditorPane;
		if (activeEditorPane) {
			const activeControl = activeEditorPane.getControl();
			return activeControl as any;
		}
		return undefined;
	}

	//#endregion

	//#region Editor & group event handlers

	private lastActiveEditor: EditorInput | undefined = undefined;

	private onEditorGroupsReady(): void {

		// Register listeners to each opened group
		for (const group of this.editorGroupService.groups) {
			this.registerGroupListeners(group as IEditorGroupView);
		}

		// Fire initial set of editor events if there is an active editor
		if (this.activeEditor) {
			this.doHandleActiveEditorChangeEvent();
			this._onDidVisibleEditorsChange.fire();
		}
	}

	private handleActiveEditorChange(group: IEditorGroup): void {
		if (group !== this.editorGroupService.activeGroup) {
			return; // ignore if not the active group
		}

		if (!this.lastActiveEditor && !group.activeEditor) {
			return; // ignore if we still have no active editor
		}

		this.doHandleActiveEditorChangeEvent();
	}

	private doHandleActiveEditorChangeEvent(): void {

		// Remember as last active
		const activeGroup = this.editorGroupService.activeGroup;
		this.lastActiveEditor = withNullAsUndefined(activeGroup.activeEditor);

		// Fire event to outside parties
		this._onDidActiveEditorChange.fire();
	}

	private registerGroupListeners(group: IEditorGroupView): void {
		const groupDisposables = new DisposableStore();

		groupDisposables.add(group.onDidModelChange(e => {
			this._onDidEditorsChange.fire({ groupId: group.id, event: e });
		}));

		groupDisposables.add(group.onDidActiveEditorChange(() => {
			this.handleActiveEditorChange(group);
			this._onDidVisibleEditorsChange.fire();
		}));

		groupDisposables.add(group.onDidCloseEditor(e => {
			this._onDidCloseEditor.fire(e);
		}));

		/*
		groupDisposables.add(group.onDidOpenEditorFail(editor => {
			this._onDidOpenEditorFail.fire({ editor, groupId: group.id });
		}));
		*/

		Event.once(group.onWillDispose)(() => {
			dispose(groupDisposables);
		});
	}

	//#endregion

	async openEditor(editor: EditorInput, optionsOrPreferredGroup?: IEditorOptions | PreferredGroup, preferredGroup?: PreferredGroup): Promise<IEditorPane | undefined> {
		let typedEditor: EditorInput | undefined = undefined;
		let options = isEditorInput(editor) ? optionsOrPreferredGroup as IEditorOptions : undefined;
		let group: IEditorGroup | undefined = undefined;

		if (isPreferredGroup(optionsOrPreferredGroup)) {
			preferredGroup = optionsOrPreferredGroup;
		}

		// Resolve override unless disabled
		if (!isEditorInput(editor)) {
			const resolvedEditor = await this.editorResolverService.resolveEditor(editor, preferredGroup);

			if (resolvedEditor === ResolvedStatus.ABORT) {
				return; // skip editor if override is aborted
			}

			// We resolved an editor to use
			if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
				typedEditor = resolvedEditor.editor;
				options = resolvedEditor.options;
				group = resolvedEditor.group;
			}
		}

		// Override is disabled or did not apply: fallback to default
		if (!typedEditor) {
			typedEditor = isEditorInput(editor) ? editor : undefined;
		}

		// If group still isn't defined because of a disabled override we resolve it
		if (!group) {
			let activation: EditorActivation | undefined = undefined;
			([group, activation] = this.instantiationService.invokeFunction(findGroup, { editor: typedEditor!, options }, preferredGroup));

			// Mixin editor group activation if returned
			if (activation) {
				options = { ...options, activation };
			}
		}

		return group!.openEditor(typedEditor!, options);
	}

	openEditorWithResource(editor: IResourceEditorInput): Promise<IEditorPane | undefined> {
		throw new Error('Method not implemented.');
	}

	async closeActiveEditor(options?: ICloseEditorOptions | undefined): Promise<void> {
		const group = this.editorGroupService.activeGroup!;
		await group?.closeEditor(group.activeEditor!, options);
	}

	async closeEditor({ editor, groupId }: IEditorIdentifier, options?: ICloseEditorOptions): Promise<void> {
		const group = this.editorGroupService.getGroup(groupId);
		await group?.closeEditor(editor, options);
	}


}


registerSingleton(IEditorService, EditorService);
