import * as types from 'vs/base/common/types';

import { IPosition, Position } from 'mote/editor/common/core/position';
import { CursorState, PartialCursorState, SelectionStartKind, SingleCursorState } from 'mote/editor/common/cursorCommon';
import { IViewModel } from 'mote/editor/common/viewModel';
import { ICommandHandlerDescription } from 'mote/platform/commands/common/commands';
import { MoveOperations } from 'mote/editor/common/cursor/cursorMoveOperations';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { WordOperations } from 'mote/editor/common/cursor/cursorWordOperations';

export class CursorMoveCommands {

	public static line(viewModel: IViewModel, cursor: CursorState, inSelectionMode: boolean, _position: IPosition, _viewPosition: IPosition | undefined): PartialCursorState {
		const position = viewModel.model.validatePosition(_position);
		const viewPosition = (
			_viewPosition
				? viewModel.coordinatesConverter.validateViewPosition(new Position(_viewPosition.lineNumber, _viewPosition.column), position)
				: viewModel.coordinatesConverter.convertModelPositionToViewPosition(position)
		);

		if (!inSelectionMode) {
			// Entering line selection for the first time
			const lineCount = viewModel.model.getLineCount();

			let selectToLineNumber = position.lineNumber + 1;
			let selectToColumn = 1;
			if (selectToLineNumber > lineCount) {
				selectToLineNumber = lineCount;
				selectToColumn = viewModel.model.getLineMaxColumn(selectToLineNumber);
			}

			return CursorState.fromModelState(new SingleCursorState(
				new EditorRange(position.lineNumber, 1, selectToLineNumber, selectToColumn), SelectionStartKind.Line, 0,
				new Position(selectToLineNumber, selectToColumn), 0
			));
		}

		// Continuing line selection
		const enteringLineNumber = cursor.modelState.selectionStart.getStartPosition().lineNumber;

		if (position.lineNumber < enteringLineNumber) {

			return CursorState.fromViewState(cursor.viewState.move(
				true, viewPosition.lineNumber, 1, 0
			));

		} else if (position.lineNumber > enteringLineNumber) {

			const lineCount = viewModel.getLineCount();

			let selectToViewLineNumber = viewPosition.lineNumber + 1;
			let selectToViewColumn = 1;
			if (selectToViewLineNumber > lineCount) {
				selectToViewLineNumber = lineCount;
				selectToViewColumn = viewModel.getLineMaxColumn(selectToViewLineNumber);
			}

			return CursorState.fromViewState(cursor.viewState.move(
				true, selectToViewLineNumber, selectToViewColumn, 0
			));

		} else {

			const endPositionOfSelectionStart = cursor.modelState.selectionStart.getEndPosition();
			return CursorState.fromModelState(cursor.modelState.move(
				true, endPositionOfSelectionStart.lineNumber, endPositionOfSelectionStart.column, 0
			));

		}
	}

	public static word(viewModel: IViewModel, cursor: CursorState, inSelectionMode: boolean, _position: IPosition): PartialCursorState {
		const position = viewModel.model.validatePosition(_position);
		return CursorState.fromModelState(WordOperations.word(viewModel.cursorConfig, viewModel.model, cursor.modelState, inSelectionMode, position));
	}

	public static moveTo(viewModel: IViewModel, cursor: CursorState, inSelectionMode: boolean, _position: IPosition, _viewPosition: IPosition | undefined): PartialCursorState {
		if (inSelectionMode) {
			if (cursor.modelState.selectionStartKind === SelectionStartKind.Word) {
				return this.word(viewModel, cursor, inSelectionMode, _position);
			}
			if (cursor.modelState.selectionStartKind === SelectionStartKind.Line) {
				return this.line(viewModel, cursor, inSelectionMode, _position, _viewPosition);
			}
		}
		const position = _position as Position; //viewModel.model.validatePosition(_position);
		const viewPosition = (
			_viewPosition
				? viewModel.coordinatesConverter.validateViewPosition(new Position(_viewPosition.lineNumber, _viewPosition.column), position)
				: viewModel.coordinatesConverter.convertModelPositionToViewPosition(position)
		);
		return CursorState.fromViewState(cursor.viewState.move(inSelectionMode, viewPosition.lineNumber, viewPosition.column, 0));
	}

