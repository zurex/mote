import { CancellationToken, CancellationTokenSource } from "./cancellation";
import { CancellationError } from "./errors";
import { IDisposable } from "./lifecycle";
import { setTimeout0 } from "./platform";

export function isThenable<T>(obj: unknown): obj is Promise<T> {
	return !!obj && typeof (obj as unknown as Promise<T>).then === 'function';
}

export interface CancelablePromise<T> extends Promise<T> {
	cancel(): void;
}

export function createCancelablePromise<T>(callback: (token: CancellationToken) => Promise<T>): CancelablePromise<T> {
	const source = new CancellationTokenSource();

	const thenable = callback(source.token);
	const promise = new Promise<T>((resolve, reject) => {
		const subscription = source.token.onCancellationRequested(() => {
			subscription.dispose();
			reject(new CancellationError());
		});
		Promise.resolve(thenable).then(value => {
			subscription.dispose();
			source.dispose();
			resolve(value);
		}, err => {
			subscription.dispose();
			source.dispose();
			reject(err);
		});
	});

	return <CancelablePromise<T>>new class {
		cancel() {
			source.cancel();
			source.dispose();
		}
		then<TResult1 = T, TResult2 = never>(resolve?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, reject?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
			return promise.then(resolve, reject);
		}
		catch<TResult = never>(reject?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult> {
			return this.then(undefined, reject);
		}
		finally(onfinally?: (() => void) | undefined | null): Promise<T> {
			return promise.finally(onfinally);
		}
	};
}

export namespace Promises {

	/**
	 * A drop-in replacement for `Promise.all` with the only difference
	 * that the method awaits every promise to either fulfill or reject.
	 *
	 * Similar to `Promise.all`, only the first error will be returned
	 * if any.
	 */
	export async function settled<T>(promises: Promise<T>[]): Promise<T[]> {
		let firstError: Error | undefined = undefined;

		const result = await Promise.all(promises.map(promise => promise.then(value => value, error => {
			if (!firstError) {
				firstError = error;
			}

			return undefined; // do not rethrow so that other promises can settle
		})));

		if (typeof firstError !== 'undefined') {
			throw firstError;
		}

		return result as unknown as T[]; // cast is needed and protected by the `throw` above
	}
}

export function timeout(millis: number): CancelablePromise<void>;
export function timeout(millis: number, token: CancellationToken): Promise<void>;
export function timeout(millis: number, token?: CancellationToken): CancelablePromise<void> | Promise<void> {
	if (!token) {
		return createCancelablePromise(token => timeout(millis, token));
	}

	return new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			disposable.dispose();
			resolve();
		}, millis);
		const disposable = token.onCancellationRequested(() => {
			clearTimeout(handle);
			disposable.dispose();
			reject(new CancellationError());
		});
	});
}

//#region -- run on idle tricks ------------

export interface IdleDeadline {
	readonly didTimeout: boolean;
	timeRemaining(): number;
}

type IdleApi = Pick<typeof globalThis, 'requestIdleCallback' | 'cancelIdleCallback'>;


/**
 * Execute the callback the next time the browser is idle, returning an
 * {@link IDisposable} that will cancel the callback when disposed. This wraps
 * [requestIdleCallback] so it will fallback to [setTimeout] if the environment
 * doesn't support it.
 *
 * @param callback The callback to run when idle, this includes an
 * [IdleDeadline] that provides the time alloted for the idle callback by the
 * browser. Not respecting this deadline will result in a degraded user
 * experience.
 * @param timeout A timeout at which point to queue no longer wait for an idle
 * callback but queue it on the regular event loop (like setTimeout). Typically
 * this should not be used.
 *
 * [IdleDeadline]: https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline
 * [requestIdleCallback]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
 * [setTimeout]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
 *
 * **Note** that there is `dom.ts#runWhenWindowIdle` which is better suited when running inside a browser
 * context
 */
export let runWhenGlobalIdle: (callback: (idle: IdleDeadline) => void, timeout?: number) => IDisposable;

export let _runWhenIdle: (targetWindow: IdleApi, callback: (idle: IdleDeadline) => void, timeout?: number) => IDisposable;

(function () {
	if (typeof globalThis.requestIdleCallback !== 'function' || typeof globalThis.cancelIdleCallback !== 'function') {
		_runWhenIdle = (_targetWindow, runner, timeout?) => {
			setTimeout0(() => {
				if (disposed) {
					return;
				}
				const end = Date.now() + 15; // one frame at 64fps
				const deadline: IdleDeadline = {
					didTimeout: true,
					timeRemaining() {
						return Math.max(0, end - Date.now());
					}
				};
				runner(Object.freeze(deadline));
			});
			let disposed = false;
			return {
				dispose() {
					if (disposed) {
						return;
					}
					disposed = true;
				}
			};
		};
	} else {
		_runWhenIdle = (targetWindow: IdleApi, runner, timeout?) => {
			const handle: number = targetWindow.requestIdleCallback(runner, typeof timeout === 'number' ? { timeout } : undefined);
			let disposed = false;
			return {
				dispose() {
					if (disposed) {
						return;
					}
					disposed = true;
					targetWindow.cancelIdleCallback(handle);
				}
			};
		};
	}
	runWhenGlobalIdle = (runner, timeout) => _runWhenIdle(globalThis, runner, timeout);
})();

export abstract class AbstractIdleValue<T> {

	private readonly _executor: () => void;
	private readonly _handle: IDisposable;

	private _didRun: boolean = false;
	private _value?: T;
	private _error: unknown;

	constructor(targetWindow: IdleApi, executor: () => T) {
		this._executor = () => {
			try {
				this._value = executor();
			} catch (err) {
				this._error = err;
			} finally {
				this._didRun = true;
			}
		};
		this._handle = _runWhenIdle(targetWindow, () => this._executor());
	}

	dispose(): void {
		this._handle.dispose();
	}

	get value(): T {
		if (!this._didRun) {
			this._handle.dispose();
			this._executor();
		}
		if (this._error) {
			throw this._error;
		}
		return this._value!;
	}

	get isInitialized(): boolean {
		return this._didRun;
	}
}

/**
 * An `IdleValue` that always uses the current window (which might be throttled or inactive)
 *
 * **Note** that there is `dom.ts#WindowIdleValue` which is better suited when running inside a browser
 * context
 */
export class GlobalIdleValue<T> extends AbstractIdleValue<T> {

	constructor(executor: () => T) {
		super(globalThis, executor);
	}
}

//#endregion
