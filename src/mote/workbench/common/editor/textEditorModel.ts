import { MutableDisposable } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { ITextBufferFactory, ITextModel } from 'mote/editor/common/model';
import { IModelService } from 'mote/editor/common/services/model';
import { IResolvedTextEditorModel } from 'mote/editor/common/services/resolverService';
import { IAccessibilityService } from 'mote/platform/accessibility/common/accessibility';
import { EditorModel } from 'mote/workbench/common/editor/editorModel';

export class BaseTextEditorModel extends EditorModel {

	protected textEditorModelHandle: URI | undefined = undefined;

	private readonly modelDisposeListener = this._register(new MutableDisposable());

	constructor(
		@IModelService protected modelService: IModelService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		textEditorModelHandle?: URI
	) {
		super();

		if (textEditorModelHandle) {
			this.handleExistingModel(textEditorModelHandle);
		}
	}

	private handleExistingModel(textEditorModelHandle: URI): void {

		// We need the resource to point to an existing model
		const model = this.modelService.getModel(textEditorModelHandle);
		if (!model) {
			throw new Error(`Document with resource ${textEditorModelHandle.toString(true)} does not exist`);
		}

		this.textEditorModelHandle = textEditorModelHandle;

		// Make sure we clean up when this model gets disposed
		this.registerModelDisposeListener(model);
	}

	private registerModelDisposeListener(model: ITextModel): void {
		this.modelDisposeListener.value = model.onWillDispose(() => {
			this.textEditorModelHandle = undefined; // make sure we do not dispose code editor model again
			this.dispose();
		});
	}


	get textEditorModel(): ITextModel | null {
		return this.textEditorModelHandle ? this.modelService.getModel(this.textEditorModelHandle) : null;
	}

	isReadonly(): boolean {
		return true;
	}

	/**
	 * Updates the text editor model with the provided value. If the value is the same as the model has, this is a no-op.
	 */
	updateTextEditorModel(newValue?: ITextBufferFactory, preferredLanguageId?: string): void {
		if (!this.isResolved()) {
			return;
		}

		// contents
		if (newValue) {
			this.modelService.updateModel(this.textEditorModel, newValue);
		}
	}

	override isResolved(): this is IResolvedTextEditorModel {
		return !!this.textEditorModelHandle;
	}
}
