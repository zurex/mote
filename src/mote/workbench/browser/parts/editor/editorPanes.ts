import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { IEditorPaneDescriptor, IEditorPaneRegistry } from 'mote/workbench/browser/editor';
import { DEFAULT_EDITOR_MAX_DIMENSIONS, DEFAULT_EDITOR_MIN_DIMENSIONS } from 'mote/workbench/browser/parts/editor/editor';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { EditorExtensions, IEditorOpenContext } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { Dimension, hide, IDomNodePagePosition, show } from 'mote/base/browser/dom';
import { Disposable } from 'mote/base/common/lifecycle';
import { assertIsDefined } from 'mote/base/common/types';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { Registry } from 'mote/platform/registry/common/platform';

export interface IOpenEditorResult {

	/**
	 * The editor pane used for opening. This can be a generic
	 * placeholder in certain cases, e.g. when workspace trust
	 * is required, or an editor fails to restore.
	 *
	 * Will be `undefined` if an error occurred while trying to
	 * open the editor and in cases where no placeholder is being
	 * used.
	 */
	readonly pane?: EditorPane;

	/**
	 * Whether the editor changed as a result of opening.
	 */
	readonly changed?: boolean;

	/**
	 * This property is set when an editor fails to restore and
	 * is shown with a generic place holder. It allows callers
	 * to still present the error to the user in that case.
	 */
	readonly error?: Error;

	/**
	 * This property indicates whether the open editor operation was
	 * cancelled or not. The operation may have been cancelled
	 * in case another editor open operation was triggered right
	 * after cancelling this one out.
	 */
	readonly cancelled?: boolean;
}

export class EditorPanes extends Disposable {

	get minimumWidth() { return this._activeEditorPane?.minimumWidth ?? DEFAULT_EDITOR_MIN_DIMENSIONS.width; }
	get minimumHeight() { return this._activeEditorPane?.minimumHeight ?? DEFAULT_EDITOR_MIN_DIMENSIONS.height; }
	get maximumWidth() { return this._activeEditorPane?.maximumWidth ?? DEFAULT_EDITOR_MAX_DIMENSIONS.width; }
	get maximumHeight() { return this._activeEditorPane?.maximumHeight ?? DEFAULT_EDITOR_MAX_DIMENSIONS.height; }

	private _activeEditorPane: EditorPane | null = null;
	get activeEditorPane(): EditorPane | null { return this._activeEditorPane || null; }


	private readonly editorPanes: EditorPane[] = [];
	private dimension: Dimension | undefined;
	private pagePosition: IDomNodePagePosition | undefined;
	private readonly editorPanesRegistry = Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane);

	constructor(
		private parent: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
	}

	async openEditor(editor: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext = Object.create(null)): Promise<IOpenEditorResult> {
		const editorPaneDescriptor = this.getEditorPaneDescriptor(editor);
		return await this.doOpenEditor(editorPaneDescriptor, editor, options);
	}

	closeEditor(editor?: EditorInput): void {
		if (this._activeEditorPane?.input) {
			this.doHideActiveEditorPane();
		}
	}


	async doOpenEditor(descriptor: IEditorPaneDescriptor, editor: EditorInput, options: IEditorOptions | undefined) {
		// Editor pane
		const pane = this.doShowEditorPane(descriptor);

		// Apply input to pane
		const { changed, cancelled } = await this.doSetInput(pane, editor, options);

		return { pane, changed, cancelled };
	}

	private async doSetInput(editorPane: EditorPane, editor: EditorInput, options: IEditorOptions | undefined) {
		// If the input did not change, return early and only
		// apply the options unless the options instruct us to
		// force open it even if it is the same
		const inputMatches = editorPane.input?.matches(editor);

		let cancelled = false;
		try {

			// Clear the current input before setting new input
			// This ensures that a slow loading input will not
			// be visible for the duration of the new input to
			// load (https://github.com/microsoft/vscode/issues/34697)
			//editorPane.clearInput();

			// Set the input to the editor pane
			await editorPane.setInput(editor, options);

			/*
			if (!operation.isCurrent()) {
				cancelled = true;
			}
			*/
		} finally {
			//operation.stop();
		}

		return { changed: !inputMatches, cancelled };
	}

	private getEditorPaneDescriptor(editor: EditorInput): IEditorPaneDescriptor {
		return assertIsDefined(this.editorPanesRegistry.getEditorPane(editor));
	}

	private doShowEditorPane(descriptor: IEditorPaneDescriptor) {

		// Hide active one first
		this.doHideActiveEditorPane();

		// Create editor pane
		const editorPane = this.doCreateEditorPane(descriptor);

		// Set editor as active
		this.doSetActiveEditorPane(editorPane);

		// Show editor
		const container = assertIsDefined(editorPane.getContainer());
		this.parent.appendChild(container);
		show(container);

		// Layout
		if (this.dimension) {
			editorPane.layout(this.dimension);
		}


		return editorPane;
	}

	private doCreateEditorPane(descriptor: IEditorPaneDescriptor): EditorPane {

		// Instantiate editor
		const editorPane = this.doInstantiateEditorPane(descriptor);

		// Create editor container as needed
		if (!editorPane.getContainer()) {
			const editorPaneContainer = document.createElement('div');
			editorPaneContainer.classList.add('editor-instance');

			editorPane.create(editorPaneContainer);
		}

		return editorPane;
	}

	private doInstantiateEditorPane(descriptor: IEditorPaneDescriptor): EditorPane {

		// Return early if already instantiated
		const existingEditorPane = this.editorPanes.find(editorPane => descriptor.describes(editorPane));
		if (existingEditorPane) {
			return existingEditorPane;
		}

		// Otherwise instantiate new
		const editorPane = this._register(descriptor.instantiate(this.instantiationService));
		this.editorPanes.push(editorPane);

		return editorPane;
	}

	private doHideActiveEditorPane(): void {
		if (!this._activeEditorPane) {
			return;
		}

		// Stop any running operation
		//this.editorOperation.stop();

		// Indicate to editor pane before removing the editor from
		// the DOM to give a chance to persist certain state that
		// might depend on still being the active DOM element.
		//this._activeEditorPane.clearInput();
		//this._activeEditorPane.setVisible(false, this.groupView);

		// Remove editor pane from parent
		const editorPaneContainer = this._activeEditorPane.getContainer();
		if (editorPaneContainer) {
			this.parent.removeChild(editorPaneContainer);
			hide(editorPaneContainer);
		}

		// Clear active editor pane
		this.doSetActiveEditorPane(null);
	}

	private doSetActiveEditorPane(editorPane: EditorPane | null) {
		this._activeEditorPane = editorPane;
		/*

		// Clear out previous active editor pane listeners
		this.activeEditorPaneDisposables.clear();

		// Listen to editor pane changes
		if (editorPane) {
			this.activeEditorPaneDisposables.add(editorPane.onDidChangeSizeConstraints(e => this._onDidChangeSizeConstraints.fire(e)));
			this.activeEditorPaneDisposables.add(editorPane.onDidFocus(() => this._onDidFocus.fire()));
		}

		// Indicate that size constraints could have changed due to new editor
		this._onDidChangeSizeConstraints.fire(undefined);
		*/
	}

	layout(pagePosition: IDomNodePagePosition): void {
		this.pagePosition = pagePosition;
		this.dimension = new Dimension(pagePosition.width, pagePosition.height);

		this._activeEditorPane?.layout(new Dimension(pagePosition.width, pagePosition.height));
	}
}
