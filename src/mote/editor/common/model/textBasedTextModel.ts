import * as model from 'mote/editor/common/model';
import { VSBuffer, VSBufferReadableStream } from 'mote/base/common/buffer';
import { listenStream } from 'mote/base/common/stream';
import { PieceTreeTextBufferBuilder } from 'mote/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder';
import { AbstractTextModel } from 'mote/editor/common/model/textModel';
import { URI } from 'mote/base/common/uri';
import { IUndoRedoService } from 'mote/platform/undoRedo/common/undoRedo';
import { IDisposable } from 'mote/base/common/lifecycle';
import { illegalArgument } from 'mote/base/common/errors';
import BlockStore from 'mote/platform/store/common/blockStore';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { RecordWithRole, Role } from 'mote/platform/store/common/record';

export function createTextBufferFactory(text: string): model.ITextBufferFactory {
	const builder = new PieceTreeTextBufferBuilder();
	builder.acceptChunk(text);
	return builder.finish();
}

interface ITextStream {
	on(event: 'data', callback: (data: string) => void): void;
	on(event: 'error', callback: (err: Error) => void): void;
	on(event: 'end', callback: () => void): void;
	on(event: string, callback: any): void;
}

export function createTextBufferFactoryFromStream(stream: ITextStream): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: VSBufferReadableStream): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: ITextStream | VSBufferReadableStream): Promise<model.ITextBufferFactory> {
	return new Promise<model.ITextBufferFactory>((resolve, reject) => {
		const builder = new PieceTreeTextBufferBuilder();

		let done = false;

		listenStream<string | VSBuffer>(stream, {
			onData: chunk => {
				builder.acceptChunk((typeof chunk === 'string') ? chunk : chunk.toString());
			},
			onError: error => {
				if (!done) {
					done = true;
					reject(error);
				}
			},
			onEnd: () => {
				if (!done) {
					done = true;
					resolve(builder.finish());
				}
			}
		});
	});
}

export function createTextBufferFactoryFromSnapshot(snapshot: model.ITextSnapshot): model.ITextBufferFactory {
	const builder = new PieceTreeTextBufferBuilder();

	let chunk: string | null;
	while (typeof (chunk = snapshot.read()) === 'string') {
		builder.acceptChunk(chunk);
	}

	return builder.finish();
}

export function createTextBuffer(value: string | model.ITextBufferFactory | model.ITextSnapshot, defaultEOL: model.DefaultEndOfLine): { textBuffer: model.ITextBuffer; disposable: IDisposable } {
	let factory: model.ITextBufferFactory;
	if (typeof value === 'string') {
		factory = createTextBufferFactory(value);
	} else if (model.isITextSnapshot(value)) {
		factory = createTextBufferFactoryFromSnapshot(value);
	} else {
		factory = value;
	}
	return factory.create(defaultEOL);
}

let MODEL_ID = 0;


export class TextBasedTextModel extends AbstractTextModel implements model.ITextModel {

	constructor(
		private source: string | model.ITextBufferFactory,
		creationOptions: model.ITextModelCreationOptions,
		associatedResource: URI | null = null,
		@IUndoRedoService private readonly _undoRedoService: IUndoRedoService,
	) {
		// Generate a new unique model id
		MODEL_ID++;

		if (typeof associatedResource === 'undefined' || associatedResource === null) {
			associatedResource = URI.parse('inmemory://model/' + MODEL_ID);
		} else {
			associatedResource = associatedResource;
		}

		super(creationOptions, associatedResource);

		this.initialize();
	}

	createTextBuffer(): [model.ITextBuffer, IDisposable] {
		const { textBuffer, disposable } = createTextBuffer(this.source, this.creationOptions.defaultEOL);
		return [textBuffer, disposable];
	}

	public setValue(value: string | model.ITextSnapshot): void {
		this.assertNotDisposed();

		if (value === null || value === undefined) {
			throw illegalArgument();
		}

		const { textBuffer, disposable } = createTextBuffer(value, this.options.defaultEOL);
		this._setValueFromTextBuffer(textBuffer, disposable);
	}

	public override getLineStore(lineNumber: number): BlockStore {
		this.assertNotDisposed();

		const lineContent = this.getLineContent(lineNumber);
		const recordWithRole = {
			role: Role.Editor,
			value: {
				id: lineNumber.toString(),
				title: [[lineContent]],
				table: 'block',
				type: 'text',
				version: 0,
				last_version: 0,
			}
		};

		const userId = 'local';

		const pointer = { table: 'block', id: lineNumber.toString() };

		RecordCacheStore.Default.setRecord({ pointer, userId }, recordWithRole as any);

		const mockService = {
			addSubscription: () => { }
		};

		return new BlockStore(pointer, userId, [], RecordCacheStore.Default, mockService as any);
	}
}

