import * as strings from 'vs/base/common/strings';
import { Position } from 'mote/editor/common/core/position';
import { TextSelection } from 'mote/editor/common/core/selectionUtils';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { EndOfLinePreference } from 'mote/editor/common/model';

export const _debugComposition = false;

export interface ITypeData {
	text: string;
	type: string;
	replacePrevCharCnt: number;
	replaceNextCharCnt: number;
	positionDelta: number;
}

export interface ISimpleModel {
	getLineCount(): number;
	getLineMaxColumn(lineNumber: number): number;
	getValueInRange(range: EditorRange, eol: EndOfLinePreference): string;
	getValueLengthInRange(range: EditorRange, eol: EndOfLinePreference): number;
	modifyPosition(position: Position, offset: number): Position;
}

export interface IEditableWrapper {
	getValue(): string;
	setValue(reason: string, value: string): void;

	getSelection(): TextSelection;
	getSelectionStart(): number;
	getSelectionEnd(): number;
	setSelectionRange(reason: string, selectionStart: number, selectionEnd: number): void;
}

export class EditableState {

	public static readonly EMPTY = new EditableState('', 0, 0, null, undefined);

	constructor(
		public readonly value: string,
		/** the offset where selection starts inside `value` */
		public readonly selectionStart: number,
		/** the offset where selection ends inside `value` */
		public readonly selectionEnd: number,
		/** the editor range in the view coordinate system that matches the selection inside `value` */
		public readonly selection: EditorRange | null,
		/** the visible line count (wrapped, not necessarily matching \n characters) for the text in `value` before `selectionStart` */
		public readonly newlineCountBeforeSelection: number | undefined,
	) { }

	public toString(): string {
		return `[ <${this.value}>, selectionStart: ${this.selectionStart}, selectionEnd: ${this.selectionEnd}]`;
	}

	public static readFromEditable(editable: IEditableWrapper, previousState: EditableState | null): EditableState {
		const value = editable.getValue();
		const selection = editable.getSelection();
		const selectionStart = selection.startIndex;
		const selectionEnd = selection.endIndex;
		let newlineCountBeforeSelection: number | undefined = undefined;
		if (previousState) {
			const valueBeforeSelectionStart = value.substring(0, selectionStart);
			const previousValueBeforeSelectionStart = previousState.value.substring(0, previousState.selectionStart);
			if (valueBeforeSelectionStart === previousValueBeforeSelectionStart) {
				newlineCountBeforeSelection = previousState.newlineCountBeforeSelection;
			}
		}
		return new EditableState(value, selectionStart, selectionEnd, null, newlineCountBeforeSelection);
	}

	public collapseSelection(): EditableState {
		if (this.selectionStart === this.value.length) {
			return this;
		}
		return new EditableState(this.value, this.value.length, this.value.length, null, undefined);
	}

	public writeToEditable(reason: string, editable: IEditableWrapper, select: boolean): void {
		if (_debugComposition) {
			console.log(`writeToTextArea ${reason}: ${this.toString()}`);
		}
		editable.setValue(reason, this.value);
		if (select) {
			editable.setSelectionRange(reason, this.selectionStart, this.selectionEnd);
		}
	}

	public deduceEditorPosition(offset: number): [Position | null, number, number] {
		if (offset <= this.selectionStart) {
			const str = this.value.substring(offset, this.selectionStart);
			return this._finishDeduceEditorPosition(this.selection?.getStartPosition() ?? null, str, -1);
		}
		if (offset >= this.selectionEnd) {
			const str = this.value.substring(this.selectionEnd, offset);
			return this._finishDeduceEditorPosition(this.selection?.getEndPosition() ?? null, str, 1);
		}
		const str1 = this.value.substring(this.selectionStart, offset);
		if (str1.indexOf(String.fromCharCode(8230)) === -1) {
			return this._finishDeduceEditorPosition(this.selection?.getStartPosition() ?? null, str1, 1);
		}
		const str2 = this.value.substring(offset, this.selectionEnd);
		return this._finishDeduceEditorPosition(this.selection?.getEndPosition() ?? null, str2, -1);
	}

	private _finishDeduceEditorPosition(anchor: Position | null, deltaText: string, signum: number): [Position | null, number, number] {
		let lineFeedCnt = 0;
		let lastLineFeedIndex = -1;
		while ((lastLineFeedIndex = deltaText.indexOf('\n', lastLineFeedIndex + 1)) !== -1) {
			lineFeedCnt++;
		}
		return [anchor, signum * deltaText.length, lineFeedCnt];
	}

