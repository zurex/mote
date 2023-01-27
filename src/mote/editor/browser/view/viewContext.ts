import { ViewController } from 'mote/editor/browser/view/viewController';
import RecordStore from 'mote/platform/store/common/recordStore';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { IViewLayout, IViewModel } from 'mote/editor/common/viewModel';
import { IColorTheme } from 'mote/platform/theme/common/themeService';
import { EditorTheme } from 'mote/editor/common/editorTheme';

export class ViewContext {

	public readonly theme: EditorTheme;

	constructor(
		theme: IColorTheme,
		public readonly configuration: IEditorConfiguration,
		public readonly contentStore: RecordStore,
		public readonly viewLayout: IViewLayout,
		public readonly controller: ViewController,
		public readonly viewModel: IViewModel
	) {
		this.theme = new EditorTheme(theme);
	}

	public addEventHandler(eventHandler: ViewEventHandler): void {
		this.viewModel.addViewEventHandler(eventHandler);
	}

	public removeEventHandler(eventHandler: ViewEventHandler): void {
		this.viewModel.removeViewEventHandler(eventHandler);
	}
}
