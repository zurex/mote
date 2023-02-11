
import { Disposable } from 'mote/base/common/lifecycle';
import { IEditorWhitespace, IPartialViewLinesViewportData, IViewLineLayout, IViewModel } from 'mote/editor/common/viewModel';

interface IPendingChange { id: string; newAfterLineNumber: number; newHeight: number }
interface IPendingRemove { id: string }

class PendingChanges {
	private _hasPending: boolean;
	private _inserts: EditorWhitespace[];
	private _changes: IPendingChange[];
	private _removes: IPendingRemove[];

	constructor() {
		this._hasPending = false;
		this._inserts = [];
		this._changes = [];
		this._removes = [];
	}

	public insert(x: EditorWhitespace): void {
		this._hasPending = true;
		this._inserts.push(x);
	}

	public change(x: IPendingChange): void {
		this._hasPending = true;
		this._changes.push(x);
	}

	public remove(x: IPendingRemove): void {
		this._hasPending = true;
		this._removes.push(x);
	}

	public mustCommit(): boolean {
		return this._hasPending;
	}

	public commit(linesLayout: LinesLayout): void {
		if (!this._hasPending) {
			return;
		}

		const inserts = this._inserts;
		const changes = this._changes;
		const removes = this._removes;

		this._hasPending = false;
		this._inserts = [];
		this._changes = [];
		this._removes = [];

		linesLayout._commitPendingChanges(inserts, changes, removes);
	}
}

export class EditorWhitespace implements IEditorWhitespace {
	public id: string;
	public afterLineNumber: number;
	public ordinal: number;
	public height: number;
	public minWidth: number;
	public prefixSum: number;

	constructor(id: string, afterLineNumber: number, ordinal: number, height: number, minWidth: number) {
		this.id = id;
		this.afterLineNumber = afterLineNumber;
		this.ordinal = ordinal;
		this.height = height;
		this.minWidth = minWidth;
		this.prefixSum = 0;
	}
}

/**
 * Layouting of objects that take vertical space (by having a height) and push down other objects.
 *
 * These objects are basically either text (lines) or spaces between those lines (whitespaces).
 * This provides commodity operations for working with lines that contain whitespace that pushes lines lower (vertically).
 */
export class LinesLayout extends Disposable {
	private lineHeight = 32;

	private _paddingTop: number = 162;
	private _paddingBottom: number = 200;

	private readonly _pendingChanges: PendingChanges;
	private viewLineLayout!: IViewLineLayout;
	private _arr: EditorWhitespace[] = [];

	constructor(

		private lineCount: number,
	) {
		super();

		this._pendingChanges = new PendingChanges();
	}

	public setViewLineLayout(viewLineLayout: IViewLineLayout) {
		this.viewLineLayout = viewLineLayout;
	}

	/**
	 * Set the number of lines.
	 *
	 * @param lineCount New number of lines.
	 */
	public onFlushed(lineCount: number): void {
		this.checkPendingChanges();
		this.lineCount = lineCount;
	}

	/**
	 * Notify the layouter that lines have been deleted (a continuous zone of lines).
	 *
	 * @param fromLineNumber The line number at which the deletion started, inclusive
	 * @param toLineNumber The line number at which the deletion ended, inclusive
	 */
	public onLinesDeleted(fromLineNumber: number, toLineNumber: number) {
		this.checkPendingChanges();
		fromLineNumber = fromLineNumber | 0;
		toLineNumber = toLineNumber | 0;

		this.lineCount -= (toLineNumber - fromLineNumber + 1);
		for (let i = 0, len = this._arr.length; i < len; i++) {
			const afterLineNumber = this._arr[i].afterLineNumber;

			if (fromLineNumber <= afterLineNumber && afterLineNumber <= toLineNumber) {
				// The line this whitespace was after has been deleted
				//  => move whitespace to before first deleted line
				this._arr[i].afterLineNumber = fromLineNumber - 1;
			} else if (afterLineNumber > toLineNumber) {
				// The line this whitespace was after has been moved up
				//  => move whitespace up
				this._arr[i].afterLineNumber -= (toLineNumber - fromLineNumber + 1);
			}
		}
	}

