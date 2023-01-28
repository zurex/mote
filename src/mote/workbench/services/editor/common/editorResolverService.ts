import * as glob from 'vs/base/common/glob';
import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IDisposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { PreferredGroup } from 'mote/workbench/services/editor/common/editorService';
import { EditorInputWithOptionsAndGroup } from 'mote/workbench/common/editor';

export const IEditorResolverService = createDecorator<IEditorResolverService>('editorResolverService');

type EditorInputFactoryResult = EditorInput | Promise<EditorInput>;
export type EditorInputFactory = (editorInput: IResourceEditorInput) => EditorInputFactoryResult;

export type RegisteredEditorInfo = {
	id: string;
};

/**
 * If we didn't resolve an editor dictates what to do with the opening state
 * ABORT = Do not continue with opening the editor
 * NONE = Continue as if the resolution has been disabled as the service could not resolve one
 */
export const enum ResolvedStatus {
	ABORT = 1,
	NONE = 2,
}

export type ResolvedEditor = EditorInputWithOptionsAndGroup | ResolvedStatus;

export interface IEditorResolverService {
	readonly _serviceBrand: undefined;

	registerEditor(globPattern: string | glob.IRelativePattern, editorInfo: RegisteredEditorInfo, editorFactory: EditorInputFactory): IDisposable;

	/**
	 * Given an editor resolves it to the suitable ResolvedEitor based on user extensions, settings, and built-in editors
	 * @param editor The editor to resolve
	 * @param preferredGroup The group you want to open the editor in
	 * @returns An EditorInputWithOptionsAndGroup if there is an available editor or a status of how to proceed
	 */
	resolveEditor(editor: IResourceEditorInput, preferredGroup: PreferredGroup | undefined): Promise<ResolvedEditor>;
}
