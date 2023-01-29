import { addDisposableListener, EventType, scheduleAtNextAnimationFrame } from "mote/base/browser/dom";
import { Disposable } from "mote/base/common/lifecycle";
import { IWorkbenchLayoutService } from "mote/workbench/services/layout/browser/layoutService";

export class NativeWindow extends Disposable {
	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this.registerListeners();
	}

	private registerListeners(): void {
		// Layout
		this._register(addDisposableListener(window, EventType.RESIZE, e => this.onWindowResize(e, true)));
	}

	private onWindowResize(e: UIEvent, retry: boolean): void {
		if (e.target === window) {
			if (window.document && window.document.body && window.document.body.clientWidth === 0) {
				// TODO@electron this is an electron issue on macOS when simple fullscreen is enabled
				// where for some reason the window clientWidth is reported as 0 when switching
				// between simple fullscreen and normal screen. In that case we schedule the layout
				// call at the next animation frame once, in the hope that the dimensions are
				// proper then.
				if (retry) {
					scheduleAtNextAnimationFrame(() => this.onWindowResize(e, false));
				}
				return;
			}

			this.layoutService.layout();
		}
	}
}