	public static simpleMove(viewModel: IViewModel, cursors: CursorState[], direction: CursorMove.SimpleMoveDirection, inSelectionMode: boolean, value: number, unit: CursorMove.Unit): PartialCursorState[] | null {
		switch (direction) {
			case CursorMove.Direction.Left: {
				if (unit === CursorMove.Unit.HalfLine) {
					// Move left by half the current line length
					//return this.moveHalfLineLeft(viewModel, cursors, inSelectionMode);
				} else {
					// Move left by `moveParams.value` columns
					return this.moveLeft(viewModel, cursors, inSelectionMode, value);
				}
			}
			case CursorMove.Direction.Right: {
				if (unit === CursorMove.Unit.HalfLine) {
					// Move right by half the current line length
					//return this._moveHalfLineRight(viewModel, cursors, inSelectionMode);
				} else {
					// Move right by `moveParams.value` columns
					return this.moveRight(viewModel, cursors, inSelectionMode, value);
				}
			}
			case CursorMove.Direction.Up: {
				if (unit === CursorMove.Unit.WrappedLine) {
					// Move up by view lines
					return this.moveUpByViewLines(viewModel, cursors, inSelectionMode, value);
				} else {
					// Move up by model lines
					//return this._moveUpByModelLines(viewModel, cursors, inSelectionMode, value);
				}
			}
			case CursorMove.Direction.Down: {
				if (unit === CursorMove.Unit.WrappedLine) {
					// Move down by view lines
					return this.moveDownByViewLines(viewModel, cursors, inSelectionMode, value);
				} else {
					// Move down by model lines
					//return this._moveDownByModelLines(viewModel, cursors, inSelectionMode, value);
				}
			}
			default:
				return null;
		}
	}

	private static moveLeft(viewModel: IViewModel, cursors: CursorState[], inSelectionMode: boolean, noOfColumns: number): PartialCursorState[] {
		return cursors.map(cursor =>
			CursorState.fromViewState(
				MoveOperations.moveLeft(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, noOfColumns)
			)
		);
	}

	private static moveRight(viewModel: IViewModel, cursors: CursorState[], inSelectionMode: boolean, noOfColumns: number): PartialCursorState[] {
		return cursors.map(cursor =>
			CursorState.fromViewState(
				MoveOperations.moveRight(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, noOfColumns)
			)
		);
	}

	private static moveUpByViewLines(viewModel: IViewModel, cursors: CursorState[], inSelectionMode: boolean, linesCount: number): PartialCursorState[] {
		const result: PartialCursorState[] = [];
		for (let i = 0, len = cursors.length; i < len; i++) {
			const cursor = cursors[i];
			result[i] = CursorState.fromViewState(MoveOperations.moveUp(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, linesCount));
		}
		return result;
	}

	private static moveDownByViewLines(viewModel: IViewModel, cursors: CursorState[], inSelectionMode: boolean, linesCount: number): PartialCursorState[] {
		const result: PartialCursorState[] = [];
		for (let i = 0, len = cursors.length; i < len; i++) {
			const cursor = cursors[i];
			result[i] = CursorState.fromViewState(MoveOperations.moveDown(viewModel.cursorConfig, viewModel, cursor.viewState, inSelectionMode, linesCount));
		}
		return result;
	}

	public static viewportMove(viewModel: IViewModel, cursors: CursorState[], direction: CursorMove.ViewportDirection, inSelectionMode: boolean, value: number): PartialCursorState[] | null {
		switch (direction) {
			default:
				return null;
		}
	}
}

