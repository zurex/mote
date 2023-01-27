import { ReplaceCommand, ReplaceCommandWithOffsetCursorState, ReplaceCommandWithoutChangingPosition } from 'mote/editor/common/commands/replaceCommand';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { CursorConfiguration, EditOperationType, EditOperationResult } from 'mote/editor/common/cursorCommon';
import { ICommand } from 'mote/editor/common/editorCommon';
import { ITextModel } from 'mote/editor/common/model';

export class CompositionOutcome {
	constructor(
		public readonly deletedText: string,
		public readonly deletedSelectionStart: number,
		public readonly deletedSelectionEnd: number,
		public readonly insertedText: string,
		public readonly insertedSelectionStart: number,
		public readonly insertedSelectionEnd: number,
	) { }
}


export class TypeOperations {

	public static typeWithInterceptors(
		isDoingComposition: boolean,
		prevEditOperationType: EditOperationType,
		config: CursorConfiguration,
		model: ITextModel,
		selections: EditorSelection[],
		autoClosedCharacters: EditorRange[],
		ch: string
	): EditOperationResult {

		if (!isDoingComposition && ch === '\n') {
			const commands: ICommand[] = [];
			for (let i = 0, len = selections.length; i < len; i++) {
				commands[i] = TypeOperations.enter(config, model, false, selections[i]);
			}
			return new EditOperationResult(EditOperationType.TypingOther, commands, {
				shouldPushStackElementBefore: true,
				shouldPushStackElementAfter: false,
			});
		}

		// A simple character type
		const commands: ICommand[] = [];
		for (let i = 0, len = selections.length; i < len; i++) {
			commands[i] = new ReplaceCommand(selections[i], ch);
		}

		const opType = getTypingOperation(ch, prevEditOperationType);
		return new EditOperationResult(opType, commands, {
			shouldPushStackElementBefore: shouldPushStackElementBetween(prevEditOperationType, opType),
			shouldPushStackElementAfter: false
		});
	}

	public static typeWithoutInterceptors(prevEditOperationType: EditOperationType, config: CursorConfiguration, model: ITextModel, selections: EditorSelection[], str: string): EditOperationResult {
		const commands: ICommand[] = [];
		for (let i = 0, len = selections.length; i < len; i++) {
			commands[i] = new ReplaceCommand(selections[i], str);
		}
		const opType = getTypingOperation(str, prevEditOperationType);
		return new EditOperationResult(opType, commands, {
			shouldPushStackElementBefore: shouldPushStackElementBetween(prevEditOperationType, opType),
			shouldPushStackElementAfter: false
		});
	}

	public static compositionType(prevEditOperationType: EditOperationType, config: CursorConfiguration, model: ITextModel, selections: EditorSelection[], text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): EditOperationResult {
		const commands = selections.map(selection => this._compositionType(model, selection, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta));
		return new EditOperationResult(EditOperationType.TypingOther, commands, {
			shouldPushStackElementBefore: shouldPushStackElementBetween(prevEditOperationType, EditOperationType.TypingOther),
			shouldPushStackElementAfter: false
		});
	}

	private static _compositionType(model: ITextModel, selection: EditorSelection, text: string, replacePrevCharCnt: number, replaceNextCharCnt: number, positionDelta: number): ICommand | null {
		if (!selection.isEmpty()) {
			// looks like https://github.com/microsoft/vscode/issues/2773
			// where a cursor operation occurred before a canceled composition
			// => ignore composition
			return null;
		}
		const pos = selection.getPosition();
		const startColumn = Math.max(1, pos.column - replacePrevCharCnt);
		const endColumn = Math.min(model.getLineMaxColumn(pos.lineNumber), pos.column + replaceNextCharCnt);
		const range = new EditorRange(pos.lineNumber, startColumn, pos.lineNumber, endColumn);
		const oldText = model.getValueInRange(range);
		if (oldText === text && positionDelta === 0) {
			// => ignore composition that doesn't do anything
			return null;
		}
		return new ReplaceCommandWithOffsetCursorState(range, text, 0, positionDelta);
	}

	private static typeCommand(range: EditorRange, text: string, keepPosition: boolean): ICommand {
		if (keepPosition) {
			return new ReplaceCommandWithoutChangingPosition(range, text, true);
		} else {
			return new ReplaceCommand(range, text, true);
		}
	}

	private static enter(config: CursorConfiguration, model: ITextModel, keepPosition: boolean, range: EditorRange): ICommand {
		return TypeOperations.typeCommand(range, '\n', keepPosition);
	}

	public static lineInsertAfter(config: CursorConfiguration, model: ITextModel | null, selections: EditorSelection[] | null): ICommand[] {
		if (model === null || selections === null) {
			return [];
		}

		const commands: ICommand[] = [];
		for (let i = 0, len = selections.length; i < len; i++) {
			const lineNumber = selections[i].positionLineNumber;
			const column = model.getLineMaxColumn(lineNumber);
			commands[i] = this.enter(config, model, false, new EditorRange(lineNumber, column, lineNumber, column));
		}
		return commands;
	}

	public static lineBreakInsert(config: CursorConfiguration, model: ITextModel, selections: EditorSelection[]): ICommand[] {
		const commands: ICommand[] = [];
		for (let i = 0, len = selections.length; i < len; i++) {
			commands[i] = this.enter(config, model, true, selections[i]);
		}
		return commands;
	}
}

function getTypingOperation(typedText: string, previousTypingOperation: EditOperationType): EditOperationType {
	if (typedText === ' ') {
		return previousTypingOperation === EditOperationType.TypingFirstSpace
			|| previousTypingOperation === EditOperationType.TypingConsecutiveSpace
			? EditOperationType.TypingConsecutiveSpace
			: EditOperationType.TypingFirstSpace;
	}

	return EditOperationType.TypingOther;
}

function shouldPushStackElementBetween(previousTypingOperation: EditOperationType, typingOperation: EditOperationType): boolean {
	if (isTypingOperation(previousTypingOperation) && !isTypingOperation(typingOperation)) {
		// Always set an undo stop before non-type operations
		return true;
	}
	if (previousTypingOperation === EditOperationType.TypingFirstSpace) {
		// `abc |d`: No undo stop
		// `abc  |d`: Undo stop
		return false;
	}
	// Insert undo stop between different operation types
	return normalizeOperationType(previousTypingOperation) !== normalizeOperationType(typingOperation);
}

function normalizeOperationType(type: EditOperationType): EditOperationType | 'space' {
	return (type === EditOperationType.TypingConsecutiveSpace || type === EditOperationType.TypingFirstSpace)
		? 'space'
		: type;
}

function isTypingOperation(type: EditOperationType): boolean {
	return type === EditOperationType.TypingOther
		|| type === EditOperationType.TypingFirstSpace
		|| type === EditOperationType.TypingConsecutiveSpace;
}
