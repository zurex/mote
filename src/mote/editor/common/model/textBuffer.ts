import { keepLineTypes, textBasedTypes } from 'mote/editor/common/blockTypes';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { EditorRange } from 'mote/editor/common/core/editorRange';
import { Transaction } from 'mote/editor/common/core/transaction';
import { ApplyEditsResult, EndOfLinePreference, IInternalModelContentChange, ISingleEditOperationIdentifier, ITextBuffer, IValidEditOperation, ValidAnnotatedEditOperation } from 'mote/editor/common/model';
import { collectValueFromSegment } from 'mote/editor/common/segmentUtils';
import BlockStore from 'mote/platform/store/common/blockStore';
import { BlockTypes } from 'mote/platform/store/common/record';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';
import * as segmentUtils from 'mote/editor/common/segmentUtils';

export interface IValidatedEditOperation {
	sortIndex: number;
	identifier: ISingleEditOperationIdentifier | null;
	range: EditorRange;
	rangeOffset: number;
	rangeLength: number;
	text: string;
	eolCount: number;
	firstLineLength: number;
	lastLineLength: number;
	forceMoveMarkers: boolean;
	isAutoWhitespaceEdit: boolean;
}

interface IReverseSingleEditOperation extends IValidEditOperation {
	sortIndex: number;
}

export class TextBuffer implements ITextBuffer {

	/**
	 * Assumes `operations` are validated and sorted ascending
	 */
	public static getInverseEditRanges(operations: IValidatedEditOperation[]): EditorRange[] {
		const result: EditorRange[] = [];

		let prevOpEndLineNumber: number = 0;
		let prevOpEndColumn: number = 0;
		let prevOp: IValidatedEditOperation | null = null;
		for (let i = 0, len = operations.length; i < len; i++) {
			const op = operations[i];

			let startLineNumber: number;
			let startColumn: number;

			if (prevOp) {
				if (prevOp.range.endLineNumber === op.range.startLineNumber) {
					startLineNumber = prevOpEndLineNumber;
					startColumn = prevOpEndColumn + (op.range.startColumn - prevOp.range.endColumn);
				} else {
					startLineNumber = prevOpEndLineNumber + (op.range.startLineNumber - prevOp.range.endLineNumber);
					startColumn = op.range.startColumn;
				}
			} else {
				startLineNumber = op.range.startLineNumber;
				startColumn = op.range.startColumn;
			}

			let resultRange: EditorRange;

			if (op.text!.length > 0) {
				// the operation inserts something
				const lineCount = op.eolCount + 1;

				if (lineCount === 1) {
					// single line insert
					resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber, startColumn + op.text.length);
				} else {
					// multi line insert
					resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber + lineCount - 1, op.lastLineLength + 1);
				}
			} else {
				// There is nothing to insert
				resultRange = new EditorRange(startLineNumber, startColumn, startLineNumber, startColumn);
			}

			prevOpEndLineNumber = resultRange.endLineNumber;
			prevOpEndColumn = resultRange.endColumn;

