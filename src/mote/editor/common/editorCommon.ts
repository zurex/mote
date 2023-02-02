import { IRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { ITextModel, IValidEditOperation } from 'mote/editor/common/model';
import { IDisposable } from 'mote/base/common/lifecycle';
import { IDimension } from 'mote/editor/common/core/dimension';

/**
 * A builder and helper for edit operations for a command.
 */
export interface IEditOperationBuilder {
	/**
	 * Add a new edit operation (a replace operation).
	 * @param range The range to replace (delete). May be empty to represent a simple insert.
	 * @param text The text to replace with. May be null to represent a simple delete.
	 */
	addEditOperation(range: IRange, text: string | null, forceMoveMarkers?: boolean): void;

	/**
	 * Add a new edit operation (a replace operation).
	 * The inverse edits will be accessible in `ICursorStateComputerData.getInverseEditOperations()`
	 * @param range The range to replace (delete). May be empty to represent a simple insert.
	 * @param text The text to replace with. May be null to represent a simple delete.
	 */
	addTrackedEditOperation(range: IRange, text: string | null, forceMoveMarkers?: boolean): void;

	/**
	 * Track `selection` when applying edit operations.
	 * A best effort will be made to not grow/expand the selection.
	 * An empty selection will clamp to a nearby character.
	 * @param selection The selection to track.
	 * @param trackPreviousOnEmpty If set, and the selection is empty, indicates whether the selection
	 *           should clamp to the previous or the next character.
	 * @return A unique identifier.
	 */
	trackSelection(selection: EditorSelection, trackPreviousOnEmpty?: boolean): string;
}

/**
 * A helper for computing cursor state after a command.
 */
export interface ICursorStateComputerData {
	/**
	 * Get the inverse edit operations of the added edit operations.
	 */
	getInverseEditOperations(): IValidEditOperation[];
	/**
	 * Get a previously tracked selection.
	 * @param id The unique identifier returned by `trackSelection`.
	 * @return The selection.
	 */
	getTrackedSelection(id: string): EditorSelection;
}

/**
 * A command that modifies text / cursor state on a model.
 */
export interface ICommand {

	/**
	 * Signal that this command is inserting automatic whitespace that should be trimmed if possible.
	 * @internal
	 */
	readonly insertsAutoWhitespace?: boolean;

	readonly annotation?: [string];

	readonly blockType?: string;

	/**
	 * Get the edit operations needed to execute this command.
	 * @param model The model the command will execute on.
	 * @param builder A helper to collect the needed edit operations and to track selections.
	 */
	getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void;

	/**
	 * Compute the cursor state after the edit operations were applied.
	 * @param model The model the command has executed on.
	 * @param helper A helper to get inverse edit operations and to get previously tracked selections.
	 * @return The cursor state after the command executed.
	 */
	computeCursorState(model: ITextModel, helper: ICursorStateComputerData): EditorSelection;
}

/**
 * An editor contribution that gets created every time a new editor gets created and gets disposed when the editor gets disposed.
 */
export interface IEditorContribution {
	/**
	 * Dispose this contribution.
	 */
	dispose(): void;
	/**
	 * Store view state.
	 */
	//saveViewState?(): any;
	/**
	 * Restore view state.
	 */
	//restoreViewState?(state: any): void;
}

export interface IEditorAction {
	readonly id: string;
	readonly label: string;
	readonly alias: string;
	isSupported(): boolean;
	run(): Promise<void>;
}

export const enum ScrollType {
	Smooth = 0,
	Immediate = 1,
}

/**
 * An editor.
 */
export interface IEditor {
	/**
	 * An event emitted when the editor has been disposed.
	 * @event
	 */
	onDidDispose(listener: () => void): IDisposable;

	/**
	 * Dispose the editor.
	 */
	dispose(): void;

	/**
	 * Get a unique id for this editor instance.
	 */
	getId(): string;

	/**
	 * Get the editor type. Please see `EditorType`.
	 * This is to avoid an instanceof check
	 */
	getEditorType(): string;

	/**
	 * Indicates that the editor becomes hidden.
	 * @internal
	 */
	onHide(): void;

	/**
	 * Instructs the editor to remeasure its container. This method should
	 * be called when the container of the editor gets resized.
	 *
	 * If a dimension is passed in, the passed in value will be used.
	 */
	layout(dimension?: IDimension): void;

	/**
	 * Brings browser focus to the editor text
	 */
	focus(): void;

	/**
	 * Returns the primary selection of the editor.
	 */
	getSelection(): EditorSelection | null;

	/**
	 * Returns all the selections of the editor.
	 */
	getSelections(): EditorSelection[] | null;

	/**
	 * Directly trigger a handler or an editor action.
	 * @param source The source of the call.
	 * @param handlerId The id of the handler or the id of a contribution.
	 * @param payload Extra data to be sent to the handler.
	 */
	trigger(source: string | null | undefined, handlerId: string, payload: any): void;


	/**
	 * Gets the current model attached to this editor.
	 */
	//getModel(): IEditorModel | null;

	/**
	 * Sets the current model attached to this editor.
	 * If the previous model was created by the editor via the value key in the options
	 * literal object, it will be destroyed. Otherwise, if the previous model was set
	 * via setModel, or the model key in the options literal object, the previous model
	 * will not be destroyed.
	 * It is safe to call setModel(null) to simply detach the current model from the editor.
	 */
	//setModel(model: IEditorModel | null): void;

	/**
	 * Create a collection of decorations. All decorations added through this collection
	 * will get the ownerId of the editor (meaning they will not show up in other editors).
	 * These decorations will be automatically cleared when the editor's model changes.
	 */
	//createDecorationsCollection(decorations?: IModelDeltaDecoration[]): IEditorDecorationsCollection;

	/**
	 * Change the decorations. All decorations added through this changeAccessor
	 * will get the ownerId of the editor (meaning they will not show up in other
	 * editors).
	 * @see {@link ITextModel.changeDecorations}
	 * @internal
	 */
	//changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any): any;
}

/**
 * The type of the `IEditor`.
 */
export const EditorType = {
	IDocumentEditor: 'mote.editor.IDocumentEditor',
	ICollectionEditor: 'mote.editor.ICollectionEditor'
};

/**
 * Built-in commands.
 * @internal
 */
export const enum Handler {
	CompositionStart = 'compositionStart',
	CompositionEnd = 'compositionEnd',
	Type = 'type',
	Decorate = 'decorate',
	ReplacePreviousChar = 'replacePreviousChar',
	CompositionType = 'compositionType',
	Paste = 'paste',
	Cut = 'cut',
}
