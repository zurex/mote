import { Disposable, IDisposable, toDisposable } from 'mote/base/common/lifecycle';
import { IContextViewDelegate, IContextViewService } from 'mote/platform/contextview/browser/contextView';
import { ContextView, ContextViewDOMPosition } from 'mote/base/browser/ui/contextview/contextview';
import { ILayoutService } from 'mote/platform/layout/browser/layoutService';

export class ContextViewService extends Disposable implements IContextViewService {
	declare readonly _serviceBrand: undefined;

	private currentViewDisposable: IDisposable = Disposable.None;
	private contextView: ContextView;
	private container: HTMLElement | null;

	constructor(
		@ILayoutService readonly layoutService: ILayoutService
	) {
		super();

		this.container = layoutService.hasContainer ? layoutService.container : null;
		this.contextView = this._register(new ContextView(this.container, ContextViewDOMPosition.ABSOLUTE));
	}

	// ContextView

	private setContainer(container: HTMLElement, domPosition?: ContextViewDOMPosition): void {
		this.contextView.setContainer(container, domPosition || ContextViewDOMPosition.ABSOLUTE);
	}

	showContextView(delegate: IContextViewDelegate, container?: HTMLElement, shadowRoot?: boolean): IDisposable {
		if (container) {
			if (container !== this.container) {
				this.container = container;
				this.setContainer(container, shadowRoot ? ContextViewDOMPosition.FIXED_SHADOW : ContextViewDOMPosition.FIXED);
			}
		} else {
			if (this.layoutService.hasContainer && this.container !== this.layoutService.container) {
				this.container = this.layoutService.container;
				this.setContainer(this.container, ContextViewDOMPosition.ABSOLUTE);
			}
		}

		this.contextView.show(delegate);

		const disposable = toDisposable(() => {
			if (this.currentViewDisposable === disposable) {
				this.hideContextView();
			}
		});

		this.currentViewDisposable = disposable;
		return disposable;
	}

	getContextViewElement(): HTMLElement {
		return this.contextView.getViewElement();
	}

	layout(): void {
		this.contextView.layout();
	}

	hideContextView(data?: any): void {
		this.contextView.hide(data);
	}
}