			result.push(resultRange);
			prevOp = op;
		}

		return result;
	}

	constructor(private readonly pageStore: BlockStore) { }

	public getEOL(): '\r\n' | '\n' {
		return '\n';
	}

	public getLineCount(): number {
		const blockIds: string[] = this.pageStore.getContentStore().getValue() || [];
		return blockIds.length;
	}

	public getLineLength(lineNumber: number): number {
		return this.getLineContent(lineNumber).length;
	}

	public getLineContent(lineNumber: number): string {
		const lineStore = this.getLineStore(lineNumber);
		return collectValueFromSegment(lineStore.getTitleStore().getValue());
	}

	public getLineStore(lineNumber: number): BlockStore {
		if (lineNumber < 0 || lineNumber > this.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}
		if (lineNumber === 0) {
			// lineNumber == 0 means it's the header
			return this.pageStore;
		}
		return StoreUtils.createStoreForLineNumber(lineNumber, this.pageStore.getContentStore());
	}

	public getValueInRange(range: EditorRange, eol: EndOfLinePreference = EndOfLinePreference.TextDefined): string {
		if (range.isEmpty()) {
			return '';
		}

		if (range.startLineNumber === range.endLineNumber) {
			return this.getLineContent(range.startLineNumber).substring(range.startColumn - 1, range.endColumn);
		}
		let result = '';
		for (let lineNumber = range.startLineNumber; lineNumber < range.endLineNumber; lineNumber++) {
			const content = this.getLineContent(lineNumber);
			if (lineNumber === range.startLineNumber) {
				result += content.substring(range.startColumn - 1);
				continue;
			}
			if (lineNumber === range.endLineNumber) {
				result += content.substring(0, range.endColumn);
				continue;
			}
			result += content;
		}
		return result;
	}

	public getCharacterCountInRange(range: EditorRange, eol: EndOfLinePreference): number {
		// TODO: need handle emoji
		return this.getValueLengthInRange(range, eol);
	}

	public getValueLengthInRange(range: EditorRange, eol: EndOfLinePreference = EndOfLinePreference.TextDefined): number {
		return this.getValueInRange(range).length;
	}

	private get contentStore() {
		return this.pageStore.getContentStore();
	}

	public applyEdits(rawOperations: ValidAnnotatedEditOperation[], recordTrimAutoWhitespace: boolean, computeUndoEdits: boolean): ApplyEditsResult {

		const operations: IValidatedEditOperation[] = [];
		for (let i = 0; i < rawOperations.length; i++) {
			const op = rawOperations[i];

			let validText = '';
			let eolCount = 0;
			let firstLineLength = 0;
			let lastLineLength = 0;
			if (op.text) {
				validText = op.text;
				[eolCount, firstLineLength, lastLineLength] = TextBuffer.countEOL(op);
			}

			operations[i] = {
				sortIndex: i,
				identifier: op.identifier || null,
				range: op.range,
				rangeOffset: 0,
				rangeLength: 0,
				text: validText,
				eolCount: eolCount,
				firstLineLength: firstLineLength,
				lastLineLength: lastLineLength,
				forceMoveMarkers: false,
				isAutoWhitespaceEdit: false,
			};
		}

		let hasTouchingRanges = false;
		for (let i = 0, count = operations.length - 1; i < count; i++) {
			const rangeEnd = operations[i].range.getEndPosition();
			const nextRangeStart = operations[i + 1].range.getStartPosition();

			if (nextRangeStart.isBeforeOrEqual(rangeEnd)) {
				if (nextRangeStart.isBefore(rangeEnd)) {
					// overlapping ranges
					throw new Error('Overlapping ranges are not allowed!');
				}
				hasTouchingRanges = true;
			}
		}

		// reverse
		const reverseRanges = computeUndoEdits ? TextBuffer.getInverseEditRanges(operations) : [];
		let reverseOperations: IReverseSingleEditOperation[] | null = null;
		if (computeUndoEdits) {

			//let reverseRangeDeltaOffset = 0;
			reverseOperations = [];
			for (let i = 0; i < operations.length; i++) {
				const op = operations[i];
				const reverseRange = reverseRanges[i];
				const bufferText = this.getValueInRange(op.range);
				//const reverseRangeOffset = op.rangeOffset + reverseRangeDeltaOffset;
				//reverseRangeDeltaOffset += (op.text.length - bufferText.length);

				reverseOperations[i] = {
					sortIndex: i,
					identifier: op.identifier,
					range: reverseRange,
					text: bufferText,
					textChange: null as any//new TextChange(op.rangeOffset, bufferText, reverseRangeOffset, op.text)
				};
			}

			// Can only sort reverse operations when the order is not significant
			if (!hasTouchingRanges) {
				reverseOperations.sort((a, b) => a.sortIndex - b.sortIndex);
			}
		}

		const contentChanges = this.doApplyEdits(operations);
		const trimAutoWhitespaceLineNumbers: number[] | null = null;

		return new ApplyEditsResult(
			reverseOperations,
			contentChanges,
			trimAutoWhitespaceLineNumbers
		);
	}

	private doApplyEdits(operations: IValidatedEditOperation[]): IInternalModelContentChange[] {
		const contentChanges: IInternalModelContentChange[] = [];

		Transaction.createAndCommit((transaction) => {
			// operations are from bottom to top
			for (let i = 0; i < operations.length; i++) {
				const op = operations[i];

				const startLineNumber = op.range.startLineNumber;
				const startColumn = op.range.startColumn;
				const endLineNumber = op.range.endLineNumber;
				const endColumn = op.range.endColumn;

				if (startLineNumber === endLineNumber && startColumn === endColumn && op.text!.length === 0) {
					// no-op
					continue;
				}

				if (op.text) {
					if (op.text === '\n') {
						// insert new line
						this.enter(op.range, transaction);
					} else {
						// replacement
						this.delete(op.range, transaction);
						this.insert(op.range, op.text, transaction);
					}
				} else {
					// deletion
					this.delete(op.range, transaction);
				}

				const contentChangeRange = new EditorRange(startLineNumber, startColumn, endLineNumber, endColumn);
				contentChanges.push({
					range: contentChangeRange,
					//rangeLength: op.rangeLength,
					text: op.text!,
					//rangeOffset: op.rangeOffset,
					forceMoveMarkers: op.forceMoveMarkers
				});
			}
		}, this.pageStore.userId);

		return contentChanges;
	}

	private enter(range: EditorRange, transaction: Transaction) {
		if (range.startLineNumber === 0) {
			// special case for header

		} else {
			let type = 'text';
			const lineStore = this.getLineStore(range.startLineNumber);
			if (keepLineTypes.has(lineStore.getType() || '')) {
				// Some blocks required keep same styles in next line
				// Just like todo, list
				type = lineStore.getType()!;
			}
			const child: BlockStore = EditOperation.createBlockStore(type, transaction, this.contentStore);
			EditOperation.insertChildAfterTarget(
				this.contentStore, child, lineStore, transaction);
		}
	}

	private delete(range: EditorRange, transaction: Transaction) {
		if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
			// it means insert a new text
			return;
		}
		const store = this.getLineStore(range.endLineNumber);
		const record = store.getValue();
		if (range.startLineNumber !== range.endLineNumber) {
			// delete block
			if (textBasedTypes.has(record.type)) {
				// turnInto text for rich type
				EditOperation.turnInto(store, BlockTypes.text as any, transaction);
			} else {
				EditOperation.removeChild(this.contentStore, store, transaction);
			}
		} else {
			// delete current block content
			const titleStore = store.getTitleStore();
			const storeValue = titleStore.getValue();
			const newRecord = segmentUtils.remove(storeValue, range.startColumn - 1, range.endColumn - 1);
			EditOperation.addSetOperationForStore(titleStore, newRecord, transaction);
		}
	}

	private insert(range: EditorRange, text: string, transaction: Transaction) {
		const store = this.getLineStore(range.startLineNumber).getTitleStore();
		const segment = segmentUtils.combineArray(text, []) as segmentUtils.ISegment;

		const storeValue = store.getValue();

		EditOperation.addSetOperationForStore(
			store,
			segmentUtils.merge(storeValue, [segment], range.startColumn - 1),
			transaction
		);

	}

	public static countEOL(operation: ValidAnnotatedEditOperation) {
		let eolCount = 0;
		const startColumn = operation.range.startColumn;

		const firstLineLength = startColumn + operation.text!.length;
		const lastLineLength = 0;
		if ('\n' === operation.text![operation.text!.length - 1]) {
			eolCount += 1;
		}
		return [eolCount, firstLineLength, lastLineLength];
	}
}
