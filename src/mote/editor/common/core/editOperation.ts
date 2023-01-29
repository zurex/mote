import RecordStore from 'mote/platform/store/common/recordStore';
import BlockStore from 'mote/platform/store/common/blockStore';
import { Transaction } from 'mote/editor/common/core/transaction';
import { Command } from 'mote/platform/transaction/common/operations';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { generateUuid } from 'mote/base/common/uuid';
import { BlockType } from 'mote/platform/store/common/record';
import { IRange } from 'mote/editor/common/core/editorRange';

/**
 * A single edit operation, that acts as a simple replace.
 * i.e. Replace text at `range` with `text` in model.
 */
export interface ISingleEditOperation {
	/**
	 * The range to replace. This can be empty to emulate a simple insert.
	 */
	range: IRange;
	/**
	 * The text to replace with. This can be null to emulate a simple delete.
	 */
	text: string | null;
	/**
	 * This indicates that this operation has "insert" semantics.
	 * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
	 */
	forceMoveMarkers?: boolean;
}

export class EditOperation {

	public static createBlockStore(
		type: string,
		transaction: Transaction,
		parent: RecordStore,
		table: string = 'block',
	) {
		const id = generateUuid();
		const blockStore = new BlockStore({
			table: table,
			id: id
		}, transaction.userId, [], parent.inMemoryRecordCacheStore, parent.storeService);
		this.addSetOperationForStore(blockStore, {
			type: type
		}, transaction);
		return blockStore;
	}

	public static turnInto(store: BlockStore, blockType: BlockType, transcation: Transaction) {
		const record = store.getValue();
		if (record && record.type !== blockType) {
			this.addUpdateOperationForStore(
				store,
				{
					type: blockType
				},
				transcation
			);
		}
	}

	public static createChild(parent: BlockStore, transaction: Transaction) {
		const child = this.createBlockStore('text', transaction, parent);
		this.appendToParent(parent.getContentStore(), child, transaction);
		return {
			parent: parent,
			child: child
		};
	}

	public static prependChild(parent: RecordStore, prepend: RecordStore, transaction: Transaction) {
		this.addOperationForStore(parent, { id: prepend.id }, transaction, Command.ListBefore);
		return {
			parent: parent,
			child: prepend.cloneWithNewParent(parent)
		};
	}

	public static removeChild(parent: RecordStore, remove: RecordStore, transaction: Transaction, shouldGarbageCollect?: boolean) {
		this.addOperationForStore(parent, { id: remove.id }, transaction, Command.ListRemove);
		RecordCacheStore.Default.deleteRecord(remove);
	}

	public static appendToParent(parent: RecordStore, append: RecordStore, transaction: Transaction) {
		this.addOperationForStore(parent, { id: append.id }, transaction, Command.ListAfter);
		const child = append.cloneWithNewParent(parent);
		this.addUpdateOperationForStore(child, { parent_id: parent.id }, transaction);
		return {
			parent: parent,
			child: child
		};
	}

	public static insertChildAfterTarget(parent: RecordStore, insert: RecordStore, after: RecordStore, transaction: Transaction) {
		this.addOperationForStore(parent, { id: insert.id, after: after.id }, transaction, Command.ListAfter);
		const child = insert.cloneWithNewParent(parent);
		this.addUpdateOperationForStore(child, { parent_id: parent.id }, transaction);
		return {
			parent: parent,
			child: child
		};
	}

	public static insertChildBeforeTarget(parent: RecordStore, insert: RecordStore, before: RecordStore, transaction: Transaction) {
		this.addOperationForStore(parent, { id: insert.id, before: before.id }, transaction, Command.ListBefore)
	}

	public static addUpdateOperationForStore(store: RecordStore, data: any, transaction: Transaction) {
		this.addOperationForStore(store, data, transaction, Command.Update);
	}

	public static addSetOperationForStore(store: RecordStore, data: any, transaction: Transaction) {
		this.addOperationForStore(store, data, transaction, Command.Set);
	}

	public static addOperationForStore(store: RecordStore, data: any, transaction: Transaction, command: Command) {
		transaction.addOperation(
			store,
			{
				id: store.id,
				table: store.table,
				path: store.path,
				command: command,
				args: data
			}
		);
	}
}
