import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EditorSelection } from 'mote/editor/common/core/editorSelection';
import { IPartialViewLinesViewportData, IViewModel, IViewWhitespaceViewportData, ViewLineRenderingData } from 'mote/editor/common/viewModel';

export class ViewportData {

	/**
	 * The line number at which to start rendering (inclusive).
	 */
	public readonly startLineNumber: number;

	/**
	 * The line number at which to end rendering (inclusive).
	 */
	public readonly endLineNumber: number;

	/**
	 * relativeVerticalOffset[i] is the `top` position for line at `i` + `startLineNumber`.
	 */
	public readonly relativeVerticalOffset: number[];

	/**
	 * The viewport as a range (startLineNumber,1) -> (endLineNumber,maxColumn(endLineNumber)).
	 */
	public readonly visibleRange: EditorRange;


	constructor(
		public readonly selections: EditorSelection[],
		partialData: IPartialViewLinesViewportData,
		// Positioning information about gaps whitespace.
		public readonly whitespaceViewportData: IViewWhitespaceViewportData[],
		private readonly model: IViewModel
	) {
		this.startLineNumber = partialData.startLineNumber | 0;
		this.endLineNumber = partialData.endLineNumber | 0;
		this.relativeVerticalOffset = partialData.relativeVerticalOffset;

		this.visibleRange = new EditorRange(
			partialData.startLineNumber,
			this.model.getLineMinColumn(partialData.startLineNumber),
			partialData.endLineNumber,
			this.model.getLineMaxColumn(partialData.endLineNumber)
		);
	}

	public getViewLineRenderingData(lineNumber: number): ViewLineRenderingData {
		return this.model.getViewportViewLineRenderingData(this.visibleRange, lineNumber);
	}

}
