import { EditorView } from 'mote/editor/browser/editorView';
import { MoteEditorView } from 'mote/editor/browser/moteEditorView';
import { ICommandDelegate } from 'mote/editor/browser/view/viewController';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { AbstractEditorWidget } from 'mote/editor/browser/widget/editorWidget';
import { StoreBasedTextModel } from 'mote/editor/common/model/storeBasedTextModel';
import { ViewModel } from 'mote/editor/common/viewModel/viewModelImpl';
import BlockStore from 'mote/platform/store/common/blockStore';

export class MoteEditorWidget extends AbstractEditorWidget {

	private pageStore!: BlockStore | null;

	setStore(store: BlockStore) {
		if (store === undefined) {
			return;
		}
		if (null === store && this.modelData === null) {
			return;
		}
		if (this.modelData && this.pageStore === store) {
			// Current store is the new store
			return;
		}

		this.detachStore();
		this.attachStore(store);
	}

	private attachStore(store: BlockStore) {
		this.pageStore = store;
		const textModel = new StoreBasedTextModel(store);
		super._attachModel(textModel);
	}

	private detachStore() {
		super._detachModel();
		this.pageStore = null;
	}

	override createView(viewModel: ViewModel, commandDelegate: ICommandDelegate, viewUserInputEvents: ViewUserInputEvents): [EditorView, boolean] {
		const editorView = this.instantiationService.createInstance(
			MoteEditorView, commandDelegate, this.configuration, this.themeService.getColorTheme(), viewModel, viewUserInputEvents, this.pageStore!);
		return [editorView, true];
	}
}
