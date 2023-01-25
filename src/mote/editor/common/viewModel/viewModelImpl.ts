import { Event } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import * as viewEvents from 'mote/editor/common/viewEvents';
import { IEditorConfiguration } from 'mote/editor/common/config/editorConfiguration';
import { ITextModel } from 'mote/editor/common/model';
import { ILineBreaksComputerFactory } from 'mote/editor/common/modelLineProjectionData';
import { ViewLayout } from 'mote/editor/common/viewLayout/viewLayout';
import { IViewModel } from 'mote/editor/common/viewModel';
import { ViewModelEventDispatcher } from 'mote/editor/common/viewModelEventDispatcher';
import { OutgoingViewModelEvent, ScrollChangedEvent } from 'mote/editor/common/viewModelEventsCollector';

export class ViewModel extends Disposable implements IViewModel {

	public readonly onEvent: Event<OutgoingViewModelEvent>;

	public readonly viewLayout: ViewLayout;

	private readonly eventDispatcher: ViewModelEventDispatcher;

	constructor(
		private readonly editorId: number,
		private readonly configuration: IEditorConfiguration,
		public readonly model: ITextModel,
		domLineBreaksComputerFactory: ILineBreaksComputerFactory,
		monospaceLineBreaksComputerFactory: ILineBreaksComputerFactory,
		scheduleAtNextAnimationFrame: (callback: () => void) => IDisposable,
	) {
		super();

		this.eventDispatcher = new ViewModelEventDispatcher();
		this.onEvent = this.eventDispatcher.onEvent;

		this.viewLayout = this._register(new ViewLayout(this, this.configuration, this.getLineCount(), scheduleAtNextAnimationFrame));

		this._register(this.viewLayout.onDidScroll((e) => {
			this.eventDispatcher.emitSingleViewEvent(new viewEvents.ViewScrollChangedEvent(e));
			this.eventDispatcher.emitOutgoingEvent(new ScrollChangedEvent(
				e.oldScrollWidth, e.oldScrollLeft, e.oldScrollHeight, e.oldScrollTop,
				e.scrollWidth, e.scrollLeft, e.scrollHeight, e.scrollTop
			));
		}));
	}

	getLineCount(): number {
		return 0;
	}
}
