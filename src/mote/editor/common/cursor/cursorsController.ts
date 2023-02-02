import * as strings from 'mote/base/common/strings';
import { Disposable } from 'mote/base/common/lifecycle';
import { CursorConfiguration, CursorState, EditOperationResult, EditOperationType, IColumnSelectData, ICursorSimpleModel, PartialCursorState } from 'mote/editor/common/cursorCommon';
import { CursorChangeReason } from 'mote/editor/common/cursorEvents';
import { IIdentifiedSingleEditOperation, ITextModel, IValidEditOperation, TrackedRangeStickiness } from 'mote/editor/common/model';
import * as editorCommon from 'mote/editor/common/editorCommon';
import { CursorStateChangedEvent, ViewModelEventsCollector } from 'mote/editor/common/viewModelEventDispatcher';
import { CompositionOutcome, TypeOperations } from 'mote/editor/common/cursor/cursorTypeOperations';
import { EditorSelection, ISelection, SelectionDirection } from 'mote/editor/common/core/editorSelection';
import { EditorRange, IRange } from 'mote/editor/common/core/editorRange';
import { CursorContext } from 'mote/editor/common/cursor/cursorContext';
import { ICoordinatesConverter } from 'mote/editor/common/viewModel';
import { CursorCollection } from 'mote/editor/common/cursor/cursorCollection';
import { onUnexpectedError } from 'mote/base/common/errors';
import { VerticalRevealType, ViewCursorStateChangedEvent, ViewRevealRangeRequestEvent } from 'mote/editor/common/viewEvents';
import { ReplaceCommand, ReplaceCommandWithAnnotation, ReplaceCommandWithBlockType } from 'mote/editor/common/commands/replaceCommand';
import { BlockType, BlockTypes } from 'mote/platform/store/common/record';

export class CursorsController extends Disposable {

	public context: CursorContext;

	private cursors: CursorCollection;

	private _hasFocus: boolean;
	private _isHandling: boolean;
	private _compositionState: CompositionState | null;
	private _autoClosedActions: AutoClosedAction[];
	private _prevEditOperationType: EditOperationType;
	private _columnSelectData: IColumnSelectData | null;

	constructor(
		private readonly model: ITextModel,
		private readonly viewModel: ICursorSimpleModel,
		private readonly coordinatesConverter: ICoordinatesConverter,
		cursorConfig: CursorConfiguration
	) {
		super();

		this._hasFocus = false;
		this._isHandling = false;
		this._compositionState = null;
		this._autoClosedActions = [];
		this._columnSelectData = null;
		this._prevEditOperationType = EditOperationType.Other;

		this.context = new CursorContext(this.model, this.viewModel, this.coordinatesConverter, cursorConfig);
		this.cursors = new CursorCollection(this.context);
	}

	//#region Setter/Getter

	public setHasFocus(hasFocus: boolean): void {
		this._hasFocus = hasFocus;
	}

	public getPrevEditOperationType(): EditOperationType {
		return this._prevEditOperationType;
	}

	public setPrevEditOperationType(type: EditOperationType): void {
		this._prevEditOperationType = type;
	}

	public getSelection(): EditorSelection {
		return this.cursors.getPrimaryCursor().modelState.selection;
	}

	public getSelections(): EditorSelection[] {
		return this.cursors.getSelections();
	}

	public setSelections(eventsCollector: ViewModelEventsCollector, source: string | null | undefined, selections: readonly ISelection[], reason: CursorChangeReason): void {
		this.setStates(eventsCollector, source, reason, CursorState.fromModelSelections(selections));
	}

	public getPrimaryCursorState(): CursorState {
		return this.cursors.getPrimaryCursor();
	}

	public getCursorStates(): CursorState[] {
		return this.cursors.getAll();
	}

	public getAutoClosedCharacters(): EditorRange[] {
		return AutoClosedAction.getAllAutoClosedCharacters(this._autoClosedActions);
	}

