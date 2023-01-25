import { IDisposable } from 'mote/base/common/lifecycle';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { WrappingIndent } from 'mote/editor/common/config/editorOptions';
import { FontInfo } from 'mote/editor/common/config/fontInfo';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { ITextModel, PositionAffinity } from 'mote/editor/common/model';
import { ILineBreaksComputer, ILineBreaksComputerFactory, ModelLineProjectionData } from 'mote/editor/common/modelLineProjectionData';
import { ICoordinatesConverter, ViewLineData } from 'mote/editor/common/viewModel';
import { ConstantTimePrefixSumComputer } from 'mote/editor/common/model/prefixSumComputer';
import { createModelLineProjection, IModelLineProjection } from 'mote/editor/common/viewModel/modelLineProjection';

export interface IViewModelLines extends IDisposable {
	createCoordinatesConverter(): ICoordinatesConverter;
	createLineBreaksComputer(): ILineBreaksComputer;

	onModelLinesDeleted(versionId: number | null, fromLineNumber: number, toLineNumber: number): viewEvents.ViewLinesDeletedEvent | null;
	onModelLinesInserted(versionId: number | null, fromLineNumber: number, toLineNumber: number, lineBreaks: (ModelLineProjectionData | null)[]): viewEvents.ViewLinesInsertedEvent | null;
	onModelLineChanged(versionId: number | null, lineNumber: number, lineBreakData: ModelLineProjectionData | null): [boolean, viewEvents.ViewLinesChangedEvent | null, viewEvents.ViewLinesInsertedEvent | null, viewEvents.ViewLinesDeletedEvent | null];

	getViewLineCount(): number;
	getViewLineContent(viewLineNumber: number): string;
	getViewLineLength(viewLineNumber: number): number;
	getViewLineMinColumn(viewLineNumber: number): number;
	getViewLineMaxColumn(viewLineNumber: number): number;
	getViewLineData(viewLineNumber: number): ViewLineData;
}

export class ViewModelLinesFromProjectedModel implements IViewModelLines {

	private _validModelVersionId: number;

	/**
	 * Reflects the sum of the line counts of all projected model lines.
	*/
	private projectedModelLineLineCounts!: ConstantTimePrefixSumComputer;

	private modelLineProjections!: IModelLineProjection[];

	constructor(
		private readonly model: ITextModel,
		private readonly domLineBreaksComputerFactory: ILineBreaksComputerFactory,
		private readonly monospaceLineBreaksComputerFactory: ILineBreaksComputerFactory,
		private fontInfo: FontInfo,
		private tabSize: number,
		private wrappingStrategy: 'simple' | 'advanced',
		private wrappingColumn: number,
		private wrappingIndent: WrappingIndent,
		private wordBreak: 'normal' | 'keepAll'
	) {
		this._validModelVersionId = -1;

		this.constructLines(/*resetHiddenAreas*/true, null);
	}

	public createCoordinatesConverter(): ICoordinatesConverter {
		return new CoordinatesConverter(this);
	}

	public createLineBreaksComputer(): ILineBreaksComputer {
		const lineBreaksComputerFactory = (
			this.wrappingStrategy === 'advanced'
				? this.domLineBreaksComputerFactory
				: this.monospaceLineBreaksComputerFactory
		);
		return lineBreaksComputerFactory.createLineBreaksComputer(this.fontInfo, this.tabSize, this.wrappingColumn, this.wrappingIndent, this.wordBreak);
	}

