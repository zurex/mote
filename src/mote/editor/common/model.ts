import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { ISingleEditOperation } from 'mote/editor/common/core/editOperation';
import { EditorRange, IRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IPosition, Position } from 'mote/editor/common/core/position';
import { TextChange } from 'mote/editor/common/core/textChange';
import { IModelContentChange, IModelContentChangedEvent, InternalModelContentChangeEvent, ModelInjectedTextChangedEvent } from 'mote/editor/common/textModelEvents';
import { ITokenizationTextModelPart } from 'mote/editor/common/tokenizationTextModelPart';
import BlockStore from 'mote/platform/store/common/blockStore';
import { UndoRedoGroup } from 'mote/platform/undoRedo/common/undoRedo';
import { URI } from 'vs/base/common/uri';

export const enum PositionAffinity {
	/**
	 * Prefers the left most position.
	*/
	Left = 0,

	/**
	 * Prefers the right most position.
	*/
	Right = 1,

	/**
	 * No preference.
	*/
	None = 2,

	/**
	 * If the given position is on injected text, prefers the position left of it.
	*/
	LeftOfInjectedText = 3,

	/**
	 * If the given position is on injected text, prefers the position right of it.
	*/
	RightOfInjectedText = 4,
}

/**
 * Options for a model decoration.
 */
export interface IModelDecorationOptions {

}

/**
 * New model decorations.
 */
export interface IModelDeltaDecoration {
	/**
	 * Range that this decoration covers.
	 */
	range: IRange;
	/**
	 * Options associated with this decoration.
	 */
	options: IModelDecorationOptions;
}

/**
 * The default end of line to use when instantiating models.
 */
export const enum DefaultEndOfLine {
	/**
	 * Use line feed (\n) as the end of line character.
	 */
	LF = 1,
	/**
	 * Use carriage return and line feed (\r\n) as the end of line character.
	 */
	CRLF = 2
}

/**
 * End of line character preference.
 */
export const enum EndOfLinePreference {
	/**
	 * Use the end of line character identified in the text buffer.
	 */
	TextDefined = 0,
	/**
	 * Use line feed (\n) as the end of line character.
	 */
	LF = 1,
	/**
	 * Use carriage return and line feed (\r\n) as the end of line character.
	 */
	CRLF = 2
}

/**
 * Describes the behavior of decorations when typing/editing near their edges.
 * Note: Please do not edit the values, as they very carefully match `DecorationRangeBehavior`
 */
export const enum TrackedRangeStickiness {
	AlwaysGrowsWhenTypingAtEdges = 0,
	NeverGrowsWhenTypingAtEdges = 1,
	GrowsOnlyWhenTypingBefore = 2,
	GrowsOnlyWhenTypingAfter = 3,
}

/**
 * A model.
 */
export interface ITextModel {
	/**
	 * An event emitted when decorations of the model have changed.
	 * @event
	 */
	readonly onDidChangeDecorations: Event<void>;

	/**
	 * An event emitted when the contents of the model have changed.
	 * @event
	 */
	onDidChangeContent(listener: (e: IModelContentChangedEvent) => void): IDisposable;

	/**
	 * @deprecated Please use `onDidChangeContent` instead.
	 * An event emitted when the contents of the model have changed.
	 * @internal
	 * @event
	 */
	readonly onDidChangeContentOrInjectedText: Event<InternalModelContentChangeEvent | ModelInjectedTextChangedEvent>;

	/**
	 * Gets the resource associated with this editor model.
	 */
	readonly uri: URI;

	/**
	 * Get the current version id of the model.
	 * Anytime a change happens to the model (even undo/redo),
	 * the version id is incremented.
	 */
	getVersionId(): number;

	/**
	 * Get the resolved options for this model.
	 */
	//getOptions(): TextModelResolvedOptions;

	/**
	 * Create a valid position.
	 */
	validatePosition(position: IPosition): Position;

	/**
	 * Get the minimum legal column for line at `lineNumber`
	 */
	getLineMinColumn(lineNumber: number): number;

	/**
	 * Get the maximum legal column for line at `lineNumber`
	 */
	getLineMaxColumn(lineNumber: number): number;

	/**
	 * Get the number of lines in the model.
	 */
	getLineCount(): number;

	/**
	 * Get the text for a certain line.
	 */
	getLineContent(lineNumber: number): string;

