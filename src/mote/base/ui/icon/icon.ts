import { Disposable, IDisposable } from "mote/base/common/lifecycle";

export interface IIcon extends IDisposable {
    readonly element: HTMLElement;
}

export class Icon extends Disposable implements IIcon {
    protected _element: HTMLElement;

    constructor(container: HTMLElement) {
        super();

        this._element = document.createElement('svg');
    }

    get element(): HTMLElement {
        return this._element;
    }
}