	public static deduceInput(previousState: EditableState, currentState: EditableState, couldBeEmojiInput: boolean): ITypeData {
		if (!previousState) {
			// This is the EMPTY state
			return {
				text: '',
				type: '',
				replacePrevCharCnt: 0,
				replaceNextCharCnt: 0,
				positionDelta: 0
			};
		}

		if (_debugComposition) {
			console.log('------------------------deduceInput');
			console.log(`PREVIOUS STATE: ${previousState.toString()}`);
			console.log(`CURRENT STATE: ${currentState.toString()}`);
		}

		const prefixLength = Math.min(
			strings.commonPrefixLength(previousState.value, currentState.value),
			previousState.selectionStart,
			currentState.selectionStart
		);
		const suffixLength = Math.min(
			strings.commonSuffixLength(previousState.value, currentState.value),
			previousState.value.length - previousState.selectionEnd,
			currentState.value.length - currentState.selectionEnd
		);
		const previousValue = previousState.value.substring(prefixLength, previousState.value.length - suffixLength);
		const currentValue = currentState.value.substring(prefixLength, currentState.value.length - suffixLength);
		const previousSelectionStart = previousState.selectionStart - prefixLength;
		const previousSelectionEnd = previousState.selectionEnd - prefixLength;
		const currentSelectionStart = currentState.selectionStart - prefixLength;
		const currentSelectionEnd = currentState.selectionEnd - prefixLength;

		if (_debugComposition) {
			console.log(`AFTER DIFFING PREVIOUS STATE: <${previousValue}>, selectionStart: ${previousSelectionStart}, selectionEnd: ${previousSelectionEnd}`);
			console.log(`AFTER DIFFING CURRENT STATE: <${currentValue}>, selectionStart: ${currentSelectionStart}, selectionEnd: ${currentSelectionEnd}`);
		}

		if (currentSelectionStart === currentSelectionEnd) {
			// no current selection
			const replacePreviousCharacters = (previousState.selectionStart - prefixLength);
			if (_debugComposition) {
				console.log(`REMOVE PREVIOUS: ${replacePreviousCharacters} chars`);
			}

			return {
				text: currentState.value,
				type: currentValue,
				replacePrevCharCnt: replacePreviousCharacters,
				replaceNextCharCnt: 0,
				positionDelta: 0
			};
		}

		// there is a current selection => composition case
		const replacePreviousCharacters = previousSelectionEnd - previousSelectionStart;
		return {
			text: currentState.value,
			type: currentValue,
			replacePrevCharCnt: replacePreviousCharacters,
			replaceNextCharCnt: 0,
			positionDelta: 0
		};
	}

	public static deduceAndroidCompositionInput(previousState: EditableState, currentState: EditableState): ITypeData {
		if (!previousState) {
			// This is the EMPTY state
			return {
				text: '',
				type: '',
				replacePrevCharCnt: 0,
				replaceNextCharCnt: 0,
				positionDelta: 0
			};
		}

		if (_debugComposition) {
			console.log('------------------------deduceAndroidCompositionInput');
			console.log(`PREVIOUS STATE: ${previousState.toString()}`);
			console.log(`CURRENT STATE: ${currentState.toString()}`);
		}

		if (previousState.value === currentState.value) {
			return {
				text: '',
				type: '',
				replacePrevCharCnt: 0,
				replaceNextCharCnt: 0,
				positionDelta: currentState.selectionEnd - previousState.selectionEnd
			};
		}

		const prefixLength = Math.min(strings.commonPrefixLength(previousState.value, currentState.value), previousState.selectionEnd);
		const suffixLength = Math.min(strings.commonSuffixLength(previousState.value, currentState.value), previousState.value.length - previousState.selectionEnd);
		const previousValue = previousState.value.substring(prefixLength, previousState.value.length - suffixLength);
		const currentValue = currentState.value.substring(prefixLength, currentState.value.length - suffixLength);
		const previousSelectionStart = previousState.selectionStart - prefixLength;
		const previousSelectionEnd = previousState.selectionEnd - prefixLength;
		const currentSelectionStart = currentState.selectionStart - prefixLength;
		const currentSelectionEnd = currentState.selectionEnd - prefixLength;

		if (_debugComposition) {
			console.log(`AFTER DIFFING PREVIOUS STATE: <${previousValue}>, selectionStart: ${previousSelectionStart}, selectionEnd: ${previousSelectionEnd}`);
			console.log(`AFTER DIFFING CURRENT STATE: <${currentValue}>, selectionStart: ${currentSelectionStart}, selectionEnd: ${currentSelectionEnd}`);
		}

		return {
			text: currentState.value,
			type: currentValue,
			replacePrevCharCnt: previousSelectionEnd,
			replaceNextCharCnt: previousValue.length - previousSelectionEnd,
			positionDelta: currentSelectionEnd - currentValue.length
		};
	}
}