	/**
	 * Get the text length for a certain line.
	 */
	getLineLength(lineNumber: number): number;

	getLineStore(lineNumber: number): BlockStore;

	/**
	 * Get the text in a certain range.
	 * @param range The range describing what text to get.
	 * @param eol The end of line character preference. This will only be used for multiline ranges. Defaults to `EndOfLinePreference.TextDefined`.
	 * @return The text.
	 */
	getValueInRange(range: IRange, eol?: EndOfLinePreference): string;

	/**
	 * Get the character count of text in a certain range.
	 * @param range The range describing what text length to get.
	 */
	getCharacterCountInRange(range: IRange, eol?: EndOfLinePreference): number;

	/**
	 * Get the range associated with a decoration.
	 * @param id The decoration id.
	 * @return The decoration range or null if the decoration was not found.
	 */
	getDecorationRange(id: string): EditorRange | null;

	/**
	 * Create a valid range.
	 */
	validateRange(range: IRange): EditorRange;

	/**
	 * Perform a minimum amount of operations, in order to transform the decorations
	 * identified by `oldDecorations` to the decorations described by `newDecorations`
	 * and returns the new identifiers associated with the resulting decorations.
	 *
	 * @param oldDecorations Array containing previous decorations identifiers.
	 * @param newDecorations Array describing what decorations should result after the call.
	 * @return An array containing the new decorations identifiers.
	 */
	deltaDecorations(oldDecorations: string[], newDecorations: IModelDeltaDecoration[]): string[];

	/**
	 * Close the current undo-redo element.
	 * This offers a way to create an undo/redo stop point.
	 */
	pushStackElement(): void;

	/**
	 * Open the current undo-redo element.
	 * This offers a way to remove the current undo/redo stop point.
	 */
	popStackElement(): void;

	/**
	 * Push edit operations, basically editing the model. This is the preferred way
	 * of editing the model. The edit operations will land on the undo stack.
	 * @param beforeCursorState The cursor state before the edit operations. This cursor state will be returned when `undo` or `redo` are invoked.
	 * @param editOperations The edit operations.
	 * @param cursorStateComputer A callback that can compute the resulting cursors state after the edit operations have been executed.
	 * @return The cursor state returned by the `cursorStateComputer`.
	 */
	pushEditOperations(beforeCursorState: EditorSelection[] | null, editOperations: IIdentifiedSingleEditOperation[], cursorStateComputer: ICursorStateComputer): EditorSelection[] | null;
	/**
	 * @internal
	 */
	pushEditOperations(beforeCursorState: EditorSelection[] | null, editOperations: IIdentifiedSingleEditOperation[], cursorStateComputer: ICursorStateComputer, group?: UndoRedoGroup): EditorSelection[] | null;

	/**
	 * @internal
	 */
	_getTrackedRange(id: string): EditorRange | null;

	/**
	 * @internal
	 */
	_setTrackedRange(id: string | null, newRange: null, newStickiness: TrackedRangeStickiness): null;
	/**
	 * @internal
	 */
	_setTrackedRange(id: string | null, newRange: EditorRange, newStickiness: TrackedRangeStickiness): string;

	/**
	 * Returns the count of editors this model is attached to.
	 * @internal
	 */
	getAttachedEditorCount(): number;

	/**
	 * Among all positions that are projected to the same position in the underlying text model as
	 * the given position, select a unique position as indicated by the affinity.
	 *
	 * PositionAffinity.Left:
	 * The normalized position must be equal or left to the requested position.
	 *
	 * PositionAffinity.Right:
	 * The normalized position must be equal or right to the requested position.
	 *
	 * @internal
	 */
	normalizePosition(position: Position, affinity: PositionAffinity): Position;

	/**
	 * @internal
	 */
	readonly tokenization: ITokenizationTextModelPart;
}


/**
 * Configures text that is injected into the view without changing the underlying document.
*/
export interface InjectedTextOptions {
	/**
	 * Sets the text to inject. Must be a single line.
	 */
	readonly content: string;

	/**
	 * If set, the decoration will be rendered inline with the text with this CSS class name.
	 */
	readonly inlineClassName?: string | null;

	/**
	 * If there is an `inlineClassName` which affects letter spacing.
	 */
	readonly inlineClassNameAffectsLetterSpacing?: boolean;

