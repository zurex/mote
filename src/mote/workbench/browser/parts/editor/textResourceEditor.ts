import { CancellationToken } from 'mote/base/common/cancellation';
import { assertIsDefined } from 'mote/base/common/types';
import { IMoteEditorViewState } from 'mote/editor/common/editorCommon';
import { ITextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfiguration';
import { ITextEditorOptions } from 'mote/platform/editor/common/editor';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { IStorageService } from 'mote/platform/storage/common/storage';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { AbstractTextMoteEditor } from 'mote/workbench/browser/parts/editor/textMoteEditor';
import { IEditorOpenContext } from 'mote/workbench/common/editor';
import { BaseTextEditorModel } from 'mote/workbench/common/editor/textEditorModel';
import { AbstractTextResourceEditorInput } from 'mote/workbench/common/editor/textResourceEditorInput';
import { IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';

/**
 * An editor implementation that is capable of showing the contents of resource inputs. Uses
 * the TextEditor widget to show the contents.
 */
export abstract class AbstractTextResourceEditor extends AbstractTextMoteEditor<IMoteEditorViewState> {

	constructor(
		id: string,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
	) {
		super(id, instantiationService, storageService, themeService, textResourceConfigurationService, editorGroupService);
	}

	override async setInput(input: AbstractTextResourceEditorInput, options: ITextEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		// Set input and resolve
		await super.setInput(input, options, context, token);
		const resolvedModel = await input.resolve(options);

		// Check for cancellation
		if (token.isCancellationRequested) {
			return undefined;
		}

		// Assert Model instance
		if (!(resolvedModel instanceof BaseTextEditorModel)) {
			throw new Error('Unable to open file as text');
		}

		// Set Editor Model
		const control = assertIsDefined(this.editorControl);
		const textEditorModel = resolvedModel.textEditorModel;
		control.setModel(textEditorModel);
	}
}

export class TextResourceEditor extends AbstractTextResourceEditor {

	static readonly ID = 'workbench.editors.textResourceEditor';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
	) {
		super(TextResourceEditor.ID, instantiationService, storageService, themeService, textResourceConfigurationService, editorGroupService);
	}
}
