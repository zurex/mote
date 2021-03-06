/* eslint-disable code-no-unexternalized-strings */
import { TextSelection } from "mote/editor/common/core/selectionUtils";
import { EditorState } from "mote/editor/common/editorState";
import BlockStore from "mote/editor/common/store/blockStore";
import { IEditorPane } from "mote/workbench/common/editor";
import { EditorInput } from 'mote/workbench/common/editorInput';
import { createDecorator } from "vs/platform/instantiation/common/instantiation";

export const IEditorService = createDecorator<IEditorService>('editorService');

export interface IEditorService {

	readonly _serviceBrand: undefined;

	openEditor(editor: EditorInput): Promise<IEditorPane | undefined>;

	closeEditor(editor?: EditorInput): Promise<boolean>;
}

export const IEditorStateService = createDecorator<IEditorStateService>('editorStateService');

export type TextSelectionUpdatePayload = {
	store?: BlockStore;
	selection?: TextSelection;
	readOnly?: boolean;
};

export interface IEditorStateService {

	readonly _serviceBrand: undefined;

	getEditorState(): EditorState;

	//updateSelection(payload: TextSelectionUpdatePayload): void;

	//openEditor(editor: EditorInput): Promise<IEditorPane | undefined>;
}