	public setStates(eventsCollector: ViewModelEventsCollector, source: string | null | undefined, reason: CursorChangeReason, states: PartialCursorState[] | null): boolean {
		let reachedMaxCursorCount = false;
		const multiCursorLimit = this.context.cursorConfig.multiCursorLimit;
		if (states !== null && states.length > multiCursorLimit) {
			states = states.slice(0, multiCursorLimit);
			reachedMaxCursorCount = true;
		}

		const oldState = CursorModelState.from(this.model, this);

		this.cursors.setStates(states);
		this.cursors.normalize();
		this._columnSelectData = null;

		this.validateAutoClosedActions();

		return this.emitStateChangedIfNecessary(eventsCollector, source, reason, oldState, reachedMaxCursorCount);
	}

	public revealPrimary(eventsCollector: ViewModelEventsCollector, source: string | null | undefined, minimalReveal: boolean, verticalType: VerticalRevealType, revealHorizontal: boolean, scrollType: editorCommon.ScrollType): void {
		const viewPositions = this.cursors.getViewPositions();

		let revealViewRange: EditorRange | null = null;
		let revealViewSelections: EditorSelection[] | null = null;
		if (viewPositions.length > 1) {
			revealViewSelections = this.cursors.getViewSelections();
		} else {
			revealViewRange = EditorRange.fromPositions(viewPositions[0], viewPositions[0]);
		}

		eventsCollector.emitViewEvent(new ViewRevealRangeRequestEvent(source, minimalReveal, revealViewRange, revealViewSelections, verticalType, revealHorizontal, scrollType));
	}

	//#endregion

	//#region Edit

	public type(eventsCollector: ViewModelEventsCollector, text: string, source?: string | null | undefined): void {
		this.executeEdit(() => {
			if (source === 'keyboard') {
				// If this event is coming straight from the keyboard, look for electric characters and enter

				const len = text.length;
				let offset = 0;
				while (offset < len) {
					const charLength = strings.nextCharLength(text, offset);
					const chr = text.substr(offset, charLength);

					// Here we must interpret each typed character individually
					this.executeEditOperation(TypeOperations.typeWithInterceptors(
						!!this._compositionState, this._prevEditOperationType, this.context.cursorConfig,
						this.model, this.getSelections(), this.getAutoClosedCharacters(), chr));

					offset += charLength;
				}
			} else {
				this.executeEditOperation(TypeOperations.typeWithoutInterceptors(this._prevEditOperationType, this.context.cursorConfig, this.model, this.getSelections(), text));
			}
		}, eventsCollector, source);
	}

	public compositionType(eventsCollector: ViewModelEventsCollector, text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number, source?: string | null | undefined): void {
		if (text.length === 0 && replacePrevCharCnt === 0 && replaceNextCharCnt === 0) {
			// this edit is a no-op
			if (positionDelta !== 0) {
				// but it still wants to move the cursor
				const newSelections = this.getSelections().map(selection => {
					const position = selection.getPosition();
					return new EditorSelection(position.lineNumber, position.column + positionDelta, position.lineNumber, position.column + positionDelta);
				});
				this.setSelections(eventsCollector, source, newSelections, CursorChangeReason.NotSet);
			}
			return;
		}
		this.executeEdit(() => {
			this.executeEditOperation(TypeOperations.compositionType(this._prevEditOperationType, this.context.cursorConfig, this.model, this.getSelections(), text, replacePrevCharCnt, replaceNextCharCnt, positionDelta));
		}, eventsCollector, source);
	}

	public executeCommands(eventsCollector: ViewModelEventsCollector, commands: editorCommon.ICommand[], source?: string | null | undefined): void {
		this.executeEdit(() => {
			this.executeEditOperation(new EditOperationResult(EditOperationType.Other, commands, {
				shouldPushStackElementBefore: false,
				shouldPushStackElementAfter: false
			}));
		}, eventsCollector, source);
	}