	/**
	 * Notify the layouter that lines have been inserted (a continuous zone of lines).
	 *
	 * @param fromLineNumber The line number at which the insertion started, inclusive
	 * @param toLineNumber The line number at which the insertion ended, inclusive.
	 */
	public onLinesInserted(fromLineNumber: number, toLineNumber: number): void {
		this.checkPendingChanges();
		fromLineNumber = fromLineNumber | 0;
		toLineNumber = toLineNumber | 0;

		this.lineCount += (toLineNumber - fromLineNumber + 1);
		for (let i = 0, len = this._arr.length; i < len; i++) {
			const afterLineNumber = this._arr[i].afterLineNumber;

			if (fromLineNumber <= afterLineNumber) {
				this._arr[i].afterLineNumber += (toLineNumber - fromLineNumber + 1);
			}
		}
	}

	/**
	 * Check if `verticalOffset` is below all lines.
	 */
	public isAfterLines(verticalOffset: number): boolean {
		this.checkPendingChanges();
		const totalHeight = this.getLinesTotalHeight();
		return verticalOffset > totalHeight;
	}

	/**
	 * Get the sum of heights for all objects.
	 *
	 * @return The sum of heights for all objects.
	 */
	public getLinesTotalHeight(): number {
		return this.lineCount * this.lineHeight + this._paddingTop + this._paddingBottom;
	}

	/**
	 * Find the first line number that is at or after vertical offset `verticalOffset`.
	 * i.e. if getVerticalOffsetForLine(line) is x and getVerticalOffsetForLine(line + 1) is y, then
	 * getLineNumberAtOrAfterVerticalOffset(i) = line, x <= i < y.
	 *
	 * @param verticalOffset The vertical offset to search at.
	 * @return The line number at or after vertical offset `verticalOffset`.
	 */
	public getLineNumberAtOrAfterVerticalOffset(verticalOffset: number): number {

		const linesCount = this.lineCount | 0;
		let minLineNumber = 1;
		let maxLineNumber = linesCount;

		while (minLineNumber < maxLineNumber) {
			const midLineNumber = ((minLineNumber + maxLineNumber) / 2) | 0;

			const midLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(midLineNumber) | 0;

			if (verticalOffset >= midLineNumberVerticalOffset + this.lineHeight) {
				// vertical offset is after mid line number
				minLineNumber = midLineNumber + 1;
			} else if (verticalOffset >= midLineNumberVerticalOffset) {
				// Hit
				return midLineNumber;
			} else {
				// vertical offset is before mid line number, but mid line number could still be what we're searching for
				maxLineNumber = midLineNumber;
			}
		}

		if (minLineNumber > linesCount) {
			return linesCount;
		}

		return minLineNumber;
	}

	/**
	 * Get the vertical offset (the sum of heights for all objects above) a certain line number.
	 *
	 * @param lineNumber The line number
	 * @return The sum of heights for all objects above `lineNumber`.
	 */
	public getVerticalOffsetForLineNumber(lineNumber: number, includeViewZones = false): number {
		try {
			const offset = this.viewLineLayout.getVerticalOffsetForLineNumber(lineNumber, includeViewZones);
			if (offset >= 0) {
				// TODO: fix me
				return offset - 30;
			}
		}
		catch (e) {
			console.error(e);
		}
		lineNumber = lineNumber | 0;

		let previousLinesHeight: number;
		if (lineNumber > 1) {
			previousLinesHeight = this.lineHeight * (lineNumber - 1);
		} else {
			previousLinesHeight = 0;
		}
		return previousLinesHeight + this._paddingTop;
	}

	/**
	 * Get the vertical offset (the sum of heights for all objects above) a certain line number.
	 *
	 * @param lineNumber The line number
	 * @return The sum of heights for all objects above `lineNumber`.
	 */
	public getVerticalOffsetAfterLineNumber(lineNumber: number, includeViewZones = false): number {
		lineNumber = lineNumber | 0;
		const previousLinesHeight = this.lineHeight * lineNumber;
		return previousLinesHeight + this._paddingTop;
	}

