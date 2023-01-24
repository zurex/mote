import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorActivation, IEditorOptions, IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorIdentifier, IEditorPane, isEditorInput, isEditorInputWithOptionsAndGroup, IVisibleEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { ICloseEditorOptions, IEditorGroup, IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IEditorResolverService, ResolvedStatus } from 'mote/workbench/services/editor/common/editorResolverService';
import { IEditorService, isPreferredGroup, PreferredGroup } from 'mote/workbench/services/editor/common/editorService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { findGroup } from 'mote/workbench/services/editor/common/editorGroupFinder';

export class EditorService implements IEditorService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {

	}

	//#region Editor accessors

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
