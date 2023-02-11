import { EditorView } from 'mote/editor/browser/editorView';
import { TextEditorView } from 'mote/editor/browser/textEditorView';
import { ICommandDelegate } from 'mote/editor/browser/view/viewController';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { AbstractEditorWidget } from 'mote/editor/browser/widget/editorWidget';
import { ViewModel } from 'mote/editor/common/viewModel/viewModelImpl';

export class TextEditorWidget extends AbstractEditorWidget {

	protected createView(viewModel: ViewModel, commandDelegate: ICommandDelegate, viewUserInputEvents: ViewUserInputEvents): [EditorView, boolean] {
		const editorView = this.instantiationService.createInstance(
			TextEditorView, commandDelegate, this.configuration, this.themeService.getColorTheme(), viewModel, viewUserInputEvents);
		return [editorView, true];
	}
}
