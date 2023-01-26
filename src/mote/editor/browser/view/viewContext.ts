import { ViewController } from 'mote/editor/browser/view/viewController';
import RecordStore from 'mote/platform/store/common/recordStore';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { IViewLayout, IViewModel } from 'mote/editor/common/viewModel';

export class ViewContext {

	constructor(
		public readonly configuration: IEditorConfiguration,
		public readonly contentStore: RecordStore,
		public readonly viewLayout: IViewLayout,
		public readonly controller: ViewController,
		public readonly viewModel: IViewModel
	) {

	}

	public addEventHandler(eventHandler: ViewEventHandler): void {
		this.viewModel.addViewEventHandler(eventHandler);
	}

	public removeEventHandler(eventHandler: ViewEventHandler): void {
		this.viewModel.removeViewEventHandler(eventHandler);
	}
}
