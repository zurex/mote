import { EditorExtensions, IEditorDescriptor as ICommonEditorDescriptor } from 'mote/workbench/common/editor';
import { EditorPane } from 'mote/workbench/browser/parts/editor/editorPane';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IDisposable, toDisposable } from 'mote/base/common/lifecycle';
import { BrandedService, IConstructorSignature, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { insert } from 'mote/base/common/arrays';
import { Registry } from 'mote/platform/registry/common/platform';
import { EditorInput } from 'mote/workbench/common/editorInput';


export interface IEditorPaneDescriptor extends ICommonEditorDescriptor<EditorPane> { }

export interface IEditorPaneRegistry {

	/**
	 * Registers an editor pane to the platform for the given editor type. The second parameter also supports an
	 * array of input classes to be passed in. If the more than one editor is registered for the same editor
	 * input, the input itself will be asked which editor it prefers if this method is provided. Otherwise
	 * the first editor in the list will be returned.
	 *
	 * @param editorDescriptors A set of constructor functions that return an instance of `EditorInput` for which the
	 * registered editor should be used for.
	 */
	registerEditorPane(editorPaneDescriptor: IEditorPaneDescriptor, editorDescriptors: readonly SyncDescriptor<EditorInput>[]): IDisposable;

	/**
	 * Returns the editor pane descriptor for the given editor or `undefined` if none.
	 */
	getEditorPane(editor: EditorInput): IEditorPaneDescriptor | undefined;
}


/**
 * A lightweight descriptor of an editor pane. The descriptor is deferred so that heavy editor
 * panes can load lazily in the workbench.
 */
export class EditorPaneDescriptor implements IEditorPaneDescriptor {

	static create<Services extends BrandedService[]>(
		ctor: { new(...services: Services): EditorPane },
		typeId: string,
		name: string
	): EditorPaneDescriptor {
		return new EditorPaneDescriptor(ctor as IConstructorSignature<EditorPane>, typeId, name);
	}

	private constructor(
		private readonly ctor: IConstructorSignature<EditorPane>,
		readonly typeId: string,
		readonly name: string
	) { }

	instantiate(instantiationService: IInstantiationService): EditorPane {
		return instantiationService.createInstance(this.ctor);
	}

	describes(editorPane: EditorPane): boolean {
		return editorPane.getId() === this.typeId;
	}
}

export class EditorPaneRegistry implements IEditorPaneRegistry {

	private readonly editorPanes: EditorPaneDescriptor[] = [];
	private readonly mapEditorPanesToEditors = new Map<EditorPaneDescriptor, readonly SyncDescriptor<EditorInput>[]>();

	registerEditorPane(editorPaneDescriptor: EditorPaneDescriptor, editorDescriptors: readonly SyncDescriptor<EditorInput>[]): IDisposable {
		this.mapEditorPanesToEditors.set(editorPaneDescriptor, editorDescriptors);

		const remove = insert(this.editorPanes, editorPaneDescriptor);

		return toDisposable(() => {
			this.mapEditorPanesToEditors.delete(editorPaneDescriptor);
			remove();
		});
	}

	getEditorPane(editor: EditorInput): EditorPaneDescriptor | undefined {
		const descriptors = this.findEditorPaneDescriptors(editor);

		if (descriptors.length === 0) {
			return undefined;
		}

		if (descriptors.length === 1) {
			return descriptors[0];
		}

		return editor.prefersEditorPane(descriptors);
	}

	private findEditorPaneDescriptors(editor: EditorInput, byInstanceOf?: boolean): EditorPaneDescriptor[] {
		const matchingEditorPaneDescriptors: EditorPaneDescriptor[] = [];

		for (const editorPane of this.editorPanes) {
			const editorDescriptors = this.mapEditorPanesToEditors.get(editorPane) || [];
			for (const editorDescriptor of editorDescriptors) {
				const editorClass = editorDescriptor.ctor;

				// Direct check on constructor type (ignores prototype chain)
				if (!byInstanceOf && editor.constructor === editorClass) {
					matchingEditorPaneDescriptors.push(editorPane);
					break;
				}

				// Normal instanceof check
				else if (byInstanceOf && editor instanceof editorClass) {
					matchingEditorPaneDescriptors.push(editorPane);
					break;
				}
			}
		}

		// If no descriptors found, continue search using instanceof and prototype chain
		if (!byInstanceOf && matchingEditorPaneDescriptors.length === 0) {
			return this.findEditorPaneDescriptors(editor, true);
		}

		return matchingEditorPaneDescriptors;
	}

	//#region Used for tests only

	getEditorPaneByType(typeId: string): EditorPaneDescriptor | undefined {
		return this.editorPanes.find(editor => editor.typeId === typeId);
	}

	getEditorPanes(): readonly EditorPaneDescriptor[] {
		return this.editorPanes.slice(0);
	}

	getEditors(): SyncDescriptor<EditorInput>[] {
		const editorClasses: SyncDescriptor<EditorInput>[] = [];
		for (const editorPane of this.editorPanes) {
			const editorDescriptors = this.mapEditorPanesToEditors.get(editorPane);
			if (editorDescriptors) {
				editorClasses.push(...editorDescriptors.map(editorDescriptor => editorDescriptor.ctor));
			}
		}

		return editorClasses;
	}

	//#endregion
}


Registry.add(EditorExtensions.EditorPane, new EditorPaneRegistry());
