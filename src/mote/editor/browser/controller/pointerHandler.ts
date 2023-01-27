import { Disposable } from 'mote/base/common/lifecycle';
import { IPointerHandlerHelper, MouseHandler } from 'mote/editor/browser/controller/mouseHandler';
import { IMouseTarget } from 'mote/editor/browser/editorBrowser';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewController } from 'mote/editor/browser/view/viewController';

export class PointerHandler extends Disposable {
	private readonly handler: MouseHandler;

	constructor(context: ViewContext, viewController: ViewController, viewHelper: IPointerHandlerHelper) {
		super();

		this.handler = this._register(new MouseHandler(context, viewController, viewHelper));
	}

	public getTargetAtClientPoint(clientX: number, clientY: number): IMouseTarget | null {
		return this.handler.getTargetAtClientPoint(clientX, clientY);
	}
}
