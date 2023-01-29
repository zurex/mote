import * as nls from 'mote/nls';
import { editorBackground, registerColor } from 'mote/platform/theme/common/themeColors';
import { registerThemingParticipant } from 'mote/platform/theme/common/themeService';
import { Color } from 'mote/base/common/color';

/**
 * Definition of the editor colors
 */
export const editorLineHighlight = registerColor('editor.lineHighlightBackground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('lineHighlight', 'Background color for the highlight of line at the cursor position.'));

export const editorCursorForeground = registerColor('editorCursor.foreground', { dark: '#AEAFAD', light: Color.black, hcDark: Color.white, hcLight: '#0F4A85' }, nls.localize('caret', 'Color of the editor cursor.'));
export const editorCursorBackground = registerColor('editorCursor.background', null, nls.localize('editorCursorBackground', 'The background color of the editor cursor. Allows customizing the color of a character overlapped by a block cursor.'));


// contains all color rules that used to defined in editor/browser/widget/editor.css
registerThemingParticipant((theme, collector) => {
	const background = theme.getColor(editorBackground);
	const lineHighlight = theme.getColor(editorLineHighlight);
	const imeBackground = (lineHighlight && !lineHighlight.isTransparent() ? lineHighlight : background);
	if (imeBackground) {
		collector.addRule(`.monaco-editor .inputarea.ime-input { background-color: ${imeBackground}; }`);
	}
});
