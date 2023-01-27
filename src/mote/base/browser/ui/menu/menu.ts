import { IHoverDelegate } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { IMenuOptions } from 'vs/base/browser/ui/menu/menu';
import { Color } from 'mote/base/common/color';
import { Event } from 'mote/base/common/event';
import { IDisposable } from 'mote/base/common/lifecycle';
import { IThemable } from 'mote/base/common/styler';

export interface IMenuLike extends IThemable, IDisposable {
	getContainer(): HTMLElement;

	onDidCancel: Event<void>;
	onDidBlur: Event<void>;
}

export interface IMenuLikeOptions extends IMenuOptions {
	readonly hoverDelegate?: IHoverDelegate;
}


export interface IMenuLikeStyles {
	shadowColor?: Color;
	borderColor?: Color;
	foregroundColor?: Color;
	backgroundColor?: Color;
	dividerColor?: Color;
}
