import { LineTokens } from 'mote/editor/common/tokens/lineTokens';

/**
 * Provides tokenization related functionality of the text model.
*/
export interface ITokenizationTextModelPart {

	getLineTokens(lineNumber: number): LineTokens;
}
