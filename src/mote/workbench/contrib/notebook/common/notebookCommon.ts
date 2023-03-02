import { Mimes } from 'mote/base/common/mime';
import { URI } from 'mote/base/common/uri';
import { IReadonlyTextBuffer } from 'mote/editor/common/model';

export enum BlockKind {
	Markup = 1,
	Code = 2
}

export const NOTEBOOK_DISPLAY_ORDER: readonly string[] = [
	'application/json',
	'application/javascript',
	'text/html',
	'image/svg+xml',
	Mimes.latex,
	Mimes.markdown,
	'image/png',
	'image/jpeg',
	Mimes.text
];

export const ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER: readonly string[] = [
	Mimes.latex,
	Mimes.markdown,
	'application/json',
	Mimes.text,
	'text/html',
	'image/svg+xml',
	'image/png',
	'image/jpeg',
];

export type NotebookDocumentMetadata = Record<string, unknown>;

export interface NotebookBlockMetadata {
	/**
	 * custom metadata
	 */
	[key: string]: unknown;
}

export interface IBlock {
	readonly uri: URI;
	handle: number;
	metadata: NotebookBlockMetadata;
	blockKind: BlockKind;
	textBuffer: IReadonlyTextBuffer;
}

export interface INotebookTextModel {
	readonly uri: URI;
	readonly versionId: number;

}