	private executeEdit(callback: () => void, eventsCollector: ViewModelEventsCollector, source: string | null | undefined, cursorChangeReason: CursorChangeReason = CursorChangeReason.NotSet): void {
		const oldState = CursorModelState.from(this.model, this);
		//this._cursors.stopTrackingSelections();
		this._isHandling = true;

		try {
			this.cursors.ensureValidState();
			callback();
		} catch (err) {
			onUnexpectedError(err);
		}

		this._isHandling = false;
		this.validateAutoClosedActions();
		if (this.emitStateChangedIfNecessary(eventsCollector, source, cursorChangeReason, oldState, false)) {
			this.revealPrimary(eventsCollector, source, false, VerticalRevealType.Simple, true, editorCommon.ScrollType.Smooth);
		}
	}

	private executeEditOperation(opResult: EditOperationResult | null): void {
		if (!opResult) {
			// Nothing to execute
			return;
		}

		const result = CommandExecutor.executeCommands(this.model, this.cursors.getSelections(), opResult.commands);
		//console.log('[Cursor] executeEditOperation', opResult, result);
		if (result) {
			// The commands were applied correctly
			this._interpretCommandResult(result);

			// Check for markdown
			this.handleBlockMarkdown(/^\[\]$/, () => BlockTypes.todo);
			this.handleBlockMarkdown(/^[-\*\+] $/, () => BlockTypes.bulletedList);
			this.handleInlineMarkdown('`', ['c']);
			this.handleInlineMarkdown('**', ['b']);
			this.handleInlineMarkdown('*', ['i']);
			this.handleInlineMarkdown('~', ['s']);

			this._prevEditOperationType = opResult.type;
		}

		if (opResult.shouldPushStackElementAfter) {
			this.model.pushStackElement();
		}
	}

	private _interpretCommandResult(cursorState: EditorSelection[] | null): void {
		if (!cursorState || cursorState.length === 0) {
			cursorState = this.cursors.readSelectionFromMarkers();
		}

		this._columnSelectData = null;
		this.cursors.setSelections(cursorState);
		this.cursors.normalize();
	}

	//#endregion

	//#region markdown part

	private handleBlockMarkdown(matchRegex: RegExp, toBlockType: () => string) {
		const selection = this.getSelection();
		const lineContent = this.model.getLineContent(selection.startLineNumber);
		// Try to get matched markdown tag
		const markdownTag = matchRegex.exec(lineContent);
		if (!markdownTag) {
			return false;
		}
		const endIndex = markdownTag[0].length || 0;
		const markdownSelection = new EditorSelection(selection.startLineNumber, 0, selection.endLineNumber, endIndex + 1);
		const blockType = toBlockType();
		const command = new ReplaceCommandWithBlockType(markdownSelection, '', blockType);
		this.executeEditOperation(new EditOperationResult(EditOperationType.Other, [command], {
			shouldPushStackElementBefore: false,
			shouldPushStackElementAfter: false
		}));
		return true;
	}

	/**
	 * Hanlde markdown input
	 * TODO: move this part to post processor
	 * @param delimiter
	 * @param annotation
	 * @returns
	 */
	private handleInlineMarkdown(delimiter: string, annotation: [string]) {
		const selection = this.getSelection();
		const lineContent = this.model.getLineContent(selection.startLineNumber);

		const parseResult = this.parseMarkdownTag(delimiter, lineContent, selection.endColumn);
		if (!parseResult) {
			return;
		}
		const markdownSelection = new EditorSelection(selection.startLineNumber, parseResult.startIndex, selection.endLineNumber, parseResult.endIndex);
		const command = new ReplaceCommandWithAnnotation(markdownSelection, parseResult.matchString, annotation);
		this.executeEditOperation(new EditOperationResult(EditOperationType.Other, [command], {
			shouldPushStackElementBefore: false,
			shouldPushStackElementAfter: false
		}));
	}

