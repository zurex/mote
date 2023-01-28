import * as strings from 'mote/base/common/strings';
import { CursorColumns } from 'mote/editor/common/core/cursorColumns';
import { Position } from 'mote/editor/common/core/position';
import { CursorConfiguration, ICursorSimpleModel, SingleCursorState } from 'mote/editor/common/cursorCommon';
import { PositionAffinity } from 'mote/editor/common/model';


export class CursorPosition {
	_cursorPositionBrand: void = undefined;

	public readonly lineNumber: number;
	public readonly column: number;
	public readonly leftoverVisibleColumns: number;

	constructor(lineNumber: number, column: number, leftoverVisibleColumns: number) {
		this.lineNumber = lineNumber;
		this.column = column;
		this.leftoverVisibleColumns = leftoverVisibleColumns;
	}
}

export class MoveOperations {

	public static leftPosition(model: ICursorSimpleModel, position: Position): Position {
		if (position.column > model.getLineMinColumn(position.lineNumber)) {
			return position.delta(undefined, -strings.prevCharLength(model.getLineContent(position.lineNumber), position.column - 1));
		} else if (position.lineNumber > 1) {
			const newLineNumber = position.lineNumber - 1;
			return new Position(newLineNumber, model.getLineMaxColumn(newLineNumber));
		} else {
			return position;
		}
	}

	private static left(config: CursorConfiguration, model: ICursorSimpleModel, position: Position): CursorPosition {
		const pos = MoveOperations.leftPosition(model, position);
		return new CursorPosition(pos.lineNumber, pos.column, 0);
	}

	/**
	 * @param noOfColumns Must be either `1`
	 * or `Math.round(viewModel.getLineContent(viewLineNumber).length / 2)` (for half lines).
	*/
	public static moveLeft(config: CursorConfiguration, model: ICursorSimpleModel, cursor: SingleCursorState, inSelectionMode: boolean, noOfColumns: number): SingleCursorState {
		let lineNumber: number,
			column: number;

		if (cursor.hasSelection() && !inSelectionMode) {
			// If the user has a selection and does not want to extend it,
			// put the cursor at the beginning of the selection.
			lineNumber = cursor.selection.startLineNumber;
			column = cursor.selection.startColumn;
		} else {
			// This has no effect if noOfColumns === 1.
			// It is ok to do so in the half-line scenario.
			const pos = cursor.position.delta(undefined, -(noOfColumns - 1));
			// We clip the position before normalization, as normalization is not defined
			// for possibly negative columns.
			const normalizedPos = model.normalizePosition(MoveOperations.clipPositionColumn(pos, model), PositionAffinity.Left);
			const p = MoveOperations.left(config, model, normalizedPos);

			lineNumber = p.lineNumber;
			column = p.column;
		}

		return cursor.move(inSelectionMode, lineNumber, column, 0);
	}

	public static rightPosition(model: ICursorSimpleModel, lineNumber: number, column: number): Position {
		if (column < model.getLineMaxColumn(lineNumber)) {
			column = column + strings.nextCharLength(model.getLineContent(lineNumber), column - 1);
		} else if (lineNumber < model.getLineCount()) {
			lineNumber = lineNumber + 1;
			column = model.getLineMinColumn(lineNumber);
		}
		return new Position(lineNumber, column);
	}

	public static right(config: CursorConfiguration, model: ICursorSimpleModel, position: Position): CursorPosition {
		const pos = MoveOperations.rightPosition(model, position.lineNumber, position.column);
		return new CursorPosition(pos.lineNumber, pos.column, 0);
	}

	public static moveRight(config: CursorConfiguration, model: ICursorSimpleModel, cursor: SingleCursorState, inSelectionMode: boolean, noOfColumns: number): SingleCursorState {
		let lineNumber: number,
			column: number;

		if (cursor.hasSelection() && !inSelectionMode) {
			// If we are in selection mode, move right without selection cancels selection and puts cursor at the end of the selection
			lineNumber = cursor.selection.endLineNumber;
			column = cursor.selection.endColumn;
		} else {
			const pos = cursor.position.delta(undefined, noOfColumns - 1);
			const normalizedPos = model.normalizePosition(MoveOperations.clipPositionColumn(pos, model), PositionAffinity.Right);
			const r = MoveOperations.right(config, model, normalizedPos);
			lineNumber = r.lineNumber;
			column = r.column;
		}

		return cursor.move(inSelectionMode, lineNumber, column, 0);
	}