	/**
	 * This field allows to attach data to this injected text.
	 * The data can be read when injected texts at a given position are queried.
	 */
	readonly attachedData?: unknown;

	/**
	 * Configures cursor stops around injected text.
	 * Defaults to {@link InjectedTextCursorStops.Both}.
	*/
	readonly cursorStops?: InjectedTextCursorStops | null;
}

export enum InjectedTextCursorStops {
	Both,
	Right,
	Left,
	None
}

/**
 * An identifier for a single edit operation.
 * @internal
 */
export interface ISingleEditOperationIdentifier {
	/**
	 * Identifier major
	 */
	major: number;
	/**
	 * Identifier minor
	 */
	minor: number;
}

/**
 * A single edit operation, that has an identifier.
 */
export interface IIdentifiedSingleEditOperation extends ISingleEditOperation {
	/**
	 * An identifier associated with this single edit operation.
	 * @internal
	 */
	identifier?: ISingleEditOperationIdentifier | null;
	/**
	 * This indicates that this operation is inserting automatic whitespace
	 * that can be removed on next model edit operation if `config.trimAutoWhitespace` is true.
	 * @internal
	 */
	isAutoWhitespaceEdit?: boolean;
	/**
	 * This indicates that this operation is in a set of operations that are tracked and should not be "simplified".
	 * @internal
	 */
	_isTracked?: boolean;
}

export interface IValidEditOperation {
	/**
	 * An identifier associated with this single edit operation.
	 * @internal
	 */
	identifier: ISingleEditOperationIdentifier | null;
	/**
	 * The range to replace. This can be empty to emulate a simple insert.
	 */
	range: EditorRange;
	/**
	 * The text to replace with. This can be empty to emulate a simple delete.
	 */
	text: string;
	/**
	 * @internal
	 */
	textChange: TextChange;
}

/**
 * @internal
 */
export class ValidAnnotatedEditOperation implements IIdentifiedSingleEditOperation {
	constructor(
		public readonly identifier: ISingleEditOperationIdentifier | null,
		public readonly range: EditorRange,
		public readonly text: string | null,
		public readonly forceMoveMarkers: boolean,
		public readonly isAutoWhitespaceEdit: boolean,
		public readonly _isTracked: boolean,
	) { }
}

/**
 * A callback that can compute the cursor state after applying a series of edit operations.
 */
export interface ICursorStateComputer {
	/**
	 * A callback that can compute the resulting cursors state after some edit operations have been executed.
	 */
	(inverseEditOperations: IValidEditOperation[]): EditorSelection[] | null;
}

/**
 * @internal
 */
export interface ITextModelCreationOptions {
	tabSize: number;
	indentSize: number | 'tabSize';
	insertSpaces: boolean;
	detectIndentation: boolean;
	trimAutoWhitespace: boolean;
	defaultEOL: DefaultEndOfLine;
	isForSimpleWidget: boolean;
	largeFileOptimizations: boolean;
	bracketPairColorizationOptions: BracketPairColorizationOptions;
}

export interface BracketPairColorizationOptions {
	enabled: boolean;
	independentColorPoolPerBracketType: boolean;
}

/**
 * @internal
 *
 * `lineNumber` is 1 based.
 */
export interface IReadonlyTextBuffer {

	getLineCount(): number;
	getLineLength(lineNumber: number): number;
	getLineContent(lineNumber: number): string;

	getLineStore(lineNumber: number): BlockStore;

	getValueInRange(range: EditorRange, eol: EndOfLinePreference): string;
	getCharacterCountInRange(range: EditorRange, eol: EndOfLinePreference): number;

	getEOL(): string;
}

/**
 * @internal
 */
export interface ITextBuffer extends IReadonlyTextBuffer {

	applyEdits(rawOperations: ValidAnnotatedEditOperation[], recordTrimAutoWhitespace: boolean, computeUndoEdits: boolean): ApplyEditsResult;
}

/**
 * @internal
 */
export class ApplyEditsResult {

	constructor(
		public readonly reverseEdits: IValidEditOperation[] | null,
		public readonly changes: IInternalModelContentChange[],
		public readonly trimAutoWhitespaceLineNumbers: number[] | null
	) { }

}

/**
 * @internal
 */
export interface IInternalModelContentChange extends IModelContentChange {
	range: EditorRange;
	forceMoveMarkers: boolean;
}
