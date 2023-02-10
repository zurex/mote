import { URI } from 'mote/base/common/uri';
import { ITextModelService } from 'mote/editor/common/services/resolverService';
import { IFileService } from 'mote/platform/files/common/files';
import { ILabelService } from 'mote/platform/label/common/label';
import { AbstractResourceEditorInput } from 'mote/workbench/common/editor/resourceEditorInput';
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
}
