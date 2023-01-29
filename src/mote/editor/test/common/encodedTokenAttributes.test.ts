import * as assert from 'assert';
import { FontStyle, TokenMetadata } from 'mote/editor/common/encodedTokenAttributes';

suite('Editor Common - TokenMetadata', () => {

	test('getFontStyle', () => {

		let metadata = 0;

		metadata = TokenMetadata.setFontStyle(metadata, FontStyle.Italic);
		assert.equal(TokenMetadata.getFontStyle(metadata) & FontStyle.Italic, true);

		metadata = TokenMetadata.setFontStyle(metadata, FontStyle.Bold);
		assert.equal((TokenMetadata.getFontStyle(metadata) & FontStyle.Italic) >= 1, true);
		assert.equal((TokenMetadata.getFontStyle(metadata) & FontStyle.Bold) >= 1, true);
		assert.equal((TokenMetadata.getFontStyle(metadata) & FontStyle.Underline) >= 1, false);
	});
});
