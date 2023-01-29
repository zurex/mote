import { Event } from 'mote/base/common/event';
import { Color } from 'mote/base/common/color';
import { IDisposable } from 'mote/base/common/lifecycle';

/**
 * The state of the tokenizer between two lines.
 * It is useful to store flags such as in multiline comment, etc.
 * The model will clone the previous line's state and pass it in to tokenize the next line.
 */
export interface IState {
	clone(): IState;
	equals(other: IState): boolean;
}

export class Token {
	_tokenBrand: void = undefined;

	public readonly offset: number;
	public readonly type: string;
	public readonly language: string;

	constructor(offset: number, type: string, language: string) {
		this.offset = offset;
		this.type = type;
		this.language = language;
	}

	public toString(): string {
		return '(' + this.offset + ', ' + this.type + ')';
	}
}

/**
 * @internal
 */
export class TokenizationResult {
	_tokenizationResultBrand: void = undefined;

	public readonly tokens: Token[];
	public readonly endState: IState;

	constructor(tokens: Token[], endState: IState) {
		this.tokens = tokens;
		this.endState = endState;
	}
}

/**
 * @internal
 */
export class EncodedTokenizationResult {
	_encodedTokenizationResultBrand: void = undefined;

	/**
	 * The tokens in binary format. Each token occupies two array indices. For token i:
	 *  - at offset 2*i => startIndex
	 *  - at offset 2*i + 1 => metadata
	 *
	 */
	public readonly tokens: Uint32Array;
	public readonly endState: IState;

	constructor(tokens: Uint32Array, endState: IState) {
		this.tokens = tokens;
		this.endState = endState;
	}
}

/**
 * @internal
 */
export interface ITokenizationSupport {

	getInitialState(): IState;

	tokenize(line: string, hasEOL: boolean, state: IState): TokenizationResult;

	tokenizeEncoded(line: string, hasEOL: boolean, state: IState): EncodedTokenizationResult;
}

/**
 * @internal
 */
export interface ITokenizationSupportChangedEvent {
	changedLanguages: string[];
	changedColorMap: boolean;
}

/**
 * A provider result represents the values a provider, like the {@link HoverProvider},
 * may return. For once this is the actual result type `T`, like `Hover`, or a thenable that resolves
 * to that type `T`. In addition, `null` and `undefined` can be returned - either directly or from a
 * thenable.
 */
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;


/**
 * @internal
 */
export interface ITokenizationSupportFactory {
	createTokenizationSupport(): ProviderResult<ITokenizationSupport>;
}

/**
 * @internal
 */
export interface ITokenizationRegistry {

	/**
	 * An event triggered when:
	 *  - a tokenization support is registered, unregistered or changed.
	 *  - the color map is changed.
	 */
	onDidChange: Event<ITokenizationSupportChangedEvent>;

	/**
	 * Fire a change event for a language.
	 * This is useful for languages that embed other languages.
	 */
	fire(languageIds: string[]): void;

	/**
	 * Register a tokenization support.
	 */
	register(languageId: string, support: ITokenizationSupport): IDisposable;

	/**
	 * Register a tokenization support factory.
	 */
	registerFactory(languageId: string, factory: ITokenizationSupportFactory): IDisposable;

	/**
	 * Get or create the tokenization support for a language.
	 * Returns `null` if not found.
	 */
	getOrCreate(languageId: string): Promise<ITokenizationSupport | null>;

	/**
	 * Get the tokenization support for a language.
	 * Returns `null` if not found.
	 */
	get(languageId: string): ITokenizationSupport | null;

	/**
	 * Returns false if a factory is still pending.
	 */
	isResolved(languageId: string): boolean;

	/**
	 * Set the new color map that all tokens will use in their ColorId binary encoded bits for foreground and background.
	 */
	setColorMap(colorMap: Color[]): void;

	getColorMap(): Color[] | null;

	getDefaultBackground(): Color | null;
}

export interface Command {
	id: string;
	title: string;
	tooltip?: string;
	arguments?: any[];
}