	private parseMarkdownTag(delimiter: string, lineContent: string, endColumn: number) {
		const textValue = lineContent.substring(0, endColumn);
		const lineParts = textValue.split(delimiter);
		if (lineParts.length <= 2) {
			return;
		}
		lineParts.reverse();
		const [matchString] = lineParts.slice(1);

		if (!matchString) {
			return;
		}

		if (lineParts.length > 3 && !lineParts[2]) {
			// case: contentBeforeMatch|delimiter|delimiter|matchString|delimiter
			return;
		}

		const startIndex = endColumn - matchString.length - 2 * delimiter.length;

		return {
			textValue: textValue,
			matchString: matchString,
			startIndex: startIndex,
			endIndex: endColumn
		};
	}

	//#endregion

	private emitStateChangedIfNecessary(
		eventsCollector: ViewModelEventsCollector,
		source: string | null | undefined,
		reason: CursorChangeReason,
		oldState: CursorModelState | null,
		reachedMaxCursorCount: boolean
	): boolean {
		const newState = CursorModelState.from(this.model, this);
		if (newState.equals(oldState)) {
			return false;
		}

		const selections = this.cursors.getSelections();
		const viewSelections = this.cursors.getViewSelections();

		// Let the view get the event first.
		eventsCollector.emitViewEvent(new ViewCursorStateChangedEvent(viewSelections, selections, reason));

		// Only after the view has been notified, let the rest of the world know...
		if (!oldState
			|| oldState.cursorState.length !== newState.cursorState.length
			|| newState.cursorState.some((newCursorState, i) => !newCursorState.modelState.equals(oldState.cursorState[i].modelState))
		) {
			const oldSelections = oldState ? oldState.cursorState.map(s => s.modelState.selection) : null;
			const oldModelVersionId = oldState ? oldState.modelVersionId : 0;
			eventsCollector.emitOutgoingEvent(new CursorStateChangedEvent(oldSelections, selections, oldModelVersionId, newState.modelVersionId, source || 'keyboard', reason, reachedMaxCursorCount));
		}

		return true;
	}

	private validateAutoClosedActions(): void {
		if (this._autoClosedActions.length > 0) {
			const selections: EditorRange[] = this.cursors.getSelections();
			for (let i = 0; i < this._autoClosedActions.length; i++) {
				const autoClosedAction = this._autoClosedActions[i];
				if (!autoClosedAction.isValid(selections)) {
					autoClosedAction.dispose();
					this._autoClosedActions.splice(i, 1);
					i--;
				}
			}
		}
	}
}

/**
 * A snapshot of the cursor and the model state
 */
class CursorModelState {
	public static from(model: ITextModel, cursor: CursorsController): CursorModelState {
		return new CursorModelState(model.getVersionId(), cursor.getCursorStates());
	}

	constructor(
		public readonly modelVersionId: number,
		public readonly cursorState: CursorState[],
	) {
	}

	public equals(other: CursorModelState | null): boolean {
		if (!other) {
			return false;
		}
		if (this.modelVersionId !== other.modelVersionId) {
			return false;
		}
		if (this.cursorState.length !== other.cursorState.length) {
			return false;
		}
		for (let i = 0, len = this.cursorState.length; i < len; i++) {
			if (!this.cursorState[i].equals(other.cursorState[i])) {
				return false;
			}
		}
		return true;
	}
}

class AutoClosedAction {

	public static getAllAutoClosedCharacters(autoClosedActions: AutoClosedAction[]): EditorRange[] {
		let autoClosedCharacters: EditorRange[] = [];
		for (const autoClosedAction of autoClosedActions) {
			autoClosedCharacters = autoClosedCharacters.concat(autoClosedAction.getAutoClosedCharactersRanges());
		}
		return autoClosedCharacters;
	}

	private readonly _model: ITextModel;