export namespace CursorMove {
	const isCursorMoveArgs = function (arg: any): boolean {
		if (!types.isObject(arg)) {
			return false;
		}

		const cursorMoveArg: RawArguments = arg;

		if (!types.isString(cursorMoveArg.to)) {
			return false;
		}

		if (!types.isUndefined(cursorMoveArg.select) && !types.isBoolean(cursorMoveArg.select)) {
			return false;
		}

		if (!types.isUndefined(cursorMoveArg.by) && !types.isString(cursorMoveArg.by)) {
			return false;
		}

		if (!types.isUndefined(cursorMoveArg.value) && !types.isNumber(cursorMoveArg.value)) {
			return false;
		}

		return true;
	};

	/**
	 * Arguments for Cursor move command
	 */
	export interface RawArguments {
		to: string;
		select?: boolean;
		by?: string;
		value?: number;
	}

	/**
	 * Positions in the view for cursor move command.
	 */
	export const RawDirection = {
		Left: 'left',
		Right: 'right',
		Up: 'up',
		Down: 'down',

		PrevBlankLine: 'prevBlankLine',
		NextBlankLine: 'nextBlankLine',

		WrappedLineStart: 'wrappedLineStart',
		WrappedLineFirstNonWhitespaceCharacter: 'wrappedLineFirstNonWhitespaceCharacter',
		WrappedLineColumnCenter: 'wrappedLineColumnCenter',
		WrappedLineEnd: 'wrappedLineEnd',
		WrappedLineLastNonWhitespaceCharacter: 'wrappedLineLastNonWhitespaceCharacter',

		ViewPortTop: 'viewPortTop',
		ViewPortCenter: 'viewPortCenter',
		ViewPortBottom: 'viewPortBottom',

		ViewPortIfOutside: 'viewPortIfOutside'
	};

	/**
	 * Units for Cursor move 'by' argument
	 */
	export const RawUnit = {
		Line: 'line',
		WrappedLine: 'wrappedLine',
		Character: 'character',
		HalfLine: 'halfLine'
	};

	export const description = <ICommandHandlerDescription>{
		description: 'Move cursor to a logical position in the view',
		args: [
			{
				name: 'Cursor move argument object',
				description: `Property-value pairs that can be passed through this argument:
					* 'to': A mandatory logical position value providing where to move the cursor.
						\`\`\`
						'left', 'right', 'up', 'down', 'prevBlankLine', 'nextBlankLine',
						'wrappedLineStart', 'wrappedLineEnd', 'wrappedLineColumnCenter'
						'wrappedLineFirstNonWhitespaceCharacter', 'wrappedLineLastNonWhitespaceCharacter'
						'viewPortTop', 'viewPortCenter', 'viewPortBottom', 'viewPortIfOutside'
						\`\`\`
					* 'by': Unit to move. Default is computed based on 'to' value.
						\`\`\`
						'line', 'wrappedLine', 'character', 'halfLine'
						\`\`\`
					* 'value': Number of units to move. Default is '1'.
					* 'select': If 'true' makes the selection. Default is 'false'.
				`,
				constraint: isCursorMoveArgs,
				schema: {
					'type': 'object',
					'required': ['to'],
					'properties': {
						'to': {
							'type': 'string',
							'enum': ['left', 'right', 'up', 'down', 'prevBlankLine', 'nextBlankLine', 'wrappedLineStart', 'wrappedLineEnd', 'wrappedLineColumnCenter', 'wrappedLineFirstNonWhitespaceCharacter', 'wrappedLineLastNonWhitespaceCharacter', 'viewPortTop', 'viewPortCenter', 'viewPortBottom', 'viewPortIfOutside']
						},
						'by': {
							'type': 'string',
							'enum': ['line', 'wrappedLine', 'character', 'halfLine']
						},
						'value': {
							'type': 'number',
							'default': 1
						},
						'select': {
							'type': 'boolean',
							'default': false
						}
					}
				}
			}
		]
	};

