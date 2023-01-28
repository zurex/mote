import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { CursorConfiguration, IColumnSelectData, ICursorSimpleModel, SelectionStartKind, SingleCursorState } from 'mote/editor/common/cursorCommon';

export interface IColumnSelectResult {
	viewStates: SingleCursorState[];
	reversed: boolean;
	fromLineNumber: number;
	fromVisualColumn: number;
	toLineNumber: number;
	toVisualColumn: number;
}

export class ColumnSelection {

	public static columnSelect(config: CursorConfiguration, model: ICursorSimpleModel, fromLineNumber: number, fromVisibleColumn: number, toLineNumber: number, toVisibleColumn: number): IColumnSelectResult {
		const lineCount = Math.abs(toLineNumber - fromLineNumber) + 1;
		const reversed = (fromLineNumber > toLineNumber);
		const isRTL = (fromVisibleColumn > toVisibleColumn);
		const isLTR = (fromVisibleColumn < toVisibleColumn);

		const result: SingleCursorState[] = [];

		for (let i = 0; i < lineCount; i++) {
			const lineNumber = fromLineNumber + (reversed ? -i : i);

			const startColumn = config.columnFromVisibleColumn(model, lineNumber, fromVisibleColumn);
			const endColumn = config.columnFromVisibleColumn(model, lineNumber, toVisibleColumn);
			const visibleStartColumn = config.visibleColumnFromColumn(model, new Position(lineNumber, startColumn));
			const visibleEndColumn = config.visibleColumnFromColumn(model, new Position(lineNumber, endColumn));

			// console.log(`lineNumber: ${lineNumber}: visibleStartColumn: ${visibleStartColumn}, visibleEndColumn: ${visibleEndColumn}`);

			if (isLTR) {
				if (visibleStartColumn > toVisibleColumn) {
					continue;
				}
				if (visibleEndColumn < fromVisibleColumn) {
					continue;
				}
			}

			if (isRTL) {
				if (visibleEndColumn > fromVisibleColumn) {
					continue;
				}
				if (visibleStartColumn < toVisibleColumn) {
					continue;
				}
			}

			result.push(new SingleCursorState(
				new EditorRange(lineNumber, startColumn, lineNumber, startColumn), SelectionStartKind.Simple, 0,
				new Position(lineNumber, endColumn), 0
			));
		}

		if (result.length === 0) {
			// We are after all the lines, so add cursor at the end of each line
			for (let i = 0; i < lineCount; i++) {
				const lineNumber = fromLineNumber + (reversed ? -i : i);
				const maxColumn = model.getLineMaxColumn(lineNumber);

				result.push(new SingleCursorState(
					new EditorRange(lineNumber, maxColumn, lineNumber, maxColumn), SelectionStartKind.Simple, 0,
					new Position(lineNumber, maxColumn), 0
				));
			}
		}

		return {
			viewStates: result,
			reversed: reversed,
			fromLineNumber: fromLineNumber,
			fromVisualColumn: fromVisibleColumn,
			toLineNumber: toLineNumber,
			toVisualColumn: toVisibleColumn
		};
	}

	public static columnSelectLeft(config: CursorConfiguration, model: ICursorSimpleModel, prevColumnSelectData: IColumnSelectData): IColumnSelectResult {
		let toViewVisualColumn = prevColumnSelectData.toViewVisualColumn;
		if (toViewVisualColumn > 0) {
			toViewVisualColumn--;
		}

		return ColumnSelection.columnSelect(config, model, prevColumnSelectData.fromViewLineNumber, prevColumnSelectData.fromViewVisualColumn, prevColumnSelectData.toViewLineNumber, toViewVisualColumn);
	}

}
