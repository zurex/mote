import { localize } from 'mote/nls';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IEditorViewState } from 'mote/editor/common/editorCommon';
import { IContextKeyService } from 'mote/platform/contextkey/common/contextkey';
import { AbstractTextEditor } from 'mote/workbench/browser/parts/editor/textEditor';
import { ITextEditorPane } from 'mote/workbench/common/editor';
import { IEditorOptions as IMoteEditorOptions } from 'mote/editor/common/config/editorOptions';
import { Dimension } from 'mote/base/browser/dom';
import { TextEditorWidget } from 'mote/editor/browser/widget/textEditorWidget';
import { IEditorWidgetOptions } from 'mote/editor/browser/widget/editorWidget';

/**
 * The base class of editors that leverage any kind of text editor for the editing experience.
 */
export abstract class AbstractTextMoteEditor<T extends IEditorViewState> extends AbstractTextEditor<T> implements ITextEditorPane {

	protected editorControl: IMoteEditor | undefined = undefined;

	override get scopedContextKeyService(): IContextKeyService | undefined {
		return this.editorControl?.invokeWithinContext(accessor => accessor.get(IContextKeyService));
	}

	override getTitle(): string {
		if (this.input) {
			return this.input.getName();
		}

		return localize('textEditor', "Text Editor");
	}

	protected createEditorControl(parent: HTMLElement, initialOptions: IMoteEditorOptions): void {
		this.editorControl = this._register(this.instantiationService.createInstance(TextEditorWidget, parent, initialOptions, this.getEditorWidgetOptions()));
	}

	protected getEditorWidgetOptions(): IEditorWidgetOptions {
		return Object.create(null);
	}

	protected getMainControl(): IMoteEditor | undefined {
		return this.editorControl;
	}

	override getControl(): IMoteEditor | undefined {
		return this.editorControl;
	}

	override focus(): void {
		this.editorControl?.focus();
	}

	override hasFocus(): boolean {
		return this.editorControl?.hasTextFocus() || super.hasFocus();
	}

	override layout(dimension: Dimension): void {
		this.editorControl?.layout(dimension);
	}
}
