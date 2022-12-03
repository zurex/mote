
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IMoteEditorService = createDecorator<IMoteEditorService>('moteEditorService');

export interface IMoteEditorService {

	/**
	 * Returns the current focused code editor (if the focus is in the editor or in an editor widget) or null.
	 */
	getFocusedCodeEditor(): IMoteEditor | null;


	getActiveCodeEditor(): IMoteEditor | null;
}
