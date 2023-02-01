import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { ICommand, ICursorStateComputerData, IEditOperationBuilder } from 'mote/editor/common/editorCommon';
import { ITextModel } from 'mote/editor/common/model';

export class ReplaceCommand implements ICommand {

	public readonly insertsAutoWhitespace: boolean;
	public readonly annotation: string[];

	constructor(private readonly range: EditorRange, private readonly text: string, insertsAutoWhitespace: boolean = false, annotation: string[] = []) {
		this.insertsAutoWhitespace = insertsAutoWhitespace;
		this.annotation = annotation;
	}

	public getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void {
		builder.addTrackedEditOperation(this.range, this.text);
	}

	public computeCursorState(model: ITextModel, helper: ICursorStateComputerData): EditorSelection {
		const inverseEditOperations = helper.getInverseEditOperations();
		const srcRange = inverseEditOperations[0].range;
		return EditorSelection.fromPositions(srcRange.getEndPosition());
	}
}

export class ReplaceCommandWithOffsetCursorState implements ICommand {

	private readonly _range: EditorRange;
	private readonly _text: string;
	private readonly _columnDeltaOffset: number;
	private readonly _lineNumberDeltaOffset: number;
	public readonly insertsAutoWhitespace: boolean;

	constructor(range: EditorRange, text: string, lineNumberDeltaOffset: number, columnDeltaOffset: number, insertsAutoWhitespace: boolean = false) {
		this._range = range;
		this._text = text;
		this._columnDeltaOffset = columnDeltaOffset;
		this._lineNumberDeltaOffset = lineNumberDeltaOffset;
		this.insertsAutoWhitespace = insertsAutoWhitespace;
	}

	public getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void {
		builder.addTrackedEditOperation(this._range, this._text);
	}

	public computeCursorState(model: ITextModel, helper: ICursorStateComputerData): EditorSelection {
		const inverseEditOperations = helper.getInverseEditOperations();
		const srcRange = inverseEditOperations[0].range;
		return EditorSelection.fromPositions(srcRange.getEndPosition().delta(this._lineNumberDeltaOffset, this._columnDeltaOffset));
	}
}

export class ReplaceCommandWithoutChangingPosition implements ICommand {

	private readonly _range: EditorRange;
	private readonly _text: string;
	public readonly insertsAutoWhitespace: boolean;

	constructor(range: EditorRange, text: string, insertsAutoWhitespace: boolean = false) {
		this._range = range;
		this._text = text;
		this.insertsAutoWhitespace = insertsAutoWhitespace;
	}

	public getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void {
		builder.addTrackedEditOperation(this._range, this._text);
	}

	public computeCursorState(model: ITextModel, helper: ICursorStateComputerData): EditorSelection {
		const inverseEditOperations = helper.getInverseEditOperations();
		const srcRange = inverseEditOperations[0].range;
		return EditorSelection.fromPositions(srcRange.getStartPosition());
	}
}

