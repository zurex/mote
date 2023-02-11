import { localize } from 'mote/nls';
import { Emitter } from 'mote/base/common/event';
import { IEditorViewState } from 'mote/editor/common/editorCommon';
import { IStorageService } from 'mote/platform/storage/common/storage';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { AbstractEditorWithViewState } from 'mote/workbench/browser/parts/editor/editorWithViewState';
import { EditorInputCapabilities, IEditorOpenContext, IEditorPaneSelectionChangeEvent, IEditorPaneWithSelection } from 'mote/workbench/common/editor';
import { IEditorOptions as IMoteEditorOptions } from 'mote/editor/common/config/editorOptions';
import { assertIsDefined, isObject } from 'mote/base/common/types';
import { deepClone } from 'mote/base/common/objects';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { computeEditorAriaLabel } from 'mote/workbench/browser/editor';
import { ITextResourceConfigurationService } from 'mote/editor/common/services/textResourceConfiguration';
import { URI } from 'mote/base/common/uri';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IEditorGroupsService } from 'mote/workbench/services/editor/common/editorGroupsService';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { ITextEditorOptions } from 'mote/platform/editor/common/editor';
import { CancellationToken } from 'mote/base/common/cancellation';

/**
 * The base class of editors that leverage any kind of text editor for the editing experience.
 */
export abstract class AbstractTextEditor<T extends IEditorViewState> extends AbstractEditorWithViewState<T> implements IEditorPaneWithSelection {

	private static readonly VIEW_STATE_PREFERENCE_KEY = 'textEditorViewState';

	protected readonly _onDidChangeSelection = this._register(new Emitter<IEditorPaneSelectionChangeEvent>());
	readonly onDidChangeSelection = this._onDidChangeSelection.event;

	private editorContainer: HTMLElement | undefined;

	private lastAppliedEditorOptions?: IMoteEditorOptions;

	constructor(
		id: string,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
	) {
		super(id, AbstractTextEditor.VIEW_STATE_PREFERENCE_KEY, instantiationService, storageService, themeService, textResourceConfigurationService, editorGroupService);
	}

	protected computeConfiguration(configuration: IEditorConfiguration): IMoteEditorOptions {

		// Specific editor options always overwrite user configuration
		const editorConfiguration: IMoteEditorOptions = isObject(configuration.editor) ? deepClone(configuration.editor) : Object.create(null);
		Object.assign(editorConfiguration, this.getConfigurationOverrides());

		// ARIA label
		editorConfiguration.ariaLabel = this.computeAriaLabel();

		return editorConfiguration;
	}

	private computeAriaLabel(): string {
		return this._input ? computeEditorAriaLabel(this._input, undefined, this.group, this.editorGroupService.count) : localize('editor', "Editor");
	}

	protected getConfigurationOverrides(): IMoteEditorOptions {
		const readOnly = this.input?.hasCapability(EditorInputCapabilities.Readonly);

		return {
			//overviewRulerLanes: 3,
			lineNumbersMinChars: 3,
			fixedOverflowWidgets: true,
			readOnly,
			renderValidationDecorations: 'on' // render problems even in readonly editors (https://github.com/microsoft/vscode/issues/89057)
		};
	}

	protected createEditor(parent: HTMLElement): void {

		// Create editor control
		this.editorContainer = parent;
		this.createEditorControl(parent, this.computeConfiguration(this.textResourceConfigurationService.getValue<IEditorConfiguration>(this.getActiveResource())));

	}

	/**
	 * This method creates and returns the text editor control to be used.
	 * Subclasses must override to provide their own editor control that
	 * should be used (e.g. a text diff editor).
	 *
	 * The passed in configuration object should be passed to the editor
	 * control when creating it.
	 */
	protected abstract createEditorControl(parent: HTMLElement, initialOptions: IMoteEditorOptions): void;

	/**
	 * This method returns the main, dominant instance of `ICodeEditor`
	 * for the editor pane. E.g. for a diff editor, this is the right
	 * hand (modified) side.
	 */
	protected abstract getMainControl(): IMoteEditor | undefined;

	override async setInput(input: EditorInput, options: ITextEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		// Update aria label on editor
		const editorContainer = assertIsDefined(this.editorContainer);
		editorContainer.setAttribute('aria-label', this.computeAriaLabel());
	}

	private getActiveResource(): URI | undefined {
		const mainControl = this.getMainControl();
		if (mainControl) {
			const model = mainControl.getModel();
			if (model) {
				return model.uri;
			}
		}

		if (this.input) {
			return this.input.resource;
		}

		return undefined;
	}

	override dispose(): void {
		this.lastAppliedEditorOptions = undefined;

		super.dispose();
	}
}