	private _autoClosedCharactersDecorations: string[];
	private _autoClosedEnclosingDecorations: string[];

	constructor(model: ITextModel, autoClosedCharactersDecorations: string[], autoClosedEnclosingDecorations: string[]) {
		this._model = model;
		this._autoClosedCharactersDecorations = autoClosedCharactersDecorations;
		this._autoClosedEnclosingDecorations = autoClosedEnclosingDecorations;
	}

	public dispose(): void {
		this._autoClosedCharactersDecorations = this._model.deltaDecorations(this._autoClosedCharactersDecorations, []);
		this._autoClosedEnclosingDecorations = this._model.deltaDecorations(this._autoClosedEnclosingDecorations, []);
	}

	public getAutoClosedCharactersRanges(): EditorRange[] {
		const result: EditorRange[] = [];
		for (let i = 0; i < this._autoClosedCharactersDecorations.length; i++) {
			const decorationRange = this._model.getDecorationRange(this._autoClosedCharactersDecorations[i]);
			if (decorationRange) {
				result.push(decorationRange);
			}
		}
		return result;
	}

	public isValid(selections: EditorRange[]): boolean {
		const enclosingRanges: EditorRange[] = [];
		for (let i = 0; i < this._autoClosedEnclosingDecorations.length; i++) {
			const decorationRange = this._model.getDecorationRange(this._autoClosedEnclosingDecorations[i]);
			if (decorationRange) {
				enclosingRanges.push(decorationRange);
				if (decorationRange.startLineNumber !== decorationRange.endLineNumber) {
					// Stop tracking if the range becomes multiline...
					return false;
				}
			}
		}
		enclosingRanges.sort(EditorRange.compareRangesUsingStarts);

		selections.sort(EditorRange.compareRangesUsingStarts);

		for (let i = 0; i < selections.length; i++) {
			if (i >= enclosingRanges.length) {
				return false;
			}
			if (!enclosingRanges[i].strictContainsRange(selections[i])) {
				return false;
			}
		}

		return true;
	}
}

interface IExecContext {
	readonly model: ITextModel;
	readonly selectionsBefore: EditorSelection[];
	readonly trackedRanges: string[];
	readonly trackedRangesDirection: SelectionDirection[];
}

interface ICommandData {
	operations: IIdentifiedSingleEditOperation[];
	hadTrackedEditOperation: boolean;
}

interface ICommandsData {
	operations: IIdentifiedSingleEditOperation[];
	hadTrackedEditOperation: boolean;
}

class CommandExecutor {
	public static executeCommands(model: ITextModel, selectionsBefore: EditorSelection[], commands: (editorCommon.ICommand | null)[]): EditorSelection[] | null {

		const ctx: IExecContext = {
			model: model,
			selectionsBefore: selectionsBefore,
			trackedRanges: [],
			trackedRangesDirection: []
		};

		const result = this.innerExecuteCommands(ctx, commands);

		for (let i = 0, len = ctx.trackedRanges.length; i < len; i++) {
			ctx.model._setTrackedRange(ctx.trackedRanges[i], null, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges);
		}

		return result;
	}