	/**
	 * Get all the lines and their relative vertical offsets that are positioned between `verticalOffset1` and `verticalOffset2`.
	 *
	 * @param verticalOffset1 The beginning of the viewport.
	 * @param verticalOffset2 The end of the viewport.
	 * @return A structure describing the lines positioned between `verticalOffset1` and `verticalOffset2`.
	 */
	public getLinesViewportData(verticalOffset1: number, verticalOffset2: number): IPartialViewLinesViewportData {
		this.checkPendingChanges();
		verticalOffset1 = verticalOffset1 | 0;
		verticalOffset2 = verticalOffset2 | 0;
		const lineHeight = this.lineHeight;

		// Find first line number
		// We don't live in a perfect world, so the line number might start before or after verticalOffset1
		const startLineNumber = this.getLineNumberAtOrAfterVerticalOffset(verticalOffset1) | 0;
		const startLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(startLineNumber) | 0;

		let endLineNumber = this.lineCount | 0;

		let currentVerticalOffset = startLineNumberVerticalOffset;
		let currentLineRelativeOffset = currentVerticalOffset;

		// IE (all versions) cannot handle units above about 1,533,908 px, so every 500k pixels bring numbers down
		const STEP_SIZE = 500000;
		let bigNumbersDelta = 0;
		if (startLineNumberVerticalOffset >= STEP_SIZE) {
			// Compute a delta that guarantees that lines are positioned at `lineHeight` increments
			bigNumbersDelta = Math.floor(startLineNumberVerticalOffset / STEP_SIZE) * STEP_SIZE;
			bigNumbersDelta = Math.floor(bigNumbersDelta / lineHeight) * lineHeight;

			currentLineRelativeOffset -= bigNumbersDelta;
		}

		const linesOffsets: number[] = [];

		const verticalCenter = verticalOffset1 + (verticalOffset2 - verticalOffset1) / 2;
		let centeredLineNumber = -1;

		// Figure out how far the lines go
		for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {

			if (centeredLineNumber === -1) {
				const currentLineTop = currentVerticalOffset;
				const currentLineBottom = currentVerticalOffset + lineHeight;
				if ((currentLineTop <= verticalCenter && verticalCenter < currentLineBottom) || currentLineTop > verticalCenter) {
					centeredLineNumber = lineNumber;
				}
			}

			// Count current line height in the vertical offsets
			currentVerticalOffset += lineHeight;
			linesOffsets[lineNumber - startLineNumber] = currentLineRelativeOffset;

			// Next line starts immediately after this one
			currentLineRelativeOffset += lineHeight;


			if (currentVerticalOffset >= verticalOffset2) {
				// We have covered the entire viewport area, time to stop
				endLineNumber = lineNumber;
				break;
			}
		}

		if (centeredLineNumber === -1) {
			centeredLineNumber = endLineNumber;
		}

		const endLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(endLineNumber) | 0;

		let completelyVisibleStartLineNumber = startLineNumber;
		let completelyVisibleEndLineNumber = endLineNumber;

		if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
			if (startLineNumberVerticalOffset < verticalOffset1) {
				completelyVisibleStartLineNumber++;
			}
		}
		if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
			if (endLineNumberVerticalOffset + lineHeight > verticalOffset2) {
				completelyVisibleEndLineNumber--;
			}
		}

		return {
			bigNumbersDelta: bigNumbersDelta,
			startLineNumber: startLineNumber,
			endLineNumber: endLineNumber,
			relativeVerticalOffset: linesOffsets,
			centeredLineNumber: centeredLineNumber,
			completelyVisibleStartLineNumber: completelyVisibleStartLineNumber,
			completelyVisibleEndLineNumber: completelyVisibleEndLineNumber
		};
	}

	private checkPendingChanges(): void {
		if (this._pendingChanges.mustCommit()) {
			this._pendingChanges.commit(this);
		}
	}

	public _commitPendingChanges(inserts: EditorWhitespace[], changes: IPendingChange[], removes: IPendingRemove[]): void {
	}
}
