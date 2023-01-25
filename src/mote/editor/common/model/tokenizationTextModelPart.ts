import { TextModel } from 'mote/editor/common/model/textModel';
import { TextModelPart } from 'mote/editor/common/model/textModelPart';
import { ITokenizationTextModelPart } from 'mote/editor/common/tokenizationTextModelPart';
import { LineTokens } from 'mote/editor/common/tokens/lineTokens';

export class TokenizationTextModelPart extends TextModelPart implements ITokenizationTextModelPart {

	constructor(
		private readonly _textModel: TextModel,
	) {
		super();
	}

	public getLineTokens(lineNumber: number): LineTokens {
		if (lineNumber < 1 || lineNumber > this._textModel.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}

		return this._getLineTokens(lineNumber);
	}

	private _getLineTokens(lineNumber: number): LineTokens {
		const lineText = this._textModel.getLineContent(lineNumber);
		const syntacticTokens = new LineTokens([], lineText);
		return syntacticTokens;
	}
}
