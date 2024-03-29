import { RestrictedRenderingContext, ViewRenderingContext } from 'mote/editor/browser/view/renderingContext';
import { ViewContext } from 'mote/editor/browser/view/viewContext';
import { ViewEventHandler } from 'mote/editor/common/viewEventHandler';
import { FastDomNode } from 'mote/base/browser/fastDomNode';

export abstract class ViewPart extends ViewEventHandler {

	constructor(
		protected context: ViewContext
	) {
		super();

		this.context.addEventHandler(this);
	}

	public override dispose(): void {
		this.context.removeEventHandler(this);
		super.dispose();
	}

	public abstract prepareRender(ctx: ViewRenderingContext): void;
	public abstract render(ctx: RestrictedRenderingContext): void;

}

export const enum PartFingerprint {
	None,
	ContentWidgets,
	OverflowingContentWidgets,
	OverflowGuard,
	OverlayWidgets,
	ScrollableElement,
	TextArea,
	ViewLines,
	Minimap
}

export class PartFingerprints {

	public static write(target: Element | FastDomNode<HTMLElement>, partId: PartFingerprint) {
		target.setAttribute('data-mprt', String(partId));
	}

	public static read(target: Element): PartFingerprint {
		const r = target.getAttribute('data-mprt');
		if (r === null) {
			return PartFingerprint.None;
		}
		return parseInt(r, 10);
	}

	public static collect(child: Element | null, stopAt: Element): Uint8Array {
		const result: PartFingerprint[] = [];
		let resultLen = 0;

		while (child && child !== document.body) {
			if (child === stopAt) {
				break;
			}
			if (child.nodeType === child.ELEMENT_NODE) {
				result[resultLen++] = this.read(child);
			}
			child = child.parentElement;
		}

		const r = new Uint8Array(resultLen);
		for (let i = 0; i < resultLen; i++) {
			r[i] = result[resultLen - i - 1];
		}
		return r;
	}
}
