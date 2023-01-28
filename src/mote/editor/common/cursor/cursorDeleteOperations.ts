
import * as strings from 'mote/base/common/strings';
import { ReplaceCommand } from 'mote/editor/common/commands/replaceCommand';
import { CursorColumns } from 'mote/editor/common/core/cursorColumns';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { Position } from 'mote/editor/common/core/position';
import { MoveOperations } from 'mote/editor/common/cursor/cursorMoveOperations';
import { CursorConfiguration, EditOperationType, ICursorSimpleModel } from 'mote/editor/common/cursorCommon';
import { ICommand } from 'mote/editor/common/editorCommon';

export class DeleteOperations {

	public static deleteRight(
		prevEditOperationType: EditOperationType,
		config: CursorConfiguration,
		model: ICursorSimpleModel,
		selections: EditorSelection[]
	): [boolean, Array<ICommand | null>] {
		const commands: Array<ICommand | null> = [];
		let shouldPushStackElementBefore = (prevEditOperationType !== EditOperationType.DeletingRight);
		for (let i = 0, len = selections.length; i < len; i++) {
			const selection = selections[i];

			let deleteSelection: EditorRange = selection;

			if (deleteSelection.isEmpty()) {
				const position = selection.getPosition();
				const rightOfPosition = MoveOperations.right(config, model, position);
				deleteSelection = new EditorRange(
					rightOfPosition.lineNumber,
					rightOfPosition.column,
					position.lineNumber,
					position.column
				);
			}

			if (deleteSelection.isEmpty()) {
				// Probably at end of file => ignore
				commands[i] = null;
				continue;
			}

			if (deleteSelection.startLineNumber !== deleteSelection.endLineNumber) {
				shouldPushStackElementBefore = true;
			}

			commands[i] = new ReplaceCommand(deleteSelection, '');
		}
		return [shouldPushStackElementBefore, commands];
	}

	public static deleteLeft(
		prevEditOperationType: EditOperationType,
		config: CursorConfiguration,
		model: ICursorSimpleModel,
		selections: EditorSelection[],
		autoClosedCharacters: EditorRange[]
	): [boolean, Array<ICommand | null>] {
		//if (this.isAutoClosingPairDelete(config.autoClosingDelete, config.autoClosingBrackets, config.autoClosingQuotes, config.autoClosingPairs.autoClosingPairsOpenByEnd, model, selections, autoClosedCharacters)) {
		//	return this._runAutoClosingPairDelete(config, model, selections);
		//}

		const commands: Array<ICommand | null> = [];
		let shouldPushStackElementBefore = (prevEditOperationType !== EditOperationType.DeletingLeft);
		for (let i = 0, len = selections.length; i < len; i++) {
			const deleteRange = DeleteOperations.getDeleteRange(selections[i], model, config);

			// Ignore empty delete ranges, as they have no effect
			// They happen if the cursor is at the beginning of the file.
			if (deleteRange.isEmpty()) {
				commands[i] = null;
				continue;
			}

			if (deleteRange.startLineNumber !== deleteRange.endLineNumber) {
				shouldPushStackElementBefore = true;
			}

			commands[i] = new ReplaceCommand(deleteRange, '');
		}
		return [shouldPushStackElementBefore, commands];

	}

	private static getDeleteRange(
		selection: EditorSelection,
		model: ICursorSimpleModel,
		config: CursorConfiguration
	): EditorRange {
		if (!selection.isEmpty()) {
			return selection;
		}

		const position = selection.getPosition();

		// Unintend when using tab stops and cursor is within indentation
		if (config.useTabStops && position.column > 1) {
			const lineContent = model.getLineContent(position.lineNumber);

			const firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
			const lastIndentationColumn = (
				firstNonWhitespaceIndex === -1
					? /* entire string is whitespace */ lineContent.length + 1
					: firstNonWhitespaceIndex + 1
			);

			if (position.column <= lastIndentationColumn) {
				const fromVisibleColumn = config.visibleColumnFromColumn(model, position);
				const toVisibleColumn = CursorColumns.prevIndentTabStop(fromVisibleColumn, config.indentSize);
				const toColumn = config.columnFromVisibleColumn(model, position.lineNumber, toVisibleColumn);
				return new EditorRange(position.lineNumber, toColumn, position.lineNumber, position.column);
			}
		}

		return EditorRange.fromPositions(DeleteOperations.getPositionAfterDeleteLeft(position, model), position);
	}

	private static getPositionAfterDeleteLeft(position: Position, model: ICursorSimpleModel): Position {
		if (position.column > 1) {
			// Convert 1-based columns to 0-based offsets and back.
			const idx = strings.getLeftDeleteOffset(position.column - 1, model.getLineContent(position.lineNumber));
			return position.with(undefined, idx + 1);
		} else if (position.lineNumber > 1) {
			const newLine = position.lineNumber - 1;
			return new Position(newLine, model.getLineMaxColumn(newLine));
		} else {
			return position;
		}
	}
}