	public static vertical(config: CursorConfiguration, model: ICursorSimpleModel, lineNumber: number, column: number, leftoverVisibleColumns: number, newLineNumber: number, allowMoveOnEdgeLine: boolean, normalizationAffinity?: PositionAffinity): CursorPosition {
		const currentVisibleColumn = CursorColumns.visibleColumnFromColumn(model.getLineContent(lineNumber), column, config.tabSize) + leftoverVisibleColumns;
		const lineCount = model.getLineCount();
		const wasOnFirstPosition = (lineNumber === 1 && column === 1);
		const wasOnLastPosition = (lineNumber === lineCount && column === model.getLineMaxColumn(lineNumber));
		const wasAtEdgePosition = (newLineNumber < lineNumber ? wasOnFirstPosition : wasOnLastPosition);

		lineNumber = newLineNumber;
		if (lineNumber < 1) {
			lineNumber = 1;
			if (allowMoveOnEdgeLine) {
				column = model.getLineMinColumn(lineNumber);
			} else {
				column = Math.min(model.getLineMaxColumn(lineNumber), column);
			}
		} else if (lineNumber > lineCount) {
			lineNumber = lineCount;
			if (allowMoveOnEdgeLine) {
				column = model.getLineMaxColumn(lineNumber);
			} else {
				column = Math.min(model.getLineMaxColumn(lineNumber), column);
			}
		} else {
			column = config.columnFromVisibleColumn(model, lineNumber, currentVisibleColumn);
		}

		if (wasAtEdgePosition) {
			leftoverVisibleColumns = 0;
		} else {
			leftoverVisibleColumns = currentVisibleColumn - CursorColumns.visibleColumnFromColumn(model.getLineContent(lineNumber), column, config.tabSize);
		}

		if (normalizationAffinity !== undefined) {
			const position = new Position(lineNumber, column);
			const newPosition = model.normalizePosition(position, normalizationAffinity);
			leftoverVisibleColumns = leftoverVisibleColumns + (column - newPosition.column);
			lineNumber = newPosition.lineNumber;
			column = newPosition.column;
		}
		return new CursorPosition(lineNumber, column, leftoverVisibleColumns);
	}

	public static down(config: CursorConfiguration, model: ICursorSimpleModel, lineNumber: number, column: number, leftoverVisibleColumns: number, count: number, allowMoveOnLastLine: boolean): CursorPosition {
		return this.vertical(config, model, lineNumber, column, leftoverVisibleColumns, lineNumber + count, allowMoveOnLastLine, PositionAffinity.RightOfInjectedText);
	}

	public static moveDown(config: CursorConfiguration, model: ICursorSimpleModel, cursor: SingleCursorState, inSelectionMode: boolean, linesCount: number): SingleCursorState {
		let lineNumber: number,
			column: number;

		if (cursor.hasSelection() && !inSelectionMode) {
			// If we are in selection mode, move down acts relative to the end of selection
			lineNumber = cursor.selection.endLineNumber;
			column = cursor.selection.endColumn;
		} else {
			lineNumber = cursor.position.lineNumber;
			column = cursor.position.column;
		}

		const r = MoveOperations.down(config, model, lineNumber, column, cursor.leftoverVisibleColumns, linesCount, true);

		return cursor.move(inSelectionMode, r.lineNumber, r.column, r.leftoverVisibleColumns);
	}

	public static up(config: CursorConfiguration, model: ICursorSimpleModel, lineNumber: number, column: number, leftoverVisibleColumns: number, count: number, allowMoveOnFirstLine: boolean): CursorPosition {
		return this.vertical(config, model, lineNumber, column, leftoverVisibleColumns, lineNumber - count, allowMoveOnFirstLine, PositionAffinity.LeftOfInjectedText);
	}

	public static moveUp(config: CursorConfiguration, model: ICursorSimpleModel, cursor: SingleCursorState, inSelectionMode: boolean, linesCount: number): SingleCursorState {
		let lineNumber: number,
			column: number;

		if (cursor.hasSelection() && !inSelectionMode) {
			// If we are in selection mode, move up acts relative to the beginning of selection
			lineNumber = cursor.selection.startLineNumber;
			column = cursor.selection.startColumn;
		} else {
			lineNumber = cursor.position.lineNumber;
			column = cursor.position.column;
		}

		const r = MoveOperations.up(config, model, lineNumber, column, cursor.leftoverVisibleColumns, linesCount, true);

		return cursor.move(inSelectionMode, r.lineNumber, r.column, r.leftoverVisibleColumns);
	}

	/**
	 * Adjusts the column so that it is within min/max of the line.
	*/
	private static clipPositionColumn(position: Position, model: ICursorSimpleModel): Position {
		return new Position(
			position.lineNumber,
			MoveOperations.clipRange(position.column, model.getLineMinColumn(position.lineNumber),
				model.getLineMaxColumn(position.lineNumber))
		);
	}

	private static clipRange(value: number, min: number, max: number): number {
		if (value < min) {
			return min;
		}
		if (value > max) {
			return max;
		}
		return value;
	}
}