	private constructLines(resetHiddenAreas: boolean, previousLineBreaks: ((ModelLineProjectionData | null)[]) | null): void {
		this.modelLineProjections = [];

		if (resetHiddenAreas) {
			//this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, []);
		}

		//const linesContent = this.model.getLinesContent();
		//const injectedTextDecorations = this.model.getInjectedTextDecorations(this._editorId);
		const lineCount = this.model.getLineCount();// linesContent.length;
		const lineBreaksComputer = this.createLineBreaksComputer();

		//const injectedTextQueue = new arrays.ArrayQueue(LineInjectedText.fromDecorations(injectedTextDecorations));
		for (let i = 0; i < lineCount; i++) {
			//const lineInjectedText = injectedTextQueue.takeWhile(t => t.lineNumber === i + 1);
			lineBreaksComputer.addRequest(this.model.getLineContent(i + 1), [], previousLineBreaks ? previousLineBreaks[i] : null);
		}
		const linesBreaks = lineBreaksComputer.finalize();

		const values: number[] = [];

		/*
		const hiddenAreas = this.hiddenAreasDecorationIds.map((areaId) => this.model.getDecorationRange(areaId)!).sort(Range.compareRangesUsingStarts);
		let hiddenAreaStart = 1, hiddenAreaEnd = 0;
		let hiddenAreaIdx = -1;
		let nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : lineCount + 2;
		*/

		for (let i = 0; i < lineCount; i++) {
			//const lineNumber = i + 1;

			/*
			if (lineNumber === nextLineNumberToUpdateHiddenArea) {
				hiddenAreaIdx++;
				hiddenAreaStart = hiddenAreas[hiddenAreaIdx]!.startLineNumber;
				hiddenAreaEnd = hiddenAreas[hiddenAreaIdx]!.endLineNumber;
				nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : lineCount + 2;
			}
			*/

			const isInHiddenArea = false;//(lineNumber >= hiddenAreaStart && lineNumber <= hiddenAreaEnd);
			const line = createModelLineProjection(linesBreaks[i], !isInHiddenArea);
			values[i] = line.getViewLineCount();
			this.modelLineProjections[i] = line;
		}

		this._validModelVersionId = this.model.getVersionId();

		this.projectedModelLineLineCounts = new ConstantTimePrefixSumComputer(values);
	}

	//#region Event handler

	public onModelLinesDeleted(versionId: number | null, fromLineNumber: number, toLineNumber: number): viewEvents.ViewLinesDeletedEvent | null {
		if (!versionId || versionId <= this._validModelVersionId) {
			// Here we check for versionId in case the lines were reconstructed in the meantime.
			// We don't want to apply stale change events on top of a newer read model state.
			return null;
		}

		const outputFromLineNumber = (fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1);
		const outputToLineNumber = this.projectedModelLineLineCounts.getPrefixSum(toLineNumber);

		this.modelLineProjections.splice(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);
		this.projectedModelLineLineCounts.removeValues(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);

		return new viewEvents.ViewLinesDeletedEvent(outputFromLineNumber, outputToLineNumber);
	}

	public onModelLinesInserted(versionId: number | null, fromLineNumber: number, _toLineNumber: number, lineBreaks: (ModelLineProjectionData | null)[]): viewEvents.ViewLinesInsertedEvent | null {
		if (!versionId || versionId <= this._validModelVersionId) {
			// Here we check for versionId in case the lines were reconstructed in the meantime.
			// We don't want to apply stale change events on top of a newer read model state.
			return null;
		}

		// cannot use this.getHiddenAreas() because those decorations have already seen the effect of this model change
		const isInHiddenArea = (fromLineNumber > 2 && !this.modelLineProjections[fromLineNumber - 2].isVisible());

		const outputFromLineNumber = (fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1);

		let totalOutputLineCount = 0;
		const insertLines: IModelLineProjection[] = [];
		const insertPrefixSumValues: number[] = [];

		for (let i = 0, len = lineBreaks.length; i < len; i++) {
			const line = createModelLineProjection(lineBreaks[i], !isInHiddenArea);
			insertLines.push(line);

			const outputLineCount = line.getViewLineCount();
			totalOutputLineCount += outputLineCount;
			insertPrefixSumValues[i] = outputLineCount;
		}

		// TODO@Alex: use arrays.arrayInsert
		this.modelLineProjections =
			this.modelLineProjections.slice(0, fromLineNumber - 1)
				.concat(insertLines)
				.concat(this.modelLineProjections.slice(fromLineNumber - 1));

		this.projectedModelLineLineCounts.insertValues(fromLineNumber - 1, insertPrefixSumValues);

		return new viewEvents.ViewLinesInsertedEvent(outputFromLineNumber, outputFromLineNumber + totalOutputLineCount - 1);
	}

