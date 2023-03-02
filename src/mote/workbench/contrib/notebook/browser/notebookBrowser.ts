import { Event } from 'mote/base/common/event';
import { IEditorPaneWithSelection } from 'mote/workbench/common/editor';
import { NotebookTextModel } from 'mote/workbench/contrib/notebook/common/model/notebookTextModel';

export interface INotebookEditor {

}

export interface INotebookEditorPane extends IEditorPaneWithSelection {
	getControl(): INotebookEditor | undefined;
	readonly onDidChangeModel: Event<void>;
	textModel: NotebookTextModel | undefined;
}
