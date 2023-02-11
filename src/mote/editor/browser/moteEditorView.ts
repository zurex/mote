import * as dom from 'mote/base/browser/dom';
import { createFastDomNode, FastDomNode } from 'mote/base/browser/fastDomNode';
import { setStyles } from 'mote/base/browser/jsx/createElement';
import { EditorView } from 'mote/editor/browser/editorView';
import { ICommandDelegate, ViewController } from 'mote/editor/browser/view/viewController';
import { ViewUserInputEvents } from 'mote/editor/browser/view/viewUserInputEvents';
import { ViewLineExtensionsRegistry } from 'mote/editor/browser/viewLineExtensions';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { IViewModel } from 'mote/editor/common/viewModel';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { ILogService } from 'mote/platform/log/common/log';
import BlockStore from 'mote/platform/store/common/blockStore';
import { IColorTheme } from 'mote/platform/theme/common/themeService';

export class MoteEditorView extends EditorView {

	private headerContainer!: FastDomNode<HTMLElement>;

	constructor(
		commandDelegate: ICommandDelegate,
		configuration: IEditorConfiguration,
		colorTheme: IColorTheme,
		model: IViewModel,
		userInputEvents: ViewUserInputEvents,
		private pageStore: BlockStore,
		@ILogService logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const viewController = new ViewController(configuration, model, logService, userInputEvents, commandDelegate, pageStore.getContentStore());
		super(configuration, viewController, colorTheme, model, instantiationService);

		this.headerContainer = createFastDomNode<HTMLDivElement>(dom.$(''));
		this.wireUp(viewController);
	}

	private wireUp(viewController: ViewController) {
		this.createHeader(this.linesContent, viewController);
		super.wireDomNodesUp();
	}

	createHeader(parent: FastDomNode<HTMLElement>, viewController: ViewController,) {
		this.createCover(parent);
		const headerContainer = this.headerContainer;

		const headerDomNode = createFastDomNode(dom.$('div'));
		headerDomNode.setAttribute('data-root', 'true');
		headerDomNode.setAttribute('data-index', '0');
		headerDomNode.setAttribute('data-block-id', 'root');


		headerContainer.domNode.style.paddingLeft = this.getSafePaddingLeftCSS(96);
		headerContainer.domNode.style.paddingRight = this.getSafePaddingRightCSS(96);

		const viewLineContrib = ViewLineExtensionsRegistry.getViewLineContribution('text')!;
		const headerHandler = this.instantiationService.createInstance(viewLineContrib.ctor, 0, this.context, viewController, {
			placeholder: 'Untitled', forcePlaceholder: true
		});
		headerHandler.setValue(this.pageStore);
		headerContainer.appendChild(headerHandler.getDomNode());

		this._register(this.pageStore.onDidUpdate(() => {
			//headerHandler.setValue(this.pageStore);
		}));

		headerDomNode.appendChild(headerContainer);
		setStyles(headerDomNode.domNode, this.getTitleStyle());
		parent.appendChild(headerDomNode);

		this.headerContainer = headerContainer;
	}

	createCover(parent: FastDomNode<HTMLElement>) {
		const coverDomNode = createFastDomNode(dom.$(''));
		coverDomNode.domNode.style.height = '100px';
		parent.appendChild(coverDomNode);
	}

	override layoutChildren(paddingLeft: string, paddingRight: string, width: number): void {
		this.headerContainer.domNode.style.paddingLeft = paddingLeft;
		this.headerContainer.domNode.style.paddingRight = paddingRight;
		this.headerContainer.setWidth(width);
	}
}