	private static innerExecuteCommands(ctx: IExecContext, commands: (editorCommon.ICommand | null)[]): EditorSelection[] | null {
		if (this.arrayIsEmpty(commands)) {
			return null;
		}

		const commandsData = this.getEditOperations(ctx, commands);
		if (commandsData.operations.length === 0) {
			return null;
		}

		const rawOperations = commandsData.operations;

		// Remove operations belonging to losing cursors
		const filteredOperations: IIdentifiedSingleEditOperation[] = [];
		for (let i = 0, len = rawOperations.length; i < len; i++) {
			filteredOperations.push(rawOperations[i]);
		}

		let selectionsAfter = ctx.model.pushEditOperations(ctx.selectionsBefore, filteredOperations, (inverseEditOperations: IValidEditOperation[]): EditorSelection[] => {
			const groupedInverseEditOperations: IValidEditOperation[][] = [];
			for (let i = 0; i < ctx.selectionsBefore.length; i++) {
				groupedInverseEditOperations[i] = [];
			}
			for (const op of inverseEditOperations) {
				if (!op.identifier) {
					// perhaps auto whitespace trim edits
					continue;
				}
				groupedInverseEditOperations[op.identifier.major].push(op);
			}
			const minorBasedSorter = (a: IValidEditOperation, b: IValidEditOperation) => {
				return a.identifier!.minor - b.identifier!.minor;
			};
			const cursorSelections: EditorSelection[] = [];
			for (let i = 0; i < ctx.selectionsBefore.length; i++) {
				if (groupedInverseEditOperations[i].length > 0) {
					groupedInverseEditOperations[i].sort(minorBasedSorter);
					cursorSelections[i] = commands[i]!.computeCursorState(ctx.model, {
						getInverseEditOperations: () => {
							return groupedInverseEditOperations[i];
						},

						getTrackedSelection: (id: string) => {
							const idx = parseInt(id, 10);
							const range = ctx.model._getTrackedRange(ctx.trackedRanges[idx])!;
							if (ctx.trackedRangesDirection[idx] === SelectionDirection.LTR) {
								return new EditorSelection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
							}
							return new EditorSelection(range.endLineNumber, range.endColumn, range.startLineNumber, range.startColumn);
						}
					});
				} else {
					cursorSelections[i] = ctx.selectionsBefore[i];
				}
			}
			return cursorSelections;
		});
		if (!selectionsAfter) {
			selectionsAfter = ctx.selectionsBefore;
		}

		return selectionsAfter;
	}

	private static getEditOperations(ctx: IExecContext, commands: (editorCommon.ICommand | null)[]): ICommandsData {
		let operations: IIdentifiedSingleEditOperation[] = [];
		let hadTrackedEditOperation: boolean = false;

		for (let i = 0, len = commands.length; i < len; i++) {
			const command = commands[i];
			if (command) {
				const r = this.getEditOperationsFromCommand(ctx, i, command);
				operations = operations.concat(r.operations);
				hadTrackedEditOperation = hadTrackedEditOperation || r.hadTrackedEditOperation;
			}
		}
		return {
			operations: operations,
			hadTrackedEditOperation: hadTrackedEditOperation
		};
	}

	private static getEditOperationsFromCommand(ctx: IExecContext, majorIdentifier: number, command: editorCommon.ICommand): ICommandData {
		// This method acts as a transaction, if the command fails
		// everything it has done is ignored
		const operations: IIdentifiedSingleEditOperation[] = [];
		let operationMinor = 0;

		const addEditOperation = (range: IRange, text: string | null, forceMoveMarkers: boolean = false) => {
			if (EditorRange.isEmpty(range) && text === '') {
				// This command wants to add a no-op => no thank you
				return;
			}
			operations.push({
				identifier: {
					major: majorIdentifier,
					minor: operationMinor++
				},
				range: range,
				text: text,
				forceMoveMarkers: forceMoveMarkers,
				isAutoWhitespaceEdit: command.insertsAutoWhitespace,
				annotation: command.annotation,
				blockType: command.blockType
			});
		};

		let hadTrackedEditOperation = false;
		const addTrackedEditOperation = (selection: IRange, text: string | null, forceMoveMarkers?: boolean) => {
			hadTrackedEditOperation = true;
			addEditOperation(selection, text, forceMoveMarkers);
		};

		const trackSelection = (_selection: ISelection, trackPreviousOnEmpty?: boolean) => {
			const selection = EditorSelection.liftSelection(_selection);
			let stickiness: TrackedRangeStickiness;
			if (selection.isEmpty()) {
				if (typeof trackPreviousOnEmpty === 'boolean') {
					if (trackPreviousOnEmpty) {
						stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
					} else {
						stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
					}
				} else {
					// Try to lock it with surrounding text
					const maxLineColumn = ctx.model.getLineMaxColumn(selection.startLineNumber);
					if (selection.startColumn === maxLineColumn) {
						stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
					} else {
						stickiness = TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
					}
				}
			} else {
				stickiness = TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
			}

			const l = ctx.trackedRanges.length;
			const id = ctx.model._setTrackedRange(null, selection, stickiness);
			ctx.trackedRanges[l] = id;
			ctx.trackedRangesDirection[l] = selection.getDirection();
			return l.toString();
		};

		const editOperationBuilder: editorCommon.IEditOperationBuilder = {
			addEditOperation: addEditOperation,
			addTrackedEditOperation: addTrackedEditOperation,
			trackSelection: trackSelection
		};

		try {
			command.getEditOperations(ctx.model, editOperationBuilder);
		} catch (e) {
			// TODO@Alex use notification service if this should be user facing
			// e.friendlyMessage = nls.localize('corrupt.commands', "Unexpected exception while executing command.");
			onUnexpectedError(e);
			return {
				operations: [],
				hadTrackedEditOperation: false
			};
		}

		return {
			operations: operations,
			hadTrackedEditOperation: hadTrackedEditOperation
		};
	}