	public onModelLineChanged(versionId: number | null, lineNumber: number, lineBreakData: ModelLineProjectionData | null): [boolean, viewEvents.ViewLinesChangedEvent | null, viewEvents.ViewLinesInsertedEvent | null, viewEvents.ViewLinesDeletedEvent | null] {
		if (versionId !== null && versionId <= this._validModelVersionId) {
			// Here we check for versionId in case the lines were reconstructed in the meantime.
			// We don't want to apply stale change events on top of a newer read model state.
			return [false, null, null, null];
		}

		const lineIndex = lineNumber - 1;

		const oldOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();
		const isVisible = this.modelLineProjections[lineIndex].isVisible();
		const line = createModelLineProjection(lineBreakData, isVisible);
		this.modelLineProjections[lineIndex] = line;
		const newOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();

		let lineMappingChanged = false;
		let changeFrom = 0;
		let changeTo = -1;
		let insertFrom = 0;
		let insertTo = -1;
		let deleteFrom = 0;
		let deleteTo = -1;

		if (oldOutputLineCount > newOutputLineCount) {
			changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
			changeTo = changeFrom + newOutputLineCount - 1;
			deleteFrom = changeTo + 1;
			deleteTo = deleteFrom + (oldOutputLineCount - newOutputLineCount) - 1;
			lineMappingChanged = true;
		} else if (oldOutputLineCount < newOutputLineCount) {
			changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
			changeTo = changeFrom + oldOutputLineCount - 1;
			insertFrom = changeTo + 1;
			insertTo = insertFrom + (newOutputLineCount - oldOutputLineCount) - 1;
			lineMappingChanged = true;
		} else {
			changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
			changeTo = changeFrom + newOutputLineCount - 1;
		}

		this.projectedModelLineLineCounts.setValue(lineIndex, newOutputLineCount);

		const viewLinesChangedEvent = (changeFrom <= changeTo ? new viewEvents.ViewLinesChangedEvent(changeFrom, changeTo - changeFrom + 1) : null);
		const viewLinesInsertedEvent = (insertFrom <= insertTo ? new viewEvents.ViewLinesInsertedEvent(insertFrom, insertTo) : null);
		const viewLinesDeletedEvent = (deleteFrom <= deleteTo ? new viewEvents.ViewLinesDeletedEvent(deleteFrom, deleteTo) : null);

		return [lineMappingChanged, viewLinesChangedEvent, viewLinesInsertedEvent, viewLinesDeletedEvent];
	}

	//#endregion

	//#region Line related

	private getViewLineInfo(viewLineNumber: number): ViewLineInfo {
		viewLineNumber = this.toValidViewLineNumber(viewLineNumber);
		const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
		const lineIndex = r.index;
		const remainder = r.remainder;
		return new ViewLineInfo(lineIndex + 1, remainder);
	}

	public getViewLineCount(): number {
		return this.projectedModelLineLineCounts.getTotalSum();
	}

	private toValidViewLineNumber(viewLineNumber: number): number {
		if (viewLineNumber < 1) {
			return 1;
		}
		const viewLineCount = this.getViewLineCount();
		if (viewLineNumber > viewLineCount) {
			return viewLineCount;
		}
		return viewLineNumber | 0;
	}

