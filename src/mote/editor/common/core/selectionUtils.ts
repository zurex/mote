import { getDataRootInParent, getTextMention, isTextBufferElement, isTextNode, removeBOM } from "mote/editor/common/htmlElementUtils";
import RecordStore from 'mote/platform/store/common/recordStore';
import { serializeNode } from 'mote/editor/common/textSerialize';
import { RangeUtils } from './rangeUtils';

export interface TextSelection {
	startIndex: number;
	endIndex: number;
	lineNumber: number;
}

export enum TextSelectionMode {
	Empty = 0,
	Editing,
	ReadOnly,
}

export interface TextSelectionState {
	/**
	 * Current mode
	 */
	mode: TextSelectionMode;

	/**
	 * Current selection
	 */
	selection: TextSelection;

	/**
	 * The selection belong to
	 */
	store?: RecordStore;
}

interface ContainerWithOffset {
	container: Node;
	offset: number;
}

export function calcIndex(dataRoot: Node | null | undefined, containerWithOffset: ContainerWithOffset): number {
	if (dataRoot === containerWithOffset.container) {
		if (isTextNode(dataRoot)) {
			const e = dataRoot && dataRoot.textContent || '';
			return e.substring(0, containerWithOffset.offset).length;
		}
		{
			const e = Array.from(dataRoot ? dataRoot.childNodes : [])
				.slice(0, containerWithOffset.offset)
				.map(e => removeBOM(serializeNode(e))).join('');
			return e.length;
		}
	}

	let i = 0;
	for (const childNode of Array.from(dataRoot ? dataRoot.childNodes : [])) {
		if (childNode.contains(containerWithOffset.container)) {
			return i + calcIndex(childNode, containerWithOffset);
		}
		i += removeBOM(serializeNode(childNode)).length;
	}
	return i;
}

export function getIndex(container: Node, offset: number) {
	const dataRoot = getDataRootInParent(container);

	let containerWithOffset: ContainerWithOffset;
	// Generate containerWithOffset
	const textMentionElement = getTextMention(container);
	if (textMentionElement) {
		const parentNode = textMentionElement.parentNode;
		const textMentionElementIndex = Array.from(parentNode.childNodes).indexOf(textMentionElement);
		containerWithOffset = {
			container: parentNode,
			offset: 0 === offset ? textMentionElementIndex : textMentionElementIndex + 1
		};
	} else {
		if (isTextBufferElement(container) || isTextBufferElement(container.parentNode)) {
			containerWithOffset = {
				container: container,
				offset: (container.textContent || ' ').length - 1
			};
		} else {
			containerWithOffset = {
				container: container,
				offset: offset
			};
		}
	}

	return calcIndex(dataRoot, containerWithOffset);
}



export function getSelectionFromRange(range?: globalThis.Range) {
	range = range || RangeUtils.get();
	if (range) {
		const dataRoot = getDataRootInParent(range.startContainer) as HTMLElement;
		const lineNumber = dataRoot.getAttribute('data-index') || '-1';
		const startIndex = getIndex(range.startContainer, range.startOffset);
		const endIndex = getIndex(range.endContainer, range.endOffset);
		const textMentionNode = getTextMention(range.startContainer) || getTextMention(range.endContainer);
		return {
			selection: {
				startIndex: startIndex,
				endIndex: endIndex,
				lineNumber: parseInt(lineNumber),
			},
			forceEmitSelectionStore: Boolean(textMentionNode)
		};
	}
	return null;
}
