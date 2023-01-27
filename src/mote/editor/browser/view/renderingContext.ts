import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Position } from 'mote/editor/common/core/position';
import { IViewLayout } from 'mote/editor/common/viewModel';
import { ViewportData } from 'mote/editor/common/viewLayout/viewLinesViewportData';

export interface IViewLines {
	linesVisibleRangesForRange(range: EditorRange, includeNewLines: boolean): LineVisibleRanges[] | null;
	visibleRangeForPosition(position: Position): HorizontalPosition | null;
	lineHeightForPosition(position: Position): number | null;
}

export class LineVisibleRanges {
	/**
	 * Returns the element with the smallest `lineNumber`.
	 */
	public static firstLine(ranges: LineVisibleRanges[] | null): LineVisibleRanges | null {
		if (!ranges) {
			return null;
		}
		let result: LineVisibleRanges | null = null;
		for (const range of ranges) {
			if (!result || range.lineNumber < result.lineNumber) {
				result = range;
			}
		}
		return result;
	}

	/**
	 * Returns the element with the largest `lineNumber`.
	 */
	public static lastLine(ranges: LineVisibleRanges[] | null): LineVisibleRanges | null {
		if (!ranges) {
			return null;
		}
		let result: LineVisibleRanges | null = null;
		for (const range of ranges) {
			if (!result || range.lineNumber > result.lineNumber) {
				result = range;
			}
		}
		return result;
	}

	constructor(
		public readonly outsideRenderedLine: boolean,
		public readonly lineNumber: number,
		public readonly ranges: HorizontalRange[]
	) { }
}

export class HorizontalRange {
	_horizontalRangeBrand: void = undefined;

	public left: number;
	public width: number;

	public static from(ranges: FloatHorizontalRange[]): HorizontalRange[] {
		const result = new Array(ranges.length);
		for (let i = 0, len = ranges.length; i < len; i++) {
			const range = ranges[i];
			result[i] = new HorizontalRange(range.left, range.width);
		}
		return result;
	}

	constructor(left: number, width: number) {
		this.left = Math.round(left);
		this.width = Math.round(width);
	}

	public toString(): string {
		return `[${this.left},${this.width}]`;
	}
}

export class FloatHorizontalRange {
	_floatHorizontalRangeBrand: void = undefined;

	public left: number;
	public width: number;

	constructor(left: number, width: number) {
		this.left = left;
		this.width = width;
	}

	public toString(): string {
		return `[${this.left},${this.width}]`;
	}

	public static compare(a: FloatHorizontalRange, b: FloatHorizontalRange): number {
		return a.left - b.left;
	}
}

export class HorizontalPosition {
	public outsideRenderedLine: boolean;
	/**
	 * Math.round(this.originalLeft)
	 */
	public left: number;
	public originalLeft: number;

	constructor(outsideRenderedLine: boolean, left: number) {
		this.outsideRenderedLine = outsideRenderedLine;
		this.originalLeft = left;
		this.left = Math.round(this.originalLeft);
	}
}


export abstract class RestrictedRenderingContext {

	public readonly scrollWidth: number;
	public readonly scrollHeight: number;

	public readonly visibleRange: EditorRange;
	public readonly bigNumbersDelta: number = 0;

	constructor(private readonly viewLayout: IViewLayout, public readonly viewportData: ViewportData) {
		this.scrollWidth = this.viewLayout.getScrollWidth();
		this.scrollHeight = this.viewLayout.getScrollHeight();

		this.visibleRange = this.viewportData.visibleRange;
	}

	public getVerticalOffsetForLineNumber(lineNumber: number, includeViewZones?: boolean): number {
		return this.viewLayout.getVerticalOffsetForLineNumber(lineNumber, includeViewZones);
	}
}

export class ViewRenderingContext extends RestrictedRenderingContext {

	constructor(viewLayout: IViewLayout, viewportData: ViewportData, private readonly viewLines: IViewLines) {
		super(viewLayout, viewportData);
	}

	public visibleRangeForPosition(position: Position): HorizontalPosition | null {
		return this.viewLines.visibleRangeForPosition(position);
	}

	public linesVisibleRangesForRange(range: EditorRange, includeNewLines: boolean): LineVisibleRanges[] | null {
		return this.viewLines.linesVisibleRangesForRange(range, includeNewLines);
	}

	public lineHeightForPosition(position: Position): number | null {
		return this.viewLines.lineHeightForPosition(position);
	}
}

export class VisibleRanges {
	constructor(
		public readonly outsideRenderedLine: boolean,
		public readonly ranges: FloatHorizontalRange[]
	) {
	}
}
