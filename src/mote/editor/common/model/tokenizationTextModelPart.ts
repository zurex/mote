import { IReadonlyTextBuffer } from 'mote/editor/common/model';
import { TextModelPart } from 'mote/editor/common/model/textModelPart';
import { ISegment } from 'mote/editor/common/segmentUtils';
import { ITokenizationTextModelPart } from 'mote/editor/common/tokenizationTextModelPart';
import { LineTokens } from 'mote/editor/common/tokens/lineTokens';

export class TokenizationTextModelPart extends TextModelPart implements ITokenizationTextModelPart {

	constructor(
		private readonly textBuffer: IReadonlyTextBuffer,
	) {
		super();
	}

	public getLineTokens(lineNumber: number): LineTokens {
		if (lineNumber < 0 || lineNumber > this.textBuffer.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}

		return this._getLineTokens(lineNumber);
	}

	private _getLineTokens(lineNumber: number): LineTokens {
		let segments: ISegment[];
		if (this.textBuffer.getLineStore) {
			segments = this.textBuffer.getLineStore(lineNumber).getTitleStore().getValue() || [];
		} else {
			const lineText = this.textBuffer.getLineContent(lineNumber);
			segments = [[lineText]];
		}

		return LineTokens.fromSegments(segments);
	}
}