	public getViewLineContent(viewLineNumber: number): string {
		const info = this.getViewLineInfo(viewLineNumber);
		return this.modelLineProjections[info.modelLineNumber - 1].getViewLineContent(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
	}

	public getViewLineLength(viewLineNumber: number): number {
		const info = this.getViewLineInfo(viewLineNumber);
		return this.modelLineProjections[info.modelLineNumber - 1].getViewLineLength(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
	}

	public getViewLineMinColumn(viewLineNumber: number): number {
		const info = this.getViewLineInfo(viewLineNumber);
		return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMinColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
	}

	public getViewLineMaxColumn(viewLineNumber: number): number {
		const info = this.getViewLineInfo(viewLineNumber);
		return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMaxColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
	}

	public getViewLineData(viewLineNumber: number): ViewLineData {
		const info = this.getViewLineInfo(viewLineNumber);
		const store = this.model.getLineStore(info.modelLineNumber);
		const viewLineData = this.modelLineProjections[info.modelLineNumber - 1].getViewLineData(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
		viewLineData.type = store.getType() || 'text';
		return viewLineData;
	}

	public validateViewPosition(viewLineNumber: number, viewColumn: number, expectedModelPosition: Position): Position {
		viewLineNumber = this.toValidViewLineNumber(viewLineNumber);

		const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
		const lineIndex = r.index;
		const remainder = r.remainder;

		const line = this.modelLineProjections[lineIndex];

		const minColumn = line.getViewLineMinColumn(this.model, lineIndex + 1, remainder);
		const maxColumn = line.getViewLineMaxColumn(this.model, lineIndex + 1, remainder);
		if (viewColumn < minColumn) {
			viewColumn = minColumn;
		}
		if (viewColumn > maxColumn) {
			viewColumn = maxColumn;
		}

		const computedModelColumn = line.getModelColumnOfViewPosition(remainder, viewColumn);
		const computedModelPosition = this.model.validatePosition(new Position(lineIndex + 1, computedModelColumn));

		if (computedModelPosition.equals(expectedModelPosition)) {
			return new Position(viewLineNumber, viewColumn);
		}

		return this.convertModelPositionToViewPosition(expectedModelPosition.lineNumber, expectedModelPosition.column);
	}

	public validateViewRange(viewRange: EditorRange, expectedModelRange: EditorRange): EditorRange {
		const validViewStart = this.validateViewPosition(viewRange.startLineNumber, viewRange.startColumn, expectedModelRange.getStartPosition());
		const validViewEnd = this.validateViewPosition(viewRange.endLineNumber, viewRange.endColumn, expectedModelRange.getEndPosition());
		return new EditorRange(validViewStart.lineNumber, validViewStart.column, validViewEnd.lineNumber, validViewEnd.column);
	}

	public convertViewPositionToModelPosition(viewLineNumber: number, viewColumn: number): Position {
		const info = this.getViewLineInfo(viewLineNumber);

		const inputColumn = this.modelLineProjections[info.modelLineNumber - 1].getModelColumnOfViewPosition(info.modelLineWrappedLineIdx, viewColumn);
		// console.log('out -> in ' + viewLineNumber + ',' + viewColumn + ' ===> ' + (lineIndex+1) + ',' + inputColumn);
		return this.model.validatePosition(new Position(info.modelLineNumber, inputColumn));
	}

	public convertViewRangeToModelRange(viewRange: EditorRange): EditorRange {
		const start = this.convertViewPositionToModelPosition(viewRange.startLineNumber, viewRange.startColumn);
		const end = this.convertViewPositionToModelPosition(viewRange.endLineNumber, viewRange.endColumn);
		return new EditorRange(start.lineNumber, start.column, end.lineNumber, end.column);
	}

	public convertModelPositionToViewPosition(_modelLineNumber: number, _modelColumn: number, affinity: PositionAffinity = PositionAffinity.None): Position {

		const validPosition = this.model.validatePosition(new Position(_modelLineNumber, _modelColumn));
		const inputLineNumber = validPosition.lineNumber;
		const inputColumn = validPosition.column;

		let lineIndex = inputLineNumber - 1, lineIndexChanged = false;
		while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
			lineIndex--;
			lineIndexChanged = true;
		}
		if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
			// Could not reach a real line
			// console.log('in -> out ' + inputLineNumber + ',' + inputColumn + ' ===> ' + 1 + ',' + 1);
			return new Position(1, 1);
		}
		const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);

		let r: Position;
		if (lineIndexChanged) {
			r = this.modelLineProjections[lineIndex].getViewPositionOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1), affinity);
		} else {
			r = this.modelLineProjections[inputLineNumber - 1].getViewPositionOfModelPosition(deltaLineNumber, inputColumn, affinity);
		}

		// console.log('in -> out ' + inputLineNumber + ',' + inputColumn + ' ===> ' + r.lineNumber + ',' + r);
		return r;
	}

	/**
	 * @param affinity The affinity in case of an empty range. Has no effect for non-empty ranges.
	*/
	public convertModelRangeToViewRange(modelRange: EditorRange, affinity: PositionAffinity = PositionAffinity.Left): EditorRange {
		if (modelRange.isEmpty()) {
			const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, affinity);
			return EditorRange.fromPositions(start);
		} else {
			const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, PositionAffinity.Right);
			const end = this.convertModelPositionToViewPosition(modelRange.endLineNumber, modelRange.endColumn, PositionAffinity.Left);
			return new EditorRange(start.lineNumber, start.column, end.lineNumber, end.column);
		}
	}

	public getViewLineNumberOfModelPosition(modelLineNumber: number, modelColumn: number): number {
		let lineIndex = modelLineNumber - 1;
		if (this.modelLineProjections[lineIndex].isVisible()) {
			// this model line is visible
			const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
			return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber, modelColumn);
		}

		// this model line is not visible
		while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
			lineIndex--;
		}
		if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
			// Could not reach a real line
			return 1;
		}
		const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
		return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1));
	}

	//#endregion

	dispose(): void {

	}

}

