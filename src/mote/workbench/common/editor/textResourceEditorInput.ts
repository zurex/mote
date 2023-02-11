import { IReference } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { createTextBufferFactory } from 'mote/editor/common/model/textBasedTextModel';
import { ITextEditorModel, ITextModelService } from 'mote/editor/common/services/resolverService';
import { IFileService } from 'mote/platform/files/common/files';
import { ILabelService } from 'mote/platform/label/common/label';
import { DEFAULT_EDITOR_ASSOCIATION } from 'mote/workbench/common/editor';
import { AbstractResourceEditorInput } from 'mote/workbench/common/editor/resourceEditorInput';
import { TextResourceEditorModel } from 'mote/workbench/common/editor/textResourceEditorModel';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { ITextFileService } from 'mote/workbench/services/textfile/common/textfiles';

/**
 * The base class for all editor inputs that open in text editors.
 */
export abstract class AbstractTextResourceEditorInput extends AbstractResourceEditorInput {
	constructor(
		resource: URI,
		preferredResource: URI | undefined,
		@IEditorService protected readonly editorService: IEditorService,
		@ITextFileService protected readonly textFileService: ITextFileService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService
	) {
		super(resource, preferredResource, labelService, fileService);
	}
}

export class TextResourceEditorInput extends AbstractTextResourceEditorInput {
	static readonly ID: string = 'workbench.editors.resourceEditorInput';

	override get typeId(): string {
		return TextResourceEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return DEFAULT_EDITOR_ASSOCIATION.id;
	}

	private cachedModel: TextResourceEditorModel | undefined = undefined;
	private modelReference: Promise<IReference<ITextEditorModel>> | undefined = undefined;

	constructor(
		resource: URI,
		private name: string | undefined,
		private description: string | undefined,
		private preferredContents: string | undefined,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorService editorService: IEditorService,
		@IFileService fileService: IFileService,
		@ILabelService labelService: ILabelService
	) {
		super(resource, undefined, editorService, textFileService, labelService, fileService);
	}

	override getName(): string {
		return this.name || super.getName();
	}

	setName(name: string): void {
		if (this.name !== name) {
			this.name = name;

			this._onDidChangeLabel.fire();
		}
	}

	override getDescription(): string | undefined {
		return this.description;
	}

	setDescription(description: string): void {
		if (this.description !== description) {
			this.description = description;

			this._onDidChangeLabel.fire();
		}
	}

	setPreferredContents(contents: string): void {
		this.preferredContents = contents;
	}

	override async resolve(): Promise<ITextEditorModel> {
		// Unset preferred contents and language after resolving
		// once to prevent these properties to stick. We still
		// want the user to change the language in the editor
		// and want to show updated contents (if any) in future
		// `resolve` calls.
		const preferredContents = this.preferredContents;
		this.preferredContents = undefined;

		if (!this.modelReference) {
			this.modelReference = this.textModelResolverService.createModelReference(this.resource);
		}

		const ref = await this.modelReference;

		// Ensure the resolved model is of expected type
		const model = ref.object;
		if (!(model instanceof TextResourceEditorModel)) {
			ref.dispose();
			this.modelReference = undefined;

			throw new Error(`Unexpected model for TextResourceEditorInput: ${this.resource}`);
		}

		this.cachedModel = model;

		// Set contents and language if preferred
		if (typeof preferredContents === 'string') {
			model.updateTextEditorModel(typeof preferredContents === 'string' ? createTextBufferFactory(preferredContents) : undefined);
		}

		return model;
	}
}
