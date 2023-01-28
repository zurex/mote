export class UndoRedoGroup {
	private static _ID = 0;

	public readonly id: number;
	private order: number;

	constructor() {
		this.id = UndoRedoGroup._ID++;
		this.order = 1;
	}

	public nextOrder(): number {
		if (this.id === 0) {
			return 0;
		}
		return this.order++;
	}

	public static None = new UndoRedoGroup();
}