/**
 * Overlapping unsorted ranges:
 * [   )      [ )       [  )
 *    [    )      [       )
 * ->
 * Non overlapping sorted ranges:
 * [       )  [ ) [        )
 *
 * Note: This function only considers line information! Columns are ignored.
*/
function normalizeLineRanges(ranges: EditorRange[]): EditorRange[] {
	if (ranges.length === 0) {
		return [];
	}

	const sortedRanges = ranges.slice();
	sortedRanges.sort(EditorRange.compareRangesUsingStarts);

	const result: EditorRange[] = [];
	let currentRangeStart = sortedRanges[0].startLineNumber;
	let currentRangeEnd = sortedRanges[0].endLineNumber;

	for (let i = 1, len = sortedRanges.length; i < len; i++) {
		const range = sortedRanges[i];

		if (range.startLineNumber > currentRangeEnd + 1) {
			result.push(new EditorRange(currentRangeStart, 1, currentRangeEnd, 1));
			currentRangeStart = range.startLineNumber;
			currentRangeEnd = range.endLineNumber;
		} else if (range.endLineNumber > currentRangeEnd) {
			currentRangeEnd = range.endLineNumber;
		}
	}
	result.push(new EditorRange(currentRangeStart, 1, currentRangeEnd, 1));
	return result;
}

/**
 * Represents a view line. Can be used to efficiently query more information about it.
 */
class ViewLineInfo {
	public get isWrappedLineContinuation(): boolean {
		return this.modelLineWrappedLineIdx > 0;
	}

	constructor(
		public readonly modelLineNumber: number,
		public readonly modelLineWrappedLineIdx: number,
	) { }
}

/**
 * A list of view lines that have a contiguous span in the model.
*/
class ViewLineInfoGroupedByModelRange {
	constructor(public readonly modelRange: Range, public readonly viewLines: ViewLineInfo[]) {
	}
}


export class CoordinatesConverter implements ICoordinatesConverter {

	constructor(private readonly lines: ViewModelLinesFromProjectedModel) {

	}

	//#region View -> Model conversion and related methods

	public convertViewPositionToModelPosition(viewPosition: Position): Position {
		return this.lines.convertViewPositionToModelPosition(viewPosition.lineNumber, viewPosition.column);
	}

	public convertViewRangeToModelRange(viewRange: EditorRange): EditorRange {
		return this.lines.convertViewRangeToModelRange(viewRange);
	}

	public validateViewPosition(viewPosition: Position, expectedModelPosition: Position): Position {
		return this.lines.validateViewPosition(viewPosition.lineNumber, viewPosition.column, expectedModelPosition);
	}

	public validateViewRange(viewRange: EditorRange, expectedModelRange: EditorRange): EditorRange {
		return this.lines.validateViewRange(viewRange, expectedModelRange);
	}

	//#endregion

	convertModelPositionToViewPosition(modelPosition: Position, affinity?: PositionAffinity | undefined): Position {
		return this.lines.convertModelPositionToViewPosition(modelPosition.lineNumber, modelPosition.column, affinity);
	}

}
