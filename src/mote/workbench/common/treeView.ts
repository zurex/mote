import { Event, } from 'mote/base/common/event';

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2
}

export interface ITreeItem {

	id: string;

	handle: string;

	parentHandle?: string;

	collapsibleState: TreeItemCollapsibleState;

	//label?: ITreeItemLabel;

	description?: string | boolean;

	//icon?: UriComponents;

	//iconDark?: UriComponents;

	//themeIcon?: ThemeIcon;

	//resourceUri?: UriComponents;

	//tooltip?: string | IMarkdownString;

	contextValue?: string;

	//command?: Command;

	children?: ITreeItem[];
}

export interface ITreeViewDataProvider {
	readonly isTreeEmpty?: boolean;
	onDidChangeEmpty?: Event<void>;
	getChildren(element?: ITreeItem): Promise<ITreeItem[] | undefined>;
}