export class PagedScreenReaderStrategy {
	private static _getPageOfLine(lineNumber: number, linesPerPage: number): number {
		return Math.floor((lineNumber - 1) / linesPerPage);
	}

	private static _getRangeForPage(page: number, linesPerPage: number): EditorRange {
		const offset = page * linesPerPage;
		const startLineNumber = offset + 1;
		const endLineNumber = offset + linesPerPage;
		return new EditorRange(startLineNumber, 1, endLineNumber + 1, 1);
	}

	public static fromEditorSelection(model: ISimpleModel, selection: EditorRange, linesPerPage: number, trimLongText: boolean): EditableState {
		// Chromium handles very poorly text even of a few thousand chars
		// Cut text to avoid stalling the entire UI
		const LIMIT_CHARS = 500;

		const selectionStartPage = PagedScreenReaderStrategy._getPageOfLine(selection.startLineNumber, linesPerPage);
		const selectionStartPageRange = PagedScreenReaderStrategy._getRangeForPage(selectionStartPage, linesPerPage);

		const selectionEndPage = PagedScreenReaderStrategy._getPageOfLine(selection.endLineNumber, linesPerPage);
		const selectionEndPageRange = PagedScreenReaderStrategy._getRangeForPage(selectionEndPage, linesPerPage);

		let pretextRange = selectionStartPageRange.intersectRanges(new EditorRange(1, 1, selection.startLineNumber, selection.startColumn))!;
		if (trimLongText && model.getValueLengthInRange(pretextRange, EndOfLinePreference.LF) > LIMIT_CHARS) {
			const pretextStart = model.modifyPosition(pretextRange.getEndPosition(), -LIMIT_CHARS);
			pretextRange = EditorRange.fromPositions(pretextStart, pretextRange.getEndPosition());
		}
		const pretext = model.getValueInRange(pretextRange, EndOfLinePreference.LF);

		const lastLine = model.getLineCount();
		const lastLineMaxColumn = model.getLineMaxColumn(lastLine);
		let posttextRange = selectionEndPageRange.intersectRanges(new EditorRange(selection.endLineNumber, selection.endColumn, lastLine, lastLineMaxColumn))!;
		if (trimLongText && model.getValueLengthInRange(posttextRange, EndOfLinePreference.LF) > LIMIT_CHARS) {
			const posttextEnd = model.modifyPosition(posttextRange.getStartPosition(), LIMIT_CHARS);
			posttextRange = EditorRange.fromPositions(posttextRange.getStartPosition(), posttextEnd);
		}
		const posttext = model.getValueInRange(posttextRange, EndOfLinePreference.LF);


		let text: string;
		if (selectionStartPage === selectionEndPage || selectionStartPage + 1 === selectionEndPage) {
			// take full selection
			text = model.getValueInRange(selection, EndOfLinePreference.LF);
		} else {
			const selectionRange1 = selectionStartPageRange.intersectRanges(selection)!;
			const selectionRange2 = selectionEndPageRange.intersectRanges(selection)!;
			text = (
				model.getValueInRange(selectionRange1, EndOfLinePreference.LF)
				+ String.fromCharCode(8230)
				+ model.getValueInRange(selectionRange2, EndOfLinePreference.LF)
			);
		}
		if (trimLongText && text.length > 2 * LIMIT_CHARS) {
			text = text.substring(0, LIMIT_CHARS) + String.fromCharCode(8230) + text.substring(text.length - LIMIT_CHARS, text.length);
		}

		return new EditableState(pretext + text + posttext, pretext.length, pretext.length + text.length, selection, pretextRange.endLineNumber - pretextRange.startLineNumber);
	}
}
