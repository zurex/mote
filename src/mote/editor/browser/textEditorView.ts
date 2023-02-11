import { EditorView } from 'mote/editor/browser/editorView';
import { ICommandDelegate, ViewController } from 'mote/editor/browser/view/viewController';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { IViewModel } from 'mote/editor/common/viewModel';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';
import { IColorTheme } from 'mote/platform/theme/common/themeService';

export class TextEditorView extends EditorView {

	constructor(
		commandDelegate: ICommandDelegate,
		configuration: IEditorConfiguration,
		colorTheme: IColorTheme,
		model: IViewModel,
		userInputEvents: ViewUserInputEvents,
		@ILogService logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const viewController = new ViewController(configuration, model, logService, userInputEvents, commandDelegate, null as any);

		super(configuration, viewController, colorTheme, model, instantiationService);

		this.wireDomNodesUp();
	}
}
