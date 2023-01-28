import { onUnexpectedError } from 'mote/base/common/errors';
import { ISingleEditOperation } from 'mote/editor/common/core/editOperation';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { ICursorStateComputer, IValidEditOperation } from 'mote/editor/common/model';
import { TextModel } from 'mote/editor/common/model/textModel';
import { UndoRedoGroup } from 'mote/platform/undoRedo/common/undoRedo';

export class EditStack {

	constructor(private readonly model: TextModel) {

	}

	public pushEditOperation(
		beforeCursorState: EditorSelection[] | null,
		editOperations: ISingleEditOperation[],
		cursorStateComputer: ICursorStateComputer | null,
		group?: UndoRedoGroup
	): EditorSelection[] | null {

		const inverseEditOperations = this.model.applyEdits(editOperations, true);
		const afterCursorState = EditStack.computeCursorState(cursorStateComputer, inverseEditOperations);
		return afterCursorState;
	}

	private static computeCursorState(cursorStateComputer: ICursorStateComputer | null, inverseEditOperations: IValidEditOperation[]): EditorSelection[] | null {
		try {
			return cursorStateComputer ? cursorStateComputer(inverseEditOperations) : null;
		} catch (e) {
			onUnexpectedError(e);
			return null;
		}
	}
}