	export function parse(args: Partial<RawArguments>): ParsedArguments | null {
		if (!args.to) {
			// illegal arguments
			return null;
		}

		let direction: Direction;
		switch (args.to) {
			case RawDirection.Left:
				direction = Direction.Left;
				break;
			case RawDirection.Right:
				direction = Direction.Right;
				break;
			case RawDirection.Up:
				direction = Direction.Up;
				break;
			case RawDirection.Down:
				direction = Direction.Down;
				break;
			case RawDirection.PrevBlankLine:
				direction = Direction.PrevBlankLine;
				break;
			case RawDirection.NextBlankLine:
				direction = Direction.NextBlankLine;
				break;
			case RawDirection.WrappedLineStart:
				direction = Direction.WrappedLineStart;
				break;
			case RawDirection.WrappedLineFirstNonWhitespaceCharacter:
				direction = Direction.WrappedLineFirstNonWhitespaceCharacter;
				break;
			case RawDirection.WrappedLineColumnCenter:
				direction = Direction.WrappedLineColumnCenter;
				break;
			case RawDirection.WrappedLineEnd:
				direction = Direction.WrappedLineEnd;
				break;
			case RawDirection.WrappedLineLastNonWhitespaceCharacter:
				direction = Direction.WrappedLineLastNonWhitespaceCharacter;
				break;
			case RawDirection.ViewPortTop:
				direction = Direction.ViewPortTop;
				break;
			case RawDirection.ViewPortBottom:
				direction = Direction.ViewPortBottom;
				break;
			case RawDirection.ViewPortCenter:
				direction = Direction.ViewPortCenter;
				break;
			case RawDirection.ViewPortIfOutside:
				direction = Direction.ViewPortIfOutside;
				break;
			default:
				// illegal arguments
				return null;
		}

		let unit = Unit.None;
		switch (args.by) {
			case RawUnit.Line:
				unit = Unit.Line;
				break;
			case RawUnit.WrappedLine:
				unit = Unit.WrappedLine;
				break;
			case RawUnit.Character:
				unit = Unit.Character;
				break;
			case RawUnit.HalfLine:
				unit = Unit.HalfLine;
				break;
		}

		return {
			direction: direction,
			unit: unit,
			select: (!!args.select),
			value: (args.value || 1)
		};
	}

	export interface ParsedArguments {
		direction: Direction;
		unit: Unit;
		select: boolean;
		value: number;
	}

	export interface SimpleMoveArguments {
		direction: SimpleMoveDirection;
		unit: Unit;
		select: boolean;
		value: number;
	}

	export type SimpleMoveDirection = (
		Direction.Left
		| Direction.Right
		| Direction.Up
		| Direction.Down
		| Direction.PrevBlankLine
		| Direction.NextBlankLine
		| Direction.WrappedLineStart
		| Direction.WrappedLineFirstNonWhitespaceCharacter
		| Direction.WrappedLineColumnCenter
		| Direction.WrappedLineEnd
		| Direction.WrappedLineLastNonWhitespaceCharacter
	);

	export const enum Direction {
		Left,
		Right,
		Up,
		Down,
		PrevBlankLine,
		NextBlankLine,

		WrappedLineStart,
		WrappedLineFirstNonWhitespaceCharacter,
		WrappedLineColumnCenter,
		WrappedLineEnd,
		WrappedLineLastNonWhitespaceCharacter,

		ViewPortTop,
		ViewPortCenter,
		ViewPortBottom,

		ViewPortIfOutside,
	}

	export type ViewportDirection = (
		Direction.ViewPortTop
		| Direction.ViewPortCenter
		| Direction.ViewPortBottom
		| Direction.ViewPortIfOutside
	);

	export const enum Unit {
		None,
		Line,
		WrappedLine,
		Character,
		HalfLine,
	}
}