	private static arrayIsEmpty(commands: (editorCommon.ICommand | null)[]): boolean {
		for (let i = 0, len = commands.length; i < len; i++) {
			if (commands[i]) {
				return false;
			}
		}
		return true;
	}
}

class CompositionLineState {
	constructor(
		public readonly text: string,
		public readonly startSelection: number,
		public readonly endSelection: number
	) { }
}

class CompositionState {

	private readonly _original: CompositionLineState[] | null;

	private static _capture(textModel: ITextModel, selections: EditorSelection[]): CompositionLineState[] | null {
		const result: CompositionLineState[] = [];
		for (const selection of selections) {
			if (selection.startLineNumber !== selection.endLineNumber) {
				return null;
			}
			result.push(new CompositionLineState(
				textModel.getLineContent(selection.startLineNumber),
				selection.startColumn - 1,
				selection.endColumn - 1
			));
		}
		return result;
	}

	constructor(textModel: ITextModel, selections: EditorSelection[]) {
		this._original = CompositionState._capture(textModel, selections);
	}

	/**
	 * Returns the inserted text during this composition.
	 * If the composition resulted in existing text being changed (i.e. not a pure insertion) it returns null.
	 */
	deduceOutcome(textModel: ITextModel, selections: EditorSelection[]): CompositionOutcome[] | null {
		if (!this._original) {
			return null;
		}
		const current = CompositionState._capture(textModel, selections);
		if (!current) {
			return null;
		}
		if (this._original.length !== current.length) {
			return null;
		}
		const result: CompositionOutcome[] = [];
		for (let i = 0, len = this._original.length; i < len; i++) {
			result.push(CompositionState._deduceOutcome(this._original[i], current[i]));
		}
		return result;
	}

	private static _deduceOutcome(original: CompositionLineState, current: CompositionLineState): CompositionOutcome {
		const commonPrefix = Math.min(
			original.startSelection,
			current.startSelection,
			strings.commonPrefixLength(original.text, current.text)
		);
		const commonSuffix = Math.min(
			original.text.length - original.endSelection,
			current.text.length - current.endSelection,
			strings.commonSuffixLength(original.text, current.text)
		);
		const deletedText = original.text.substring(commonPrefix, original.text.length - commonSuffix);
		const insertedText = current.text.substring(commonPrefix, current.text.length - commonSuffix);
		return new CompositionOutcome(
			deletedText,
			original.startSelection - commonPrefix,
			original.endSelection - commonPrefix,
			insertedText,
			current.startSelection - commonPrefix,
			current.endSelection - commonPrefix
		);
	}
}
